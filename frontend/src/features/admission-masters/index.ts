/**
 * Public surface of the Admission Masters module.
 *
 * Scope: the 10 branch-scoped reference-data resources under
 * `/v1/admissions/masters/*` — Admission Sources, Categories, Castes,
 * Religions, Genders, Languages, Blood Groups, Disabilities, Relation Types
 * and Quotas. All five documented operations (list, get, create, update, soft
 * delete) are wired for every one of them.
 *
 * **Config-driven, not templated.** `ADMISSION_MASTER_REGISTRY` is the one
 * place the 10 resources differ; every service, hook and screen below takes a
 * resource string or an `AdmissionMasterConfig`, so adding an eleventh master
 * — should the backend ever ship one — means one registry entry, not a new
 * feature folder.
 *
 * Three contract facts shape the module, and all three are visible in the UI:
 *
 * 1. **`includeInactive` is the only query parameter any of the 10 list
 *    endpoints documents** (and it is marked Required), so search, filter,
 *    sort and paging all happen in the client, and the directory says so.
 * 2. **There is no dedicated status-toggle endpoint**, unlike branch,
 *    academic-year or academic-unit. The only mutation past create is the
 *    generic `PATCH /:id`, whose documented body is the complete record — so
 *    activating/deactivating resends the whole record with `isActive`
 *    flipped rather than a partial body.
 * 3. **`DELETE` is a documented soft delete** ("Soft delete X" in every one of
 *    the 10 Postman folders) with no restore endpoint documented anywhere —
 *    so Delete and Deactivate are two distinct, separately confirmed actions,
 *    and the delete dialog never claims the data is destroyed.
 *
 * **`metadata` is never exposed as a form field.** It is a documented request
 * field, but neither backend document describes its intended use, and
 * exposing raw JSON editing for a field with no product need would be
 * building UI ahead of the contract. It survives edits unchanged (see the
 * mapper) rather than being silently cleared.
 *
 * **No permission constants are invented.** No `admission.masters.*`
 * permission string exists in any backend document or in the Postman
 * collection, and no shipped feature (branch, academic-year, organization)
 * does button-level permission gating — auth/role gating happens once at the
 * `(app)` route-group layout. This module follows the same precedent.
 */

// Screens
export { AdmissionMastersOverviewScreen } from "./components/admission-masters-overview-screen";
export {
  AdmissionMasterListScreen,
  type AdmissionMasterListScreenProps,
} from "./components/admission-master-list-screen";
export {
  CreateAdmissionMasterScreen,
  type CreateAdmissionMasterScreenProps,
} from "./components/create-admission-master-screen";
export {
  EditAdmissionMasterScreen,
  type EditAdmissionMasterScreenProps,
} from "./components/edit-admission-master-screen";
export {
  AdmissionMasterDetailScreen,
  type AdmissionMasterDetailScreenProps,
} from "./components/admission-master-detail-screen";

// Composable pieces
export {
  AdmissionMasterBoundary,
  type AdmissionMasterBoundaryProps,
} from "./components/admission-master-boundary";
export {
  AdmissionMasterForm,
  type AdmissionMasterFormProps,
} from "./components/admission-master-form";
export {
  AdmissionMastersTable,
  type AdmissionMastersTableProps,
} from "./components/admission-master-records-table";
export {
  DeleteAdmissionMasterDialog,
  ToggleAdmissionMasterActiveDialog,
  type DeleteAdmissionMasterDialogProps,
  type ToggleAdmissionMasterActiveDialogProps,
} from "./components/admission-master-dialogs";

// Backend integration
export { createAdmissionMasterService } from "./api/admission-master.service";
export { createAdmissionMasterKeys } from "./api/admission-master.keys";
export { admissionMasterClient } from "./api/admission-master-clients";
export {
  filterAdmissionMasters,
  useAdmissionMaster,
  useAdmissionMasterList,
  useAdmissionMastersBranch,
  useCreateAdmissionMaster,
  useDeleteAdmissionMaster,
  useToggleAdmissionMasterActive,
  useUpdateAdmissionMaster,
  type AdmissionMasterFilters,
} from "./hooks/use-admission-masters";
export {
  toAdmissionMasterFormValues,
  toAdmissionMasterRequest,
  toAdmissionMasterToggleRequest,
} from "./mappers/admission-master.mapper";

// Contracts
export type {
  AdmissionMasterDto,
  AdmissionMasterRequest,
} from "./types/admission-master.dto";
export {
  admissionMasterFormDefaults,
  admissionMasterFormSchema,
  type AdmissionMasterFormValues,
} from "./schemas/admission-master.schema";
export {
  ADMISSION_MASTER_REGISTRY,
  ADMISSION_MASTER_TYPES,
  admissionMasterConfig,
  isAdmissionMasterType,
  type AdmissionMasterConfig,
  type AdmissionMasterType,
} from "./config/admission-master-registry";
export {
  ADMISSION_MASTER_STATE_PRESENTATION,
  ANY_STATUS,
  DIRECTORY_PAGE_SIZE,
  STATUS_FILTER_OPTIONS,
  admissionMasterState,
  type AdmissionMasterState,
} from "./constants";
