import type {
  AdmissionApplicationStatus,
  WorkflowAction,
} from "../types/applicant.dto";
import type {
  AdmissionWorkflowProfile,
  WorkflowActionBlocker,
} from "../types/workflow-policy.dto";

/**
 * How each workflow action is *presented* — label, one-line description and
 * styling — and nothing else.
 *
 * Which actions are legal, whether the caller may take them and what blocks
 * them is decided by the backend and read from
 * `GET /admissions/applicants/:id/workflow/actions`
 * (`useApplicantWorkflowActions`). This file used to hold a copy of the
 * transition table and decide that itself; once the process became
 * configurable per branch, a client-side copy could only be wrong, so it was
 * removed. Nothing here may decide that an action is allowed.
 */
export interface WorkflowActionPresentation {
  /** Button label, in the user's terms. */
  label: string;
  /** One line explaining what happens. */
  description: string;
  /** Destructive-styled actions (reject, withdraw, cancel). */
  isDestructive: boolean;
}

export const ACTION_PRESENTATION: Record<
  WorkflowAction,
  WorkflowActionPresentation
> = {
  submit: {
    label: "Submit application",
    description:
      "Files the application and resolves the applicant's identity (Person). This cannot be undone from Draft.",
    isDestructive: false,
  },
  startReview: {
    label: "Start review",
    description: "Moves the application into active review.",
    isDestructive: false,
  },
  requestDocuments: {
    label: "Request documents",
    description: "Marks the application as waiting on paperwork.",
    isDestructive: false,
  },
  documentsReceived: {
    label: "Documents received",
    description: "Returns the application to review.",
    isDestructive: false,
  },
  requestFee: {
    label: "Request fee",
    description: "Marks the application as waiting on an application fee.",
    isDestructive: false,
  },
  waitlist: {
    label: "Waitlist",
    description: "Holds the application pending a seat.",
    isDestructive: false,
  },
  approve: {
    label: "Approve",
    description:
      "Issues an offer and provisionally holds a seat. The application is not yet admitted.",
    isDestructive: false,
  },
  confirmSeat: {
    label: "Confirm seat",
    description:
      "Accepts the offer. This is the only status the final Admit transaction accepts.",
    isDestructive: false,
  },
  defer: {
    label: "Defer",
    description:
      "Holds the offer for a future cycle. Off by default — the server may refuse with 400 DEFERMENT_DISABLED.",
    isDestructive: false,
  },
  reject: {
    label: "Reject",
    description: "Refuses the application. This is final.",
    isDestructive: true,
  },
  withdraw: {
    label: "Withdraw",
    description: "Records that the applicant walked away. This is final.",
    isDestructive: true,
  },
  cancel: {
    label: "Cancel",
    description:
      "Ends the application on the institution's decision, not the applicant's.",
    isDestructive: true,
  },
  forceReopen: {
    label: "Force reopen",
    description:
      "Reopens a cancelled application. Recorded with elevated audit severity — use only when genuinely required.",
    isDestructive: false,
  },
};

/** Display metadata for each workflow profile. */
export const PROFILE_META: Record<
  AdmissionWorkflowProfile,
  { label: string; description: string }
> = {
  SIMPLE_ADMISSION: {
    label: "Simple admission",
    description:
      "Register the student, choose the section and admit in one step. Review, offer and seat confirmation are recorded automatically.",
  },
  STANDARD_ADMISSION: {
    label: "Standard admission",
    description:
      "Submit, review, issue an offer, confirm the seat, then admit.",
  },
  VERIFIED_ADMISSION: {
    label: "Verified admission",
    description:
      "The standard process, with documents verified before review and a different person approving than the one who reviewed.",
  },
};

/**
 * A blocking condition in the user's terms. The backend's own message is the
 * fallback, so a code this file does not know is still explained.
 */
export function describeBlocker(blocker: WorkflowActionBlocker): string {
  switch (blocker.code) {
    case "DOCUMENTS_INCOMPLETE": {
      const names = blocker.missing?.map((m) => m.name) ?? [];
      return names.length > 0
        ? `Waiting for verified documents: ${names.join(", ")}.`
        : "Waiting for every mandatory document to be verified.";
    }
    case "POLICY_DISABLED":
    case "DEFERMENT_DISABLED":
      return "This step is turned off for this branch's admission process.";
    case "MAKER_CHECKER_VIOLATION":
      return "You started this review, so a different person must approve it.";
    case "OFFER_EXPIRED":
      return "The offer has expired and can no longer be confirmed.";
    default:
      return blocker.message;
  }
}

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
