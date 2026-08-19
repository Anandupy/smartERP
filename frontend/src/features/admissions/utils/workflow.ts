import type {
  AdmissionApplicationStatus,
  WorkflowAction,
} from "../types/applicant.dto";

/**
 * The applicant workflow, transcribed field-for-field from
 * `docs/admission-lifecycle-module.md` §4.2–§4.8, itself `VERIFIED` against
 * `backend/docs/planning/core-admission-lifecycle-specification.md` §7.
 *
 * **This is the single source of truth for every status-driven action in the
 * module.** No screen invents its own action list — every button a user can
 * see comes from `actionsFor()` below, so the UI can never offer a transition
 * the backend would refuse with `400 INVALID_TRANSITION`.
 *
 * Two rules this file exists to enforce:
 *
 * - The document-checklist guard (`DOCUMENT_CHECKLIST_SATISFIED`) gates only
 *   `documentsReceived` and `approve` — never `submit`, `startReview`,
 *   `requestDocuments`, `confirmSeat` or `admit` (`backend-gaps.md` WF1).
 * - `admit` is reachable only through `POST .../admit`, never through the
 *   generic transition endpoint — it is `orchestratedOnly` and simply does
 *   not appear in this table's actions at all.
 */

export interface WorkflowActionDescriptor {
  action: WorkflowAction;
  /** Button label, in the user's terms. */
  label: string;
  /** One line explaining what happens. */
  description: string;
  /** `true` when the transition endpoint requires a non-blank `remarks`. */
  remarksRequired: boolean;
  /**
   * A guard that may refuse the transition even though it is listed as
   * reachable from this status. Not evaluated client-side — surfaced only so
   * a confirmation dialog can warn before the server does.
   */
  guardNote: string | null;
  /** Destructive-styled actions (reject, withdraw, cancel). */
  isDestructive: boolean;
}

interface TransitionRule {
  from: readonly AdmissionApplicationStatus[];
  to: AdmissionApplicationStatus;
  descriptor: WorkflowActionDescriptor;
}

const TRANSITIONS: readonly TransitionRule[] = [
  {
    from: ["DRAFT"],
    to: "SUBMITTED",
    descriptor: {
      action: "submit",
      label: "Submit application",
      description:
        "Files the application and resolves the applicant's identity (Person). This cannot be undone from Draft.",
      remarksRequired: false,
      guardNote: null,
      isDestructive: false,
    },
  },
  {
    from: ["SUBMITTED"],
    to: "UNDER_REVIEW",
    descriptor: {
      action: "startReview",
      label: "Start review",
      description: "Moves the application into active review.",
      remarksRequired: false,
      guardNote: null,
      isDestructive: false,
    },
  },
  {
    from: ["UNDER_REVIEW"],
    to: "DOCUMENT_PENDING",
    descriptor: {
      action: "requestDocuments",
      label: "Request documents",
      description: "Marks the application as waiting on paperwork.",
      remarksRequired: true,
      guardNote: null,
      isDestructive: false,
    },
  },
  {
    from: ["DOCUMENT_PENDING"],
    to: "UNDER_REVIEW",
    descriptor: {
      action: "documentsReceived",
      label: "Documents received",
      description: "Returns the application to review.",
      remarksRequired: false,
      guardNote:
        "Every mandatory document at this stage must have a verified current version, or the server refuses with 409 DOCUMENTS_INCOMPLETE.",
      isDestructive: false,
    },
  },
  {
    from: ["UNDER_REVIEW"],
    to: "FEE_PENDING",
    descriptor: {
      action: "requestFee",
      label: "Request fee",
      description: "Marks the application as waiting on an application fee.",
      remarksRequired: false,
      guardNote: null,
      isDestructive: false,
    },
  },
  {
    from: ["UNDER_REVIEW"],
    to: "WAITLISTED",
    descriptor: {
      action: "waitlist",
      label: "Waitlist",
      description: "Holds the application pending a seat.",
      remarksRequired: true,
      guardNote: null,
      isDestructive: false,
    },
  },
  {
    from: ["UNDER_REVIEW", "DOCUMENT_PENDING", "FEE_PENDING", "WAITLISTED"],
    to: "APPROVED",
    descriptor: {
      action: "approve",
      label: "Approve",
      description:
        "Issues an offer and provisionally holds a seat. The application is not yet admitted.",
      remarksRequired: false,
      guardNote:
        "Every mandatory document at this stage must have a verified current version, or the server refuses with 409 DOCUMENTS_INCOMPLETE.",
      isDestructive: false,
    },
  },
  {
    from: ["APPROVED"],
    to: "SEAT_CONFIRMED",
    descriptor: {
      action: "confirmSeat",
      label: "Confirm seat",
      description:
        "Accepts the offer. This is the only status the final Admit transaction accepts.",
      remarksRequired: false,
      guardNote:
        "Refused once the offer has expired (409 OFFER_EXPIRED) — the deadline is enforced server-side, not by this screen.",
      isDestructive: false,
    },
  },
  {
    from: ["APPROVED"],
    to: "DEFERRED",
    descriptor: {
      action: "defer",
      label: "Defer",
      description:
        "Holds the offer for a future cycle. Off by default — the server may refuse with 400 DEFERMENT_DISABLED.",
      remarksRequired: true,
      guardNote:
        "Deferment is disabled by default for this institution and may not be available.",
      isDestructive: false,
    },
  },
  {
    from: [
      "SUBMITTED",
      "UNDER_REVIEW",
      "DOCUMENT_PENDING",
      "FEE_PENDING",
      "WAITLISTED",
    ],
    to: "REJECTED",
    descriptor: {
      action: "reject",
      label: "Reject",
      description: "Refuses the application. This is final.",
      remarksRequired: true,
      guardNote: null,
      isDestructive: true,
    },
  },
  {
    from: [
      "DRAFT",
      "SUBMITTED",
      "UNDER_REVIEW",
      "DOCUMENT_PENDING",
      "FEE_PENDING",
      "WAITLISTED",
      "APPROVED",
      "SEAT_CONFIRMED",
    ],
    to: "WITHDRAWN",
    descriptor: {
      action: "withdraw",
      label: "Withdraw",
      description: "Records that the applicant walked away. This is final.",
      remarksRequired: true,
      guardNote: null,
      isDestructive: true,
    },
  },
  {
    from: [
      "DRAFT",
      "SUBMITTED",
      "UNDER_REVIEW",
      "DOCUMENT_PENDING",
      "FEE_PENDING",
      "WAITLISTED",
      "APPROVED",
      "SEAT_CONFIRMED",
    ],
    to: "CANCELLED",
    descriptor: {
      action: "cancel",
      label: "Cancel",
      description:
        "Ends the application on the institution's decision, not the applicant's.",
      remarksRequired: true,
      guardNote: null,
      isDestructive: true,
    },
  },
  {
    from: ["CANCELLED"],
    to: "UNDER_REVIEW",
    descriptor: {
      action: "forceReopen",
      label: "Force reopen",
      description:
        "Reopens a cancelled application. Recorded with elevated audit severity — use only when genuinely required.",
      remarksRequired: true,
      guardNote: null,
      isDestructive: false,
    },
  },
];

/** Meaning and terminality of every status — module doc §4.2. */
export const STATUS_MEANING: Record<
  AdmissionApplicationStatus,
  { label: string; description: string; terminal: boolean }
> = {
  DRAFT: {
    label: "Draft",
    description: "A form somebody is part-way through.",
    terminal: false,
  },
  SUBMITTED: {
    label: "Submitted",
    description: "Filed. The applicant's identity has been resolved.",
    terminal: false,
  },
  UNDER_REVIEW: {
    label: "Under review",
    description: "Being assessed.",
    terminal: false,
  },
  DOCUMENT_PENDING: {
    label: "Document pending",
    description: "Waiting on paperwork.",
    terminal: false,
  },
  FEE_PENDING: {
    label: "Fee pending",
    description: "Waiting on an application fee.",
    terminal: false,
  },
  WAITLISTED: {
    label: "Waitlisted",
    description: "Held pending a seat.",
    terminal: false,
  },
  APPROVED: {
    label: "Approved",
    description: "Offer made, seat provisionally held. Not yet admitted.",
    terminal: false,
  },
  SEAT_CONFIRMED: {
    label: "Seat confirmed",
    description: "Offer accepted — ready for the final admit transaction.",
    terminal: false,
  },
  DEFERRED: {
    label: "Deferred",
    description:
      "Terminal for this cycle. Continues only as a new application in a future year.",
    terminal: true,
  },
  ADMITTED: {
    label: "Admitted",
    description: "The Student, Admission and Enrollment now exist.",
    terminal: true,
  },
  REJECTED: {
    label: "Rejected",
    description: "The institution refused this application.",
    terminal: true,
  },
  WITHDRAWN: {
    label: "Withdrawn",
    description: "The applicant walked away.",
    terminal: true,
  },
  CANCELLED: {
    label: "Cancelled",
    description:
      "The institution ended it, or the offer lapsed. May be reopenable.",
    terminal: true,
  },
};

/**
 * Every action reachable from the given status, over the generic workflow
 * transition endpoint. `ADMITTED` never appears here — it is reached only
 * through the dedicated `/admit` endpoint, never this list.
 */
export function actionsFor(
  status: AdmissionApplicationStatus,
): WorkflowActionDescriptor[] {
  return TRANSITIONS.filter((rule) => rule.from.includes(status)).map(
    (rule) => rule.descriptor,
  );
}

/** Whether `admit()` may be called — the only status it accepts. */
export function isAdmitEligible(status: AdmissionApplicationStatus): boolean {
  return status === "SEAT_CONFIRMED";
}

/**
 * A short, human sentence describing what should happen next — the "next
 * action" the design brief asks for. Purely descriptive; it never claims a
 * document count or a guardian count the caller has not verified.
 */
export function nextActionSummary(status: AdmissionApplicationStatus): string {
  switch (status) {
    case "DRAFT":
      return "Complete the applicant's information, then submit the application.";
    case "SUBMITTED":
      return "Start the review to move this application forward.";
    case "UNDER_REVIEW":
      return "Request documents or a fee, waitlist, or approve the application.";
    case "DOCUMENT_PENDING":
      return "Once every required document is verified, mark documents as received.";
    case "FEE_PENDING":
      return "Waiting on the application fee.";
    case "WAITLISTED":
      return "Held pending a seat. Approve once one becomes available.";
    case "APPROVED":
      return "An offer has been issued. Confirm the seat once the applicant accepts.";
    case "SEAT_CONFIRMED":
      return "Ready for the final admission transaction.";
    case "DEFERRED":
      return "Deferred for this cycle. A new application is needed for a future year.";
    case "ADMITTED":
      return "Admission is complete. The Student, Admission and Enrollment records now exist.";
    case "REJECTED":
      return "This application was refused. A new application may be started if appropriate.";
    case "WITHDRAWN":
      return "The applicant withdrew this application.";
    case "CANCELLED":
      return "This application was cancelled.";
  }
}
