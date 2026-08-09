import { DomainEvent } from './domain-event.base';

/**
 * Student identity events.
 *
 * No government identifier, no blind index, no ciphertext and no key version
 * appears in any of them. An event is copied into the outbox, the audit log and
 * every consumer's own storage, so a payload is the widest distribution a value
 * can get — what travels is the stable identifiers and the safe business facts.
 *
 * Only the events Phase 2 can actually emit are declared. Transfer, promotion,
 * withdrawal and graduation belong to the operations that cause them, and
 * declaring their events now would leave names nothing publishes.
 */

export interface StudentCreatedPayload {
  studentId: string;
  organizationId: string;
  branchId: string;
  personId: string;
  /** The human-facing identifier. Safe to share: it is designed to be printed. */
  studentCode: string;
  createdVia: string;
  sourceApplicantId: string | null;
}

/**
 * The event every future module subscribes to.
 *
 * Fees, library, transport, the portal and the search index all start from
 * here, which is why it goes through the outbox: a Student that exists while
 * this event was lost is a student nothing downstream knows about, and there is
 * no way to discover the omission except by reconciliation.
 */
export class StudentCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'student.created';
  readonly payload: StudentCreatedPayload;

  constructor(payload: StudentCreatedPayload, metadata?: Record<string, any>) {
    super({
      eventName: StudentCreatedEvent.EVENT_NAME,
      aggregateId: payload.studentId,
      aggregateType: 'Student',
      metadata,
    });
    this.payload = payload;
  }
}

export interface StudentCodeAssignedPayload {
  studentId: string;
  organizationId: string;
  studentCode: string;
}

/**
 * Separate from `student.created` because the consumers differ: ID-card
 * printing and external-integration mapping care about the code being issued,
 * not about a student existing.
 */
export class StudentCodeAssignedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'student.code_assigned';
  readonly payload: StudentCodeAssignedPayload;

  constructor(
    payload: StudentCodeAssignedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: StudentCodeAssignedEvent.EVENT_NAME,
      aggregateId: payload.studentId,
      aggregateType: 'Student',
      metadata,
    });
    this.payload = payload;
  }
}

export interface StudentUpdatedPayload {
  studentId: string;
  organizationId: string;
  /**
   * Which fields changed — names only.
   *
   * The before-and-after values travel in `metadata.changes`, where the audit
   * mapper picks them up as a field-level diff. Keeping them out of the payload
   * means a consumer that only needs "something about this student changed"
   * does not receive personal data it never asked for.
   */
  changedFields: string[];
}

export class StudentUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'student.updated';
  readonly payload: StudentUpdatedPayload;

  constructor(payload: StudentUpdatedPayload, metadata?: Record<string, any>) {
    super({
      eventName: StudentUpdatedEvent.EVENT_NAME,
      aggregateId: payload.studentId,
      aggregateType: 'Student',
      metadata,
    });
    this.payload = payload;
  }
}
