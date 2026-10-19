/**
 * Public surface of the Branch module.
 *
 * Scope: `/branches` — the campuses inside an organization. All seven
 * documented endpoints are wired: create, list, list-by-organization, read,
 * update, the status toggle, and the documented soft delete.
 *
 * Three contract facts shape the module, and all three are visible in the UI:
 *
 * 1. **No endpoint documents a query parameter**, so search, filter, sort and
 *    paging happen in the client, and the directory says so.
 * 2. **The list returns active branches only**, so no screen reports a
 *    platform-wide total or a deleted count as if it knew one.
 * 3. **The status toggle takes no request body**, so it flips `isActive`
 *    rather than setting it. That makes it non-idempotent: it is confirmed
 *    before firing, never retried, never optimistic, and withheld entirely
 *    when the current state was not reported.
 *
 * **Branch Settings has no backend at all.** Every documented branch endpoint
 * operates on the branch record; none has `settings` in its path. Four of the
 * five settings sections therefore ship as layout with the shared Backend
 * Pending components and **no service methods** — a fake service would be a lie
 * that later has to be unpicked. History is the exception and is the real audit
 * trail, composed at the route.
 */

// Guide
export { branchesGuide } from "./guide/branches.guide";

// Screens
export { BranchDashboardScreen } from "./components/branch-dashboard-screen";
export type { BranchDashboardScreenProps } from "./components/branch-dashboard-screen";
export { BranchDirectoryScreen } from "./components/branch-directory-screen";
export { BranchDetailsScreen } from "./components/branch-details-screen";
export type { BranchDetailsScreenProps } from "./components/branch-details-screen";
export { CreateBranchScreen } from "./components/create-branch-screen";
export {
  EditBranchScreen,
  type EditBranchScreenProps,
} from "./components/edit-branch-screen";
export {
  BranchLifecycleScreen,
  type BranchLifecycleScreenProps,
} from "./components/branch-lifecycle-screen";

// Settings screens
export {
  BranchAcademicSettingsScreen,
  BranchCommunicationSettingsScreen,
  BranchGeneralSettingsScreen,
  BranchIntegrationsSettingsScreen,
  BranchSettingsDashboardScreen,
  type BranchSettingsScreenProps,
} from "./settings/branch-settings-screens";
export {
  BRANCH_SETTINGS_SECTIONS,
  type BranchSettingsSection,
} from "./settings/settings-sections";
export {
  PendingSettingsGroup,
  type PendingField,
  type PendingSettingsGroupProps,
} from "./settings/pending-settings-form";

// Composable pieces
export {
  BranchBoundary,
  type BranchBoundaryProps,
} from "./components/branch-boundary";
export { BranchForm, type BranchFormProps } from "./components/branch-form";
export {
  BranchesTable,
  type BranchesTableProps,
} from "./components/branches-table";
export {
  BranchStatusBadge,
  type BranchStatusBadgeProps,
} from "./components/branch-status-badge";
export {
  DeleteBranchDialog,
  ToggleBranchStatusDialog,
  type DeleteBranchDialogProps,
  type ToggleBranchStatusDialogProps,
} from "./components/branch-dialogs";

// Backend integration
export { branchService } from "./api/branch.service";
export { branchKeys } from "./api/branch.keys";
export {
  filterBranches,
  useBranch,
  useBranches,
  useBranchesByOrganization,
  useCreateBranch,
  useDeleteBranch,
  useToggleBranchStatus,
  useUpdateBranch,
  type BranchFilters,
} from "./hooks/use-branches";
export {
  formatAffiliation,
  formatBranchAddress,
  toBranchFormValues,
  toBranchRequest,
} from "./mappers/branch.mapper";
export {
  BRANCH_LIFECYCLE_STAGES,
  SUPPORTED_BRANCH_STAGES,
  isCurrentBranchStage,
  nextToggleAction,
  type BranchLifecycleStage,
} from "./utils/branch-lifecycle";

// Contracts
export {
  AFFILIATION_TYPES,
  INSTITUTION_TYPES,
  STRUCTURE_MODES,
  type AffiliationType,
  type BranchDto,
  type CreateBranchRequest,
  type InstitutionType,
  type StructureMode,
  type UpdateBranchRequest,
} from "./types/branch.dto";
export {
  NO_AFFILIATION,
  branchFormDefaults,
  branchFormSchema,
  type BranchFormValues,
} from "./schemas/branch.schema";
export {
  AFFILIATION_TYPE_LABELS,
  ANY_STATE,
  ANY_TYPE,
  BRANCH_AUDIT_MODULE,
  BRANCH_STATE_PRESENTATION,
  DIRECTORY_PAGE_SIZE,
  INSTITUTION_TYPE_OPTIONS,
  INSTITUTION_TYPE_PRESENTATION,
  STATE_FILTER_OPTIONS,
  STRUCTURE_MODE_OPTIONS,
  STRUCTURE_MODE_PRESENTATION,
  branchState,
  type BranchState,
} from "./constants";
