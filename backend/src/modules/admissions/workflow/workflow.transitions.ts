import { AdmissionApplicationStatus as S } from '@/generated/client';
import { PERMISSIONS } from '@/common/constants/permission.constants';

/**
 * The applicant workflow, as data.
 *
 * The alternative — a chain of `if (status === …)` — grows one branch per
 * transition and eventually disagrees with itself: the remarks rule ends up in
 * one place, the permission in another, and the timestamp in a third. Here each
 * transition states all four in one row, and the engine does the same thing to
 * every one of them.
 *
 * It is deliberately *not* a configurable graph. The thirteen states and the
 * edges between them are core semantics — an institution that skips
 * `FEE_PENDING` simply never issues that action. A database-defined graph would
 * make "can this application be approved?" unanswerable without reading a
 * tenant's configuration, and would let a customer create a path to `ADMITTED`
 * that bypasses `admit()`.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §17.1.
 */

/** The verbs a caller may ask for. The engine owns the destination state. */
export enum WorkflowAction {
  SUBMIT = 'submit',
  START_REVIEW = 'startReview',
  REQUEST_DOCUMENTS = 'requestDocuments',
  DOCUMENTS_RECEIVED = 'documentsReceived',
  REQUEST_FEE = 'requestFee',
  WAITLIST = 'waitlist',
  APPROVE = 'approve',
  CONFIRM_SEAT = 'confirmSeat',
  DEFER = 'defer',
  EXPIRE_OFFER = 'expireOffer',
  REJECT = 'reject',
  WITHDRAW = 'withdraw',
  CANCEL = 'cancel',
  FORCE_REOPEN = 'forceReopen',
  /**
   * `SEAT_CONFIRMED → ADMITTED`, and the only orchestrated transition.
   *
   * It has a rule, but the rule is marked `orchestratedOnly`: the status change
   * is the *last* step of a transaction that has already written a Student, an
   * Admission and an Enrollment, and reaching it any other way would produce an
   * applicant marked admitted with nothing behind them. The generic workflow
   * endpoint therefore cannot invoke it — only `AdmissionConversionService` can.
   */
  ADMIT = 'admit',
}

/** Whether a transition demands an explanation. */
export type RemarksPolicy = 'REQUIRED' | 'OPTIONAL';

/**
 * Named guards, resolved by the engine.
 *
 * Strings rather than functions so this table stays declarative and testable
 * without constructing the services a function would close over.
 */
export type TransitionGuard =
  | 'OFFER_NOT_EXPIRED'
  | 'OFFER_EXPIRED'
  | 'DEFERMENT_ENABLED'
  | 'DOCUMENT_CHECKLIST_SATISFIED'
  /** `admissions.waitlist_enabled` — a policy switch, not an edge change. */
  | 'WAITLIST_ENABLED'
  /** `admissions.fee_step_enabled`. */
  | 'FEE_STEP_ENABLED'
  /** `admissions.document_request_enabled`. */
  | 'DOCUMENT_REQUEST_ENABLED'
  /**
   * VERIFIED_ADMISSION only: documents owed at `SUBMITTED` and
   * `UNDER_REVIEW` must be verified before review starts. A no-op under every
   * other profile, where those documents are checked at approval as before.
   */
  | 'VERIFIED_REVIEW_CHECKLIST'
  /**
   * VERIFIED_ADMISSION only: the approver may not be the user who started
   * the review. Read from `WorkflowHistory`, never from the request.
   */
  | 'DISTINCT_REVIEWER';

export interface TransitionRule {
  action: WorkflowAction;
  from: S[];
  to: S;
  /** Permission required in addition to the route's role gate. */
  permission: string;
  remarks: RemarksPolicy;
  guards?: TransitionGuard[];
  /**
   * Columns the transition stamps, beyond the status itself.
   *
   * Named here rather than in a switch inside the engine so a new transition
   * cannot quietly forget to record when it happened.
   */
  timestamps?: Array<
    | 'submittedAt'
    | 'approvedAt'
    | 'offerIssuedAt'
    | 'offerExpiresAt'
    | 'seatConfirmedAt'
    | 'deferredAt'
    | 'withdrawnAt'
    | 'rejectedAt'
    | 'cancelledAt'
  >;
  /** Whether the acting user is recorded on a dedicated column. */
  actorColumn?: 'approvedBy' | 'rejectedBy';
  /** The domain event, written to the outbox inside the transaction. */
  event: string;
  /** Raised audit severity for the exceptional paths. */
  severity?: 'WARN';
  /**
   * Only the system may invoke this. Keeps the expiry sweep out of the
   * human-facing action surface while still routing it through the engine.
   */
  systemOnly?: boolean;
  /**
   * Only the operation that owns this transition may invoke it, and never the
   * generic workflow endpoint.
   *
   * Distinct from `systemOnly`, which is about *who* is acting. This is about
   * *what else must already have happened*: the status change is the last step
   * of a larger transaction, and on its own it would record an outcome the rest
   * of the database does not support.
   */
  orchestratedOnly?: boolean;
}

/**
 * Every legal edge.
 *
 * `SEAT_CONFIRMED → ADMITTED` is the one `orchestratedOnly` edge: it is
 * reachable only through `AdmissionConversionService` (`admit` and, for the
 * SIMPLE_ADMISSION profile, `directAdmit`), never through the generic
 * workflow endpoint.
 *
 * Workflow profiles and policy switches add *guards* to these rows; they
 * never add, remove or redirect an edge.
 */
export const TRANSITIONS: readonly TransitionRule[] = [
  {
    action: WorkflowAction.SUBMIT,
    from: [S.DRAFT],
    to: S.SUBMITTED,
    permission: PERMISSIONS.Admissions.Update,
    remarks: 'OPTIONAL',
    // Documents owed at DRAFT or SUBMITTED. Before this guard existed a
    // requirement at either stage was accepted and never checked.
    guards: ['DOCUMENT_CHECKLIST_SATISFIED'],
    timestamps: ['submittedAt'],
    event: 'applicant.submitted',
  },
  {
    action: WorkflowAction.START_REVIEW,
    from: [S.SUBMITTED],
    to: S.UNDER_REVIEW,
    permission: PERMISSIONS.Admissions.Update,
    remarks: 'OPTIONAL',
    guards: ['VERIFIED_REVIEW_CHECKLIST'],
    event: 'applicant.review_started',
  },
  {
    action: WorkflowAction.REQUEST_DOCUMENTS,
    from: [S.UNDER_REVIEW],
    to: S.DOCUMENT_PENDING,
    permission: PERMISSIONS.Admissions.Update,
    remarks: 'REQUIRED',
    guards: ['DOCUMENT_REQUEST_ENABLED'],
    event: 'applicant.documents_requested',
  },
  {
    action: WorkflowAction.DOCUMENTS_RECEIVED,
    from: [S.DOCUMENT_PENDING],
    to: S.UNDER_REVIEW,
    permission: PERMISSIONS.Admissions.Update,
    remarks: 'OPTIONAL',
    guards: ['DOCUMENT_CHECKLIST_SATISFIED'],
    event: 'applicant.documents_received',
  },
  {
    action: WorkflowAction.REQUEST_FEE,
    from: [S.UNDER_REVIEW],
    to: S.FEE_PENDING,
    permission: PERMISSIONS.Admissions.Update,
    remarks: 'OPTIONAL',
    guards: ['FEE_STEP_ENABLED'],
    event: 'applicant.fee_requested',
  },
  {
    action: WorkflowAction.WAITLIST,
    from: [S.UNDER_REVIEW],
    to: S.WAITLISTED,
    permission: PERMISSIONS.Admissions.Approve,
    remarks: 'REQUIRED',
    guards: ['WAITLIST_ENABLED'],
    event: 'applicant.waitlisted',
  },
  {
    // The offer. Not "a student now exists" — that is Phase 5.
    action: WorkflowAction.APPROVE,
    from: [S.UNDER_REVIEW, S.DOCUMENT_PENDING, S.FEE_PENDING, S.WAITLISTED],
    to: S.APPROVED,
    permission: PERMISSIONS.Admissions.Approve,
    remarks: 'OPTIONAL',
    guards: ['DOCUMENT_CHECKLIST_SATISFIED', 'DISTINCT_REVIEWER'],
    timestamps: ['approvedAt', 'offerIssuedAt', 'offerExpiresAt'],
    actorColumn: 'approvedBy',
    event: 'applicant.offer_issued',
  },
  {
    action: WorkflowAction.CONFIRM_SEAT,
    from: [S.APPROVED],
    to: S.SEAT_CONFIRMED,
    permission: PERMISSIONS.Admissions.Update,
    remarks: 'OPTIONAL',
    // Documents owed at APPROVED or SEAT_CONFIRMED — the latter had no check
    // anywhere before this guard.
    guards: ['OFFER_NOT_EXPIRED', 'DOCUMENT_CHECKLIST_SATISFIED'],
    timestamps: ['seatConfirmedAt'],
    event: 'applicant.seat_confirmed',
  },
  {
    action: WorkflowAction.DEFER,
    from: [S.APPROVED],
    to: S.DEFERRED,
    permission: PERMISSIONS.Admissions.Approve,
    remarks: 'REQUIRED',
    guards: ['DEFERMENT_ENABLED'],
    timestamps: ['deferredAt'],
    event: 'applicant.deferred',
  },
  {
    // The scheduled sweep runs through the engine like everything else, so an
    // expiry is locked, validated, historied and evented exactly as a human
    // action is. A job that wrote the status directly would be the one path
    // with no audit trail.
    action: WorkflowAction.EXPIRE_OFFER,
    from: [S.APPROVED],
    to: S.CANCELLED,
    permission: PERMISSIONS.Admissions.Approve,
    remarks: 'OPTIONAL',
    guards: ['OFFER_EXPIRED'],
    timestamps: ['cancelledAt'],
    event: 'applicant.offer_expired',
    systemOnly: true,
  },
  {
    action: WorkflowAction.REJECT,
    from: [
      S.SUBMITTED,
      S.UNDER_REVIEW,
      S.DOCUMENT_PENDING,
      S.FEE_PENDING,
      S.WAITLISTED,
    ],
    to: S.REJECTED,
    permission: PERMISSIONS.Admissions.Reject,
    remarks: 'REQUIRED',
    timestamps: ['rejectedAt'],
    actorColumn: 'rejectedBy',
    event: 'applicant.rejected',
  },
  {
    // Applicant-initiated. Kept distinct from CANCELLED because who walked away
    // changes the refund and the reporting.
    action: WorkflowAction.WITHDRAW,
    from: [
      S.DRAFT,
      S.SUBMITTED,
      S.UNDER_REVIEW,
      S.DOCUMENT_PENDING,
      S.FEE_PENDING,
      S.WAITLISTED,
      S.APPROVED,
      S.SEAT_CONFIRMED,
    ],
    to: S.WITHDRAWN,
    permission: PERMISSIONS.Admissions.Update,
    remarks: 'REQUIRED',
    timestamps: ['withdrawnAt'],
    event: 'applicant.withdrawn',
  },
  {
    // Institution-initiated.
    action: WorkflowAction.CANCEL,
    from: [
      S.DRAFT,
      S.SUBMITTED,
      S.UNDER_REVIEW,
      S.DOCUMENT_PENDING,
      S.FEE_PENDING,
      S.WAITLISTED,
      S.APPROVED,
      S.SEAT_CONFIRMED,
    ],
    to: S.CANCELLED,
    permission: PERMISSIONS.Admissions.Approve,
    remarks: 'REQUIRED',
    timestamps: ['cancelledAt'],
    event: 'applicant.cancelled',
  },
  {
    // The last edge in the machine, and the only one that is not a status
    // change at all. By the time it runs, a Student, an Admission and an
    // Enrollment already exist in the same transaction; this records that the
    // application has done its job. `orchestratedOnly` is what stops anyone
    // reaching ADMITTED through `POST /workflow/transition` and creating an
    // admitted applicant with nothing behind them.
    action: WorkflowAction.ADMIT,
    from: [S.SEAT_CONFIRMED],
    to: S.ADMITTED,
    // Both are required, and the orchestrator checks `student.create` itself:
    // creating a learner identity is a bigger power than approving a form.
    permission: PERMISSIONS.Admissions.Approve,
    remarks: 'OPTIONAL',
    // Documents owed at SEAT_CONFIRMED or ADMITTED. Runs inside the admit
    // transaction, under the applicant lock, after the student rows are
    // written — so a refusal rolls all of them back.
    guards: ['DOCUMENT_CHECKLIST_SATISFIED'],
    event: 'applicant.admitted',
    orchestratedOnly: true,
  },
  {
    // The single reopenable terminal state, and the only break-glass edge.
    // REJECTED, WITHDRAWN and ADMITTED stay closed: the first two are
    // decisions with consequences already communicated, and the third has a
    // student behind it.
    action: WorkflowAction.FORCE_REOPEN,
    from: [S.CANCELLED],
    to: S.UNDER_REVIEW,
    permission: PERMISSIONS.Admissions.Approve,
    remarks: 'REQUIRED',
    event: 'applicant.force_reopened',
    severity: 'WARN',
  },
];

/** Terminal for the application: no rule leads out of these. */
export const TERMINAL_STATES: readonly S[] = [
  S.ADMITTED,
  S.REJECTED,
  S.WITHDRAWN,
];

const BY_ACTION = new Map<WorkflowAction, TransitionRule>(
  TRANSITIONS.map((t) => [t.action, t]),
);

export function findRule(action: WorkflowAction): TransitionRule | undefined {
  return BY_ACTION.get(action);
}

/**
 * Every action legal from a state — what a UI enables, and nothing more.
 *
 * Orchestrated actions are included: `admit` genuinely is what a registrar
 * clicks from `SEAT_CONFIRMED`, and hiding it would make the one action they
 * need invisible. What the flag governs is which *endpoint* may perform it, not
 * whether it is offered.
 */
export function actionsFrom(state: S): WorkflowAction[] {
  return TRANSITIONS.filter((t) => t.from.includes(state) && !t.systemOnly).map(
    (t) => t.action,
  );
}

/**
 * States with no outbound rule.
 *
 * Computed rather than listed, so the exhaustiveness test compares the table
 * against the enum instead of against a second hand-written list that could
 * drift from it.
 */
export function statesWithNoExit(): S[] {
  return Object.values(S).filter((state) => actionsFrom(state).length === 0);
}

/**
 * Every stage a document requirement can be enforced at: the union of `from`
 * and `to` over the rules that carry `DOCUMENT_CHECKLIST_SATISFIED`, because
 * the engine evaluates requirements at `[current, target]`.
 *
 * Documents keeps its own copy (`ENFORCEABLE_REQUIREMENT_STAGES`) so the
 * module dependency runs one way; a unit test asserts they are equal.
 */
export function checklistEnforcedStages(): S[] {
  const stages = new Set<S>();
  for (const rule of TRANSITIONS) {
    if (!rule.guards?.includes('DOCUMENT_CHECKLIST_SATISFIED')) continue;
    rule.from.forEach((state) => stages.add(state));
    stages.add(rule.to);
  }
  return Object.values(S).filter((state) => stages.has(state));
}

/**
 * The existing edges a SIMPLE_ADMISSION direct admission walks, by the state
 * it starts from.
 *
 * Not a shortcut: every step is an ordinary rule run through the engine on
 * one transaction — permission, guards, timestamps, history and event each
 * time — and `admit` follows on the same transaction. A state not listed here
 * (a detour that cannot reach `SEAT_CONFIRMED` directly, or a terminal state)
 * cannot be directly admitted. A unit test asserts every consecutive pair is
 * a legal edge.
 */
export const DIRECT_ADMISSION_PLAN: Readonly<
  Partial<Record<S, readonly WorkflowAction[]>>
> = {
  [S.DRAFT]: [
    WorkflowAction.SUBMIT,
    WorkflowAction.START_REVIEW,
    WorkflowAction.APPROVE,
    WorkflowAction.CONFIRM_SEAT,
  ],
  [S.SUBMITTED]: [
    WorkflowAction.START_REVIEW,
    WorkflowAction.APPROVE,
    WorkflowAction.CONFIRM_SEAT,
  ],
  [S.UNDER_REVIEW]: [WorkflowAction.APPROVE, WorkflowAction.CONFIRM_SEAT],
  [S.DOCUMENT_PENDING]: [WorkflowAction.APPROVE, WorkflowAction.CONFIRM_SEAT],
  [S.FEE_PENDING]: [WorkflowAction.APPROVE, WorkflowAction.CONFIRM_SEAT],
  [S.WAITLISTED]: [WorkflowAction.APPROVE, WorkflowAction.CONFIRM_SEAT],
  [S.APPROVED]: [WorkflowAction.CONFIRM_SEAT],
  [S.SEAT_CONFIRMED]: [],
};
