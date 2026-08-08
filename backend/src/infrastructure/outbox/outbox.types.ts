import { DomainEvent } from '@/common/events/domain-event.base';

/**
 * The subset of the request context an event carries into the relay.
 *
 * `AuditEventMapper` reads the actor from `RequestContextService`, which is
 * backed by AsyncLocalStorage. The relay runs on a timer, outside any request,
 * so that store is empty — without this snapshot every replayed audit row would
 * be attributed to nobody, which is the most likely way to implement an outbox
 * and silently destroy the audit trail.
 *
 * Every field is nullable here even where the live context guarantees a value,
 * because an event may also be enqueued by a migration importer or a scheduled
 * job, where there is no request at all.
 */
export interface OutboxContextSnapshot {
  requestId: string | null;
  userId: string | null;
  userEmail: string | null;
  role: string | null;
  organizationId: string | null;
  branchId: string | null;
  academicYearId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  httpMethod: string | null;
  route: string | null;
}

/**
 * A domain event rebuilt from an outbox row.
 *
 * The concrete producer class is not reconstructed — only its data is stored,
 * so the relay cannot know which subclass wrote the row. Consumers therefore
 * must dispatch on `eventName` and read `payload`, and must never branch on
 * `instanceof`. Every consumer in the codebase already does exactly that;
 * this type exists to make the constraint visible to the next one.
 */
export class ReplayedDomainEvent extends DomainEvent {
  readonly payload: unknown;

  constructor(params: {
    eventId: string;
    eventName: string;
    aggregateId: string;
    aggregateType: string;
    occurredAt: Date;
    payload: unknown;
    metadata?: Record<string, unknown>;
  }) {
    super({
      eventId: params.eventId,
      eventName: params.eventName,
      aggregateId: params.aggregateId,
      aggregateType: params.aggregateType,
      occurredAt: params.occurredAt,
      metadata: params.metadata,
    });
    this.payload = params.payload;
  }
}

/** How many times the relay retries before parking a row as FAILED. */
export const OUTBOX_MAX_ATTEMPTS = 10;

/** Rows claimed per relay pass. */
export const OUTBOX_BATCH_SIZE = 100;

/** Base of the exponential backoff between attempts, in seconds. */
export const OUTBOX_BACKOFF_BASE_SECONDS = 5;
