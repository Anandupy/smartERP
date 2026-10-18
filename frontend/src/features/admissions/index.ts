/**
 * Public surface of the Admissions module.
 *
 * Scope: the Applicant lifecycle — directory, create/edit (Draft only), and
 * the Journey Hub (status, next action, every documented workflow
 * transition, history, and the final admit transaction). Sourced entirely
 * from `docs/admission-lifecycle-module.md`, itself compiled from the
 * backend's own status-tagged reconciliation spec and the Postman
 * collection's confirmed example responses for this module — see that
 * document for the full contract and `docs/backend-gaps.md` §M for the gap
 * ledger.
 *
 * **Guardians and Documents are separate features**
 * (`features/guardians`, `features/documents`), not built here — Guardian
 * and Document are their own backend modules (module doc §5, §6), and the
 * Journey Hub composes them as opaque panels rather than importing either
 * directly (AGENTS.md §7, §28). `ApplicantJourneyHubScreen` takes
 * `guardiansPanel`/`documentsPanel` as `ReactNode` slots for exactly this
 * reason.
 *
 * **Not built anywhere yet**:
 *
 * - **Preferences** (`ApplicantProgramPreference`) — `admit()` never reads
 *   this list (module doc §3.5, §4.9), so it is lower priority.
 * - A dedicated audit-trail screen distinct from workflow history — the
 *   general Audit Logs module (`features/audit`) is not populated for
 *   Applicant mutations (`backend-gaps.md`, admissions-production-audit
 *   findings), so this would need its own honest empty-state design.
 *
 * **Cross-feature seams** (AGENTS.md §28 — never imported directly, always
 * slotted in by the route composition):
 *
 * - `AdmissionMasterPicker` (from `features/admission-masters`) for gender,
 *   religion, caste, category, mother tongue, blood group, disability type,
 *   admission source and quota, and (for Guardians) relation type.
 * - `ProgramPicker` (from `features/program`) for the applicant's programme.
 * - `AcademicUnitPicker` (from `features/academic-unit`) for the section
 *   chosen at the final admit transaction — the one input `admit()` accepts
 *   beyond the applicant's own lineage.
 * - `ApplicantGuardiansPanel` (from `features/guardians`) and
 *   `ApplicantDocumentsPanel` (from `features/documents`).
 *
 * See `src/app/(app)/app/admissions/applicants/applicant-composition.tsx`
 * for where these meet.
 */

// Screens
export {
  ApplicantDirectoryScreen,
} from "./components/applicant-directory-screen";
export {
  CreateApplicantScreen,
  type CreateApplicantScreenProps,
} from "./components/create-applicant-screen";
export {
  EditApplicantScreen,
  type EditApplicantScreenProps,
} from "./components/edit-applicant-screen";
export {
  ApplicantJourneyHubScreen,
  type ApplicantJourneyHubScreenProps,
} from "./components/applicant-journey-hub-screen";

// Composable pieces
export {
  ApplicantBoundary,
  type ApplicantBoundaryProps,
} from "./components/applicant-boundary";
export { ApplicantForm, type ApplicantFormProps } from "./components/applicant-form";
export {
  ApplicantsTable,
  type ApplicantsTableProps,
} from "./components/applicants-table";
export {
  ApplicantStatusBadge,
  type ApplicantStatusBadgeProps,
} from "./components/applicant-status-badge";
export {
  ApplicantWorkflowActions,
  type ApplicantWorkflowActionsProps,
} from "./components/applicant-workflow-actions";
export {
  ApplicantWorkflowTimeline,
  type ApplicantWorkflowTimelineProps,
} from "./components/applicant-workflow-timeline";
export {
  AdmitApplicantDialog,
  type AdmitApplicantDialogProps,
} from "./components/admit-applicant-dialog";

// Backend integration
export { applicantService } from "./api/applicant.service";
export { applicantKeys } from "./api/applicant.keys";
export {
  useApplicant,
  useApplicants,
  useApplicantScope,
  useApplicantWorkflowHistory,
  useApplicantWorkflowTransition,
  useAdmitApplicant,
  useCheckDuplicateApplicants,
  useCreateApplicant,
  useDeleteApplicant,
  useUpdateApplicant,
} from "./hooks/use-applicants";
export {
  formatApplicantAddress,
  toApplicantFormValues,
  toApplicantRequest,
} from "./mappers/applicant.mapper";

export {
  useAdmissionPolicy,
  useApplicantChecklist,
  useApplicantWorkflowActions,
  useClearAdmissionPolicyValue,
  useDirectAdmitApplicant,
  useSetAdmissionPolicyValue,
} from "./hooks/use-workflow-policy";

// Presentation — which actions are legal is the backend's to say
export {
  ACTION_PRESENTATION,
  PROFILE_META,
  STATUS_MEANING,
  describeBlocker,
  nextActionSummary,
  type WorkflowActionPresentation,
} from "./utils/workflow";

// Contracts
export {
  ADMISSION_POLICY_KEYS,
  ADMISSION_WORKFLOW_PROFILES,
  type AdmissionPolicyDto,
  type AdmissionPolicyField,
  type AdmissionWorkflowProfile,
  type ApplicantChecklistDto,
  type ApplicantChecklistItem,
  type ChecklistItemStatus,
  type DirectAdmitApplicantResponse,
  type PolicySource,
  type WorkflowActionAvailability,
  type WorkflowActionBlocker,
  type WorkflowActionsDto,
} from "./types/workflow-policy.dto";
export {
  ADMISSION_APPLICATION_STATUSES,
  WORKFLOW_ACTIONS,
  type AdmissionApplicationStatus,
  type AdmitApplicantRequest,
  type AdmitApplicantResponse,
  type ApplicantDto,
  type ApplicantListPage,
  type ApplicantListQuery,
  type ApplicantRequest,
  type CheckDuplicateApplicantsRequest,
  type CheckDuplicateApplicantsResponse,
  type WorkflowAction,
  type WorkflowHistoryEntry,
  type WorkflowTransitionRequest,
} from "./types/applicant.dto";
export {
  applicantFormDefaults,
  applicantFormSchema,
  type ApplicantFormValues,
} from "./schemas/applicant.schema";
export {
  ANY_STATUS,
  DIRECTORY_PAGE_SIZE,
  STATUS_FILTER_OPTIONS,
  STATUS_LABEL,
  STATUS_TONE,
} from "./constants";
