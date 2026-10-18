import { DomainEvent } from './domain-event.base';

export interface ApplicantWorkflowPayload {
  applicantId: string;
  organizationId: string;
  branchId: string;
  /** The verb that was applied, e.g. `approve`. */
  action: string;
  fromStatus: string;
  toStatus: string;
  /**
   * Present when the transition was one step of a larger operation — today
   * only `DIRECT_ADMISSION` — so a report can tell a direct admission from a
   * walked one. Absent for an ordinary, individually requested transition.
   */
  orchestration?: 'DIRECT_ADMISSION';
}

/**
 * One transition of an application.
 *
 * The event *name* varies per transition — `applicant.offer_issued`,
 * `applicant.rejected`, `applicant.withdrawn` — while the payload shape does
 * not. That split is deliberate: a consumer subscribes to the specific thing it
 * cares about, and a report can separate an approval from a rejection without
 * reconstructing meaning from field diffs, which is the weakness a generic
 * `applicant.updated` would reintroduce.
 *
 * Carries no declared personal data — no name, no contact, no government
 * identifier. An event reaches the outbox, the audit log and every consumer's
 * storage, so it carries identifiers and the transition, and nothing a
 * subscriber has not been granted.
 */
export class ApplicantWorkflowEvent extends DomainEvent {
  readonly payload: ApplicantWorkflowPayload;

  constructor(
    payload: ApplicantWorkflowPayload,
    eventName: string,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName,
      aggregateId: payload.applicantId,
      aggregateType: 'Applicant',
      metadata,
    });
    this.payload = payload;
  }
}
