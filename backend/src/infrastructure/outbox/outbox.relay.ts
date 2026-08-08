import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { RequestContextService } from '@/common/logger/request-context.service';
import type { MutableRequestContext } from '@/common/logger/request-context.types';
import {
  OUTBOX_BACKOFF_BASE_SECONDS,
  OUTBOX_BATCH_SIZE,
  OUTBOX_MAX_ATTEMPTS,
  OutboxContextSnapshot,
  ReplayedDomainEvent,
} from './outbox.types';

interface ClaimedRow {
  id: string;
  eventId: string;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: unknown;
  metadata: Record<string, unknown> | null;
  contextSnapshot: OutboxContextSnapshot;
  attempts: number;
}

/**
 * Moves committed outbox rows onto the `EventBus`.
 *
 * Sits *behind* the EventBus abstraction, which is the property that makes this
 * change invisible: `AuditListener` and every other subscriber carry on
 * subscribing exactly as before, and no consumer knows the event took a
 * detour through a table.
 *
 * Delivery is **at-least-once**. A crash between publishing and marking the row
 * PUBLISHED replays the event on the next pass, so consumers must be
 * idempotent — `AuditLog.eventId` is unique for exactly this reason.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §36.4.
 */
@Injectable()
export class OutboxRelay
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  /** Idle poll interval. A nudge after commit keeps the happy path faster. */
  private readonly pollIntervalMs = 2000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.OUTBOX_RELAY_DISABLED === 'true') {
      this.logger.warn(
        'Outbox relay is disabled. Events will accumulate unpublished.',
      );
      return;
    }
    this.timer = setInterval(() => {
      void this.drain();
    }, this.pollIntervalMs);
    // Do not hold the process open on the relay alone.
    this.timer.unref?.();
    this.logger.log(`Outbox relay polling every ${this.pollIntervalMs}ms.`);
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Publish every claimable row, in batches, until none remain.
   *
   * Safe to call directly — tests and the post-commit nudge both do. Re-entrant
   * calls return immediately rather than queueing, because `FOR UPDATE SKIP
   * LOCKED` already makes concurrent drains correct and a second in-process
   * pass would only add contention.
   */
  async drain(): Promise<number> {
    if (this.running || this.stopped) return 0;
    this.running = true;
    let published = 0;

    try {
      for (;;) {
        const batch = await this.claimBatch();
        if (batch.length === 0) break;

        for (const row of batch) {
          const ok = await this.publishRow(row);
          if (ok) published += 1;
        }

        if (batch.length < OUTBOX_BATCH_SIZE) break;
      }
    } catch (error) {
      this.logger.error(
        'Outbox drain failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }

    return published;
  }

  /**
   * Claim a batch for this instance.
   *
   * `FOR UPDATE SKIP LOCKED` is what makes running several application
   * instances safe: each claims rows the others are not holding, instead of all
   * of them blocking on the oldest row.
   *
   * Rows are ordered by `createdAt` so events for one aggregate publish in the
   * order they were written. Global ordering across aggregates is not
   * guaranteed and consumers must not assume it.
   */
  private async claimBatch(): Promise<ClaimedRow[]> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<ClaimedRow[]>(
        `SELECT "id", "eventId", "eventName", "aggregateType", "aggregateId",
                "occurredAt", "payload", "metadata", "contextSnapshot", "attempts"
           FROM "OutboxEvent"
          WHERE "status" = 'PENDING' AND "nextAttemptAt" <= now()
          ORDER BY "createdAt"
          LIMIT ${OUTBOX_BATCH_SIZE}
          FOR UPDATE SKIP LOCKED`,
      );

      if (rows.length === 0) return [];

      // Push the claimed rows out of reach of a concurrent drain for the
      // duration of this pass. If publishing crashes, they become claimable
      // again once this window elapses rather than being lost.
      await tx.outboxEvent.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { nextAttemptAt: new Date(Date.now() + 60_000) },
      });

      return rows;
    });
  }

  private async publishRow(row: ClaimedRow): Promise<boolean> {
    const event = new ReplayedDomainEvent({
      eventId: row.eventId,
      eventName: row.eventName,
      aggregateId: row.aggregateId,
      aggregateType: row.aggregateType,
      occurredAt: new Date(row.occurredAt),
      payload: row.payload,
      metadata: row.metadata ?? undefined,
    });

    try {
      // Restore who and where before the listeners run, so audit attributes the
      // row to the actor who caused it rather than to the timer that replayed it.
      await RequestContextService.run(
        this.toRequestContext(row.contextSnapshot),
        async () => this.eventBus.publish(event),
      );

      await this.prisma.outboxEvent.update({
        where: { id: row.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          attempts: row.attempts + 1,
          lastError: null,
        },
      });

      return true;
    } catch (error) {
      await this.recordFailure(row, error);
      return false;
    }
  }

  private async recordFailure(row: ClaimedRow, error: unknown): Promise<void> {
    const attempts = row.attempts + 1;
    const exhausted = attempts >= OUTBOX_MAX_ATTEMPTS;
    const message = error instanceof Error ? error.message : String(error);

    // Exponential backoff, so a transient outage does not become a hot loop.
    const delaySeconds = OUTBOX_BACKOFF_BASE_SECONDS * 2 ** (attempts - 1);

    await this.prisma.outboxEvent.update({
      where: { id: row.id },
      data: {
        status: exhausted ? 'FAILED' : 'PENDING',
        attempts,
        lastError: message.slice(0, 1000),
        nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
      },
    });

    if (exhausted) {
      this.logger.error(
        `Outbox event ${row.eventName} (${row.eventId}) FAILED after ${attempts} attempts: ${message}`,
      );
    } else {
      this.logger.warn(
        `Outbox event ${row.eventName} (${row.eventId}) attempt ${attempts} failed, retrying in ${delaySeconds}s: ${message}`,
      );
    }
  }

  /**
   * Rebuild a request context from the snapshot.
   *
   * Only the audit-relevant fields were captured; the rest carry neutral
   * defaults. A consumer that needed more than this from a replayed event would
   * be depending on request state that no longer exists.
   */
  private toRequestContext(
    snapshot: OutboxContextSnapshot,
  ): MutableRequestContext {
    return {
      requestId: snapshot.requestId ?? 'outbox-relay',
      clientApp: 'outbox-relay',
      clientVersion: '1.0.0',
      platform: 'SYSTEM',
      ipAddress: snapshot.ipAddress ?? null,
      userAgent: snapshot.userAgent ?? null,
      httpMethod: snapshot.httpMethod ?? '',
      route: snapshot.route ?? '',
      userId: snapshot.userId ?? null,
      userEmail: snapshot.userEmail ?? null,
      role: snapshot.role ?? null,
      organizationId: snapshot.organizationId ?? null,
      branchId: snapshot.branchId ?? null,
      academicYearId: snapshot.academicYearId ?? null,
      branch: null,
      academicYear: null,
      programId: null,
      departmentId: null,
      campusId: null,
    };
  }
}
