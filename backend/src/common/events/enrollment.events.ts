import { DomainEvent } from './domain-event.base';

/**
 * Academic placement events.
 *
 * These are the events attendance, examination, fees and the timetable will
 * subscribe to, which is exactly why none of them carries a name, a date of
 * birth, a contact number or any other demographic value. An event is copied
 * into the outbox, into the audit log and into every consumer's own storage —
 * the widest distribution a value can get. What travels is identifiers and the
 * placement facts, and a consumer that needs a name asks Student for it.
 *
 * Only the events Phase 4 can actually emit are declared. Promotion, repeat and
 * bulk promotion belong to the operations that cause them, and declaring their
 * names now would leave events nothing publishes.
 */

export interface EnrollmentCreatedPayload {
  enrollmentId: string;
  organizationId: string;
  branchId: string;
  academicYearId: string;
  studentId: string;
  admissionId: string;
  programId: string;
  academicUnitId: string;
  enrollmentKind: string;
  originType: string;
  previousEnrollmentId: string | null;
}

/**
 * A learner is placed for a year.
 *
 * The event every year-scoped module starts from: fee schedules, attendance
 * registers, timetable slots and examination eligibility are all generated from
 * here. It goes through the outbox because a placement that exists while this
 * event was lost is a student nobody downstream has heard of, and there is no
 * way to discover the omission except by reconciliation.
 */
export class EnrollmentCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'enrollment.created';
  readonly payload: EnrollmentCreatedPayload;

  constructor(
    payload: EnrollmentCreatedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: EnrollmentCreatedEvent.EVENT_NAME,
      aggregateId: payload.enrollmentId,
      aggregateType: 'Enrollment',
      metadata,
    });
    this.payload = payload;
  }
}

export interface EnrollmentSupersededPayload {
  oldEnrollmentId: string;
  newEnrollmentId: string;
  organizationId: string;
  branchId: string;
  academicYearId: string;
  studentId: string;
  originType: string;
  changeReason: string;
}

/**
 * A placement was replaced by a corrected one.
 *
 * Distinct from `enrollment.created` and required separately, because
 * attendance and marks hold rows against the **old** id. They need to know that
 * the id they hold has a successor; a create event alone tells them a new row
 * exists but not that their own reference has been retired.
 */
export class EnrollmentSupersededEvent extends DomainEvent {
  static readonly EVENT_NAME = 'enrollment.superseded';
  readonly payload: EnrollmentSupersededPayload;

  constructor(
    payload: EnrollmentSupersededPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: EnrollmentSupersededEvent.EVENT_NAME,
      aggregateId: payload.oldEnrollmentId,
      aggregateType: 'Enrollment',
      metadata,
    });
    this.payload = payload;
  }
}

export interface EnrollmentStatusChangedPayload {
  enrollmentId: string;
  organizationId: string;
  branchId: string;
  academicYearId: string;
  studentId: string;
  from: string;
  to: string;
  reason: string | null;
}

/** A placement moved through its lifecycle without being replaced. */
export class EnrollmentStatusChangedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'enrollment.status_changed';
  readonly payload: EnrollmentStatusChangedPayload;

  constructor(
    payload: EnrollmentStatusChangedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: EnrollmentStatusChangedEvent.EVENT_NAME,
      aggregateId: payload.enrollmentId,
      aggregateType: 'Enrollment',
      metadata,
    });
    this.payload = payload;
  }
}

export interface EnrollmentRollNumberChangedPayload {
  enrollmentId: string;
  organizationId: string;
  branchId: string;
  academicYearId: string;
  academicUnitId: string;
  studentId: string;
  from: string | null;
  to: string | null;
}

/**
 * A class-register position was assigned or moved.
 *
 * Separate from a placement change on purpose: the student has not moved class,
 * and a consumer that regenerates seating or printed lists cares about this
 * while one that manages fees does not.
 */
export class EnrollmentRollNumberChangedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'enrollment.roll_number_changed';
  readonly payload: EnrollmentRollNumberChangedPayload;

  constructor(
    payload: EnrollmentRollNumberChangedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: EnrollmentRollNumberChangedEvent.EVENT_NAME,
      aggregateId: payload.enrollmentId,
      aggregateType: 'Enrollment',
      metadata,
    });
    this.payload = payload;
  }
}
