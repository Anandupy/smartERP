/**
 * Wire shapes for `/v1/admissions/applicants` and the workflow/admit
 * endpoints that operate on one.
 *
 * Sourced entirely from `docs/admission-lifecycle-module.md` — itself
 * compiled from `backend/docs/planning/core-admission-lifecycle-specification.md`
 * (a status-tagged reconciliation against backend source) and the Postman
 * collection's confirmed, non-placeholder example bodies for this module.
 * Nothing here is inferred from a Stitch design or invented to fill a screen
 * — see AGENTS.md §28.
 */

/**
 * The thirteen documented applicant states — `docs/admission-lifecycle-module.md`
 * §4.2. `APPROVED` is **not** terminal; it means "offer made, seat
 * provisionally held". `ADMITTED` is the only true terminal success state.
 */
export const ADMISSION_APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "DOCUMENT_PENDING",
  "FEE_PENDING",
  "WAITLISTED",
  "APPROVED",
  "SEAT_CONFIRMED",
  "DEFERRED",
  "ADMITTED",
  "REJECTED",
  "WITHDRAWN",
  "CANCELLED",
] as const;

export type AdmissionApplicationStatus =
  (typeof ADMISSION_APPLICATION_STATUSES)[number];

/**
 * The documented workflow action verbs — `docs/admission-lifecycle-module.md`
 * §4.3. The caller always names an action, never a target status: the engine
 * owns where each one leads.
 */
export const WORKFLOW_ACTIONS = [
  "submit",
  "startReview",
  "requestDocuments",
  "documentsReceived",
  "requestFee",
  "waitlist",
  "approve",
  "confirmSeat",
  "defer",
  "reject",
  "withdraw",
  "cancel",
  "forceReopen",
] as const;

export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

/**
 * An applicant record, as `POST`/`GET`/`PATCH`/the workflow-transition
 * response all confirm it (43 request fields + 21 server-owned fields — see
 * the module doc §3.2).
 *
 * `personId` is not present in any captured Postman example, though it is
 * `VERIFIED` bound at `SUBMIT` and required from `SUBMITTED` onward at the
 * database level (module doc §3.2, AP2) — typed optional here so a present
 * value is used, and an absent one degrades to "not yet resolved" rather than
 * throwing.
 */
export interface ApplicantDto {
  id: string;
  organizationId: string;
  branchId: string;
  academicYearId: string;

  // Identity resolution — see the note above.
  personId?: string | null;

  // Basic information
  firstName: string;
  middleName: string | null;
  lastName: string;
  dob: string;
  genderId: string | null;
  birthPlace: string | null;
  photoFileId: string | null;
  religionId: string | null;
  casteId: string | null;
  categoryId: string | null;
  motherTongueId: string | null;
  bloodGroupId: string | null;
  disabilityStatus: boolean | null;
  disabilityTypeId: string | null;
  disabilityNotes: string | null;

  /**
   * Plaintext today — `docs/backend-gaps.md` AP3. Never log, never persist
   * beyond the single form round-trip, never render after save.
   */
  aadhaarNo: string | null;
  penNo: string | null;
  apaarId: string | null;

  // Contact
  primaryMobile: string;
  alternateMobile: string | null;
  primaryEmail: string | null;

  /**
   * The applicant's declared address — an inline, frozen legal snapshot, not
   * a mutable `PersonAddress`. Never silently converted into one (module doc
   * §10 corrects an earlier baseline; the address module ships separately,
   * scoped to `Person`).
   */
  currentAddressLine1: string;
  currentAddressLine2: string | null;
  city: string;
  district: string | null;
  state: string;
  country: string;
  pincode: string;

  // Previous education
  previousSchoolName: string | null;
  previousBoard: string | null;
  previousClass: string | null;
  previousPercentage: number | null;
  tcNumber: string | null;

  // Application context
  admissionSourceId: string | null;
  quotaId: string | null;
  programId: string;

  // Remarks / operational
  internalRemarks: string | null;
  counsellorRemarks: string | null;
  assignedCounsellorId: string | null;
  transportRequired: boolean | null;
  hostelRequired: boolean | null;
  customFieldData: Record<string, unknown> | null;
  checklistStatus: unknown;
  tags: string[] | null;
  formTemplateVersion: string | null;

  // Server-owned
  admissionFormNo: string | null;
  applicationNo: string | null;
  displayName: string;
  admissionStatus: AdmissionApplicationStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  approvedBy: string | null;
  rejectedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  /**
   * Present only on `GET /admissions/applicants/:id` — the detail read
   * expands FK ids into nested objects. List, create, update and workflow
   * transitions do not include these.
   */
  gender?: unknown;
  religion?: unknown;
  caste?: unknown;
  category?: unknown;
  motherTongue?: unknown;
  bloodGroup?: unknown;
  disabilityType?: unknown;
  admissionSource?: unknown;
  quota?: unknown;
  guardians?: unknown;
}

/**
 * Body for `POST /v1/admissions/applicants` and `PATCH .../:id` — the exact
 * 43 fields the Postman collection documents, no more. `PATCH` sends the
 * identical full body; no partial-update rule is documented (module doc
 * §3.2).
 */
export interface ApplicantRequest {
  firstName: string;
  middleName: string | null;
  lastName: string;
  dob: string;
  genderId: string | null;
  birthPlace: string | null;
  photoFileId: string | null;
  religionId: string | null;
  casteId: string | null;
  categoryId: string | null;
  motherTongueId: string | null;
  bloodGroupId: string | null;
  disabilityStatus: boolean | null;
  disabilityTypeId: string | null;
  disabilityNotes: string | null;
  aadhaarNo: string | null;
  penNo: string | null;
  apaarId: string | null;
  primaryMobile: string;
  alternateMobile: string | null;
  primaryEmail: string | null;
  currentAddressLine1: string;
  currentAddressLine2: string | null;
  city: string;
  district: string | null;
  state: string;
  country: string;
  pincode: string;
  previousSchoolName: string | null;
  previousBoard: string | null;
  previousClass: string | null;
  previousPercentage: number | null;
  tcNumber: string | null;
  admissionSourceId: string | null;
  quotaId: string | null;
  programId: string;
  internalRemarks: string | null;
  counsellorRemarks: string | null;
  assignedCounsellorId: string | null;
  transportRequired: boolean | null;
  hostelRequired: boolean | null;
  customFieldData: Record<string, unknown> | null;
  checklistStatus: unknown;
  tags: string[] | null;
  formTemplateVersion: string | null;
}

/**
 * Query for `GET /v1/admissions/applicants`. Real server-side parameters —
 * unlike branch, academic-year, program, academic-unit and admission
 * masters, this endpoint documents genuine search/filter/sort/paging (module
 * doc §3.3).
 */
export interface ApplicantListQuery {
  search?: string;
  status?: AdmissionApplicationStatus;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * `GET /v1/admissions/applicants` nests its pagination **inside** `data` as
 * `{ items, meta }` — the same convention already pinned for Audit Logs
 * (`backend-gaps.md` D4) — rather than the envelope's own `meta.pagination`.
 */
export interface ApplicantListPage {
  items: ApplicantDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/** Body for `POST /admissions/applicants/:applicantId/workflow/transition`. */
export interface WorkflowTransitionRequest {
  action: WorkflowAction;
  /** Required for some actions (see `utils/workflow.ts`), optional for others. */
  remarks?: string;
}

/**
 * One row from `GET .../workflow/history` — `WorkflowHistoryDto` in the
 * OpenAPI document (the Postman example is an unexpanded placeholder, so the
 * schema is the source). The event time is **`timestamp`**; there is no
 * `createdAt` on a history row. Fields stay optional so a row that lacks one
 * degrades to an honest gap rather than a crash.
 */
export interface WorkflowHistoryEntry {
  id?: string;
  oldStatus?: AdmissionApplicationStatus | null;
  newStatus?: AdmissionApplicationStatus;
  actionType?: string;
  remarks?: string | null;
  /** A user id, or `SYSTEM` for the scheduled sweep. Never a name. */
  actionBy?: string | null;
  /** ISO 8601 date-time the transition was recorded. */
  timestamp?: string;
  [key: string]: unknown;
}

/** Body for `POST /admissions/applicants/:applicantId/admit`. */
export interface AdmitApplicantRequest {
  academicUnitId: string;
  /** Defaults to `REGULAR` server-side. Restricted to first-entry types. */
  admissionType?: "REGULAR" | "LATERAL_ENTRY" | "RTE";
  /** ISO date. Defaults to now server-side. */
  admissionDate?: string;
  remarks?: string;
}

/**
 * The complete `/admit` response — exactly six identifiers, nothing else
 * (module doc §8.6). Each has a distinct scope; none substitutes for another.
 */
export interface AdmitApplicantResponse {
  studentId: string;
  studentCode: string;
  admissionId: string;
  admissionNo: string;
  enrollmentId: string;
  applicantId: string;
}

/** Body for `POST /admissions/applicants/check-duplicates`. Advisory only. */
export interface CheckDuplicateApplicantsRequest {
  aadhaarNo?: string;
  primaryMobile?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
}

/**
 * Response shape is not expanded beyond a leaf placeholder in the captured
 * example — `matches`' field list is unconfirmed.
 */
export interface CheckDuplicateApplicantsResponse {
  hasDuplicates: boolean;
  matches: unknown[];
}
