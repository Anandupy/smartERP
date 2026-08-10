import { DomainEvent } from './domain-event.base';

/**
 * Spell-of-study events.
 *
 * Separate from the applicant workflow events, which describe an *application*
 * moving through a funnel. This describes a student having joined — the fact a
 * transfer certificate, an admission register and a government return are all
 * written from.
 *
 * Only the event Phase 5 can emit is declared. Closing an admission belongs to
 * withdrawal, graduation and branch transfer, none of which exist yet, and
 * declaring `admission.closed` now would leave a name nothing publishes.
 */

export interface AdmissionCreatedPayload {
  admissionId: string;
  organizationId: string;
  branchId: string;
  studentId: string;
  /** Human-facing and safe to print; never used as a foreign key. */
  admissionNo: string;
  admissionType: string;
  admissionDate: Date;
  entryProgramId: string;
  entryAcademicUnitId: string;
  previousAdmissionId: string | null;
  sourceApplicantId: string | null;
}

/**
 * A spell of study has opened.
 *
 * Fees, certificates and statutory reporting all start from here rather than
 * from `student.created`: a student identity can exist without currently
 * studying anywhere — after graduation, or between a transfer out and a
 * readmission — and billing a person for existing would be wrong.
 */
export class AdmissionCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'admission.created';
  readonly payload: AdmissionCreatedPayload;

  constructor(
    payload: AdmissionCreatedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: AdmissionCreatedEvent.EVENT_NAME,
      aggregateId: payload.admissionId,
      aggregateType: 'Admission',
      metadata,
    });
    this.payload = payload;
  }
}
