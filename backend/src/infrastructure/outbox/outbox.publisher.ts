import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@/generated/client';
import { DomainEvent } from '@/common/events/domain-event.base';
import { RequestContextService } from '@/common/logger/request-context.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { OutboxContextSnapshot } from './outbox.types';

/**
 * Widen a value to the shape Prisma accepts for a `Json` column.
 *
 * The snapshot and the payload are ordinary serialisable objects, but Prisma's
 * `InputJsonValue` demands an index signature that a precise interface
 * deliberately does not have. Narrowing the interface instead would let any
 * misspelled field through at every construction site, so the coercion happens
 * once, here, where it is visible.
 */
function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/**
 * Writes a domain event into the same transaction as the data it describes.
 *
 * This is what business services call **instead of** `eventBus.publish()` when
 * they are inside a transaction. The distinction is the whole point:
 *
 *   eventBus.publish(event)              — fire and forget, lost on a crash
 *   outbox.enqueue(event, tx)            — commits with the data, always delivered
 *
 * The rule for choosing: *if the event describes something a transaction just
 * committed, it goes in the outbox; otherwise it publishes directly.* A login
 * event has no transaction to attach to and gains nothing from the round trip.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §36.
 */
@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);

  /**
   * Enqueue one event on the caller's transaction.
   *
   * Takes the transaction client explicitly rather than discovering it from
   * AsyncLocalStorage. Implicit discovery reads well until the day an event is
   * silently written outside the transaction it was supposed to be part of, and
   * nothing about the call site shows it.
   */
  async enqueue(
    event: DomainEvent,
    tx: PrismaTransactionClient,
  ): Promise<void> {
    const snapshot = this.captureContext();

    await tx.outboxEvent.create({
      data: {
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        occurredAt: event.occurredAt,
        payload: asJson((event as { payload?: unknown }).payload ?? {}),
        metadata: event.metadata ? asJson(event.metadata) : undefined,
        contextSnapshot: asJson(snapshot),
        organizationId: snapshot.organizationId,
      },
    });

    this.logger.debug(
      `Enqueued ${event.eventName} (${event.eventId}) for ${event.aggregateType}/${event.aggregateId}`,
    );
  }

  /** Enqueue several events on one transaction, preserving their order. */
  async enqueueAll(
    events: DomainEvent[],
    tx: PrismaTransactionClient,
  ): Promise<void> {
    for (const event of events) {
      await this.enqueue(event, tx);
    }
  }

  /**
   * Freeze the actor and scope at write time.
   *
   * Null throughout when there is no request in scope — a migration importer or
   * a scheduled job. That is honest: the relay will attribute the audit row to
   * the system rather than to whoever happened to be logged in when the timer
   * fired.
   */
  private captureContext(): OutboxContextSnapshot {
    const context = RequestContextService.getStore();

    return {
      requestId: context?.requestId ?? null,
      userId: context?.userId ?? null,
      userEmail: context?.userEmail ?? null,
      role: context?.role ?? null,
      organizationId: context?.organizationId ?? null,
      branchId: context?.branchId ?? null,
      academicYearId: context?.academicYearId ?? null,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      httpMethod: context?.httpMethod ?? null,
      route: context?.route ?? null,
    };
  }
}
