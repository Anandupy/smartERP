import type {
  AdmissionApplicationStatus,
  AdmitApplicantResponse,
  WorkflowAction,
} from "./applicant.dto";

/**
 * Configurable admission workflow contracts — `backend/docs/modules/admissions.md`
 * ("Configurable admission workflows") and the Swagger DTOs
 * `AdmissionPolicyDto`, `WorkflowActionsDto`, `ApplicantChecklistDto` and
 * `DirectAdmitResultDto`. Every field below is documented there; nothing is
 * inferred.
 */

export const ADMISSION_WORKFLOW_PROFILES = [
  "SIMPLE_ADMISSION",
  "STANDARD_ADMISSION",
  "VERIFIED_ADMISSION",
] as const;

export type AdmissionWorkflowProfile =
  (typeof ADMISSION_WORKFLOW_PROFILES)[number];

/** Which tier answered a policy value. */
export type PolicySource = "BRANCH" | "ORGANIZATION" | "SYSTEM" | "DEFAULT";

/** `GET /admissions/workflow/policy` — the policy in force for the active branch. */
export interface AdmissionPolicyDto {
  workflowProfile: AdmissionWorkflowProfile;
  offerValidityDays: number;
  allowDeferment: boolean;
  waitlistEnabled: boolean;
  feeStepEnabled: boolean;
  documentRequestEnabled: boolean;
  sources: Record<AdmissionPolicyField, PolicySource>;
  asOf: string;
}

export type AdmissionPolicyField =
  | "workflowProfile"
  | "offerValidityDays"
  | "allowDeferment"
  | "waitlistEnabled"
  | "feeStepEnabled"
  | "documentRequestEnabled";

/** The configuration key behind each policy field (backend `config.registry.ts`). */
export const ADMISSION_POLICY_KEYS: Record<AdmissionPolicyField, string> = {
  workflowProfile: "admissions.workflow_profile",
  offerValidityDays: "admissions.offer_validity_days",
  allowDeferment: "admissions.allow_deferment",
  waitlistEnabled: "admissions.waitlist_enabled",
  feeStepEnabled: "admissions.fee_step_enabled",
  documentRequestEnabled: "admissions.document_request_enabled",
};

/** Why an offered action cannot be taken right now — the code the action would fail with. */
export interface WorkflowActionBlocker {
  code: string;
  message: string;
  /** For `DOCUMENTS_INCOMPLETE`: the documents still owed. */
  missing?: Array<{ documentTypeId: string; code: string; name: string }>;
}

export interface WorkflowActionAvailability {
  /** `admit` is never sent to the transition endpoint (`via: "ADMIT"`). */
  action: WorkflowAction | "admit";
  to: AdmissionApplicationStatus;
  remarks: "REQUIRED" | "OPTIONAL";
  permitted: boolean;
  blockedBy: WorkflowActionBlocker[];
  available: boolean;
  via: "TRANSITION" | "ADMIT";
}

/** `GET /admissions/applicants/:id/workflow/actions`. */
export interface WorkflowActionsDto {
  applicantId: string;
  status: AdmissionApplicationStatus;
  profile: AdmissionWorkflowProfile;
  policyAsOf: string;
  actions: WorkflowActionAvailability[];
  directAdmission: {
    offered: boolean;
    fromCurrentState: boolean;
    permitted: boolean;
    available: boolean;
  };
}

export type ChecklistItemStatus =
  "VERIFIED" | "PENDING_VERIFICATION" | "REJECTED" | "MISSING";

export interface ApplicantChecklistItem {
  requirementId: string;
  documentTypeId: string;
  code: string;
  name: string;
  requiredByStage: AdmissionApplicationStatus;
  isMandatory: boolean;
  branchId: string | null;
  status: ChecklistItemStatus;
  documentId: string | null;
  satisfied: boolean;
}

/** `GET /admissions/applicants/:id/checklist`. */
export interface ApplicantChecklistDto {
  applicantId: string;
  status: AdmissionApplicationStatus;
  items: ApplicantChecklistItem[];
  outstandingMandatory: number;
}

/** `POST /admissions/applicants/:id/direct-admit` — the admit result plus the steps walked. */
export interface DirectAdmitApplicantResponse extends AdmitApplicantResponse {
  walked: WorkflowAction[];
}

/** Body for `PUT /config/values/:key`. The scope id is never sent — it is the active scope. */
export interface SetConfigValueRequest {
  scopeType: "ORGANIZATION" | "BRANCH";
  value: string | number | boolean;
  reason: string;
}

/** Body for `DELETE /config/values/:key`. */
export interface ClearConfigValueRequest {
  scopeType: "ORGANIZATION" | "BRANCH";
  reason: string;
}
