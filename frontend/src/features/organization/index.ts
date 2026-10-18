/**
 * Public surface of the Organization module.
 *
 * Scope: `/organizations` — the platform's tenants. All five documented
 * endpoints are wired: create, list, read, update, and the documented soft
 * delete (`DELETE` marks an organization `INACTIVE` rather than removing it,
 * which is why every piece of copy here says "deactivate").
 *
 * Three contract gaps shape the module, and all three are visible in the UI
 * rather than papered over:
 *
 * 1. **The list endpoint documents no query parameters**, so search, filter,
 *    sort and paging happen in the client, and the directory says so.
 * 2. **The list returns `ACTIVE` and `SUSPENDED` organizations** and excludes
 *    `INACTIVE` (E2), so no screen reports a platform-wide total or an
 *    inactive count as if it knew one.
 * 3. **`status` is server-managed** — a documented field of the entity and of
 *    neither request body — so there is no status control anywhere, and the
 *    lifecycle screen marks suspension, reactivation, draft and permanent
 *    deletion as unavailable instead of simulating them.
 *
 * Activity trails come from the audit module through route-level slots, so
 * neither feature imports the other.
 */

// Guide
export { organizationsGuide } from "./guide/organizations.guide";

// Screens
export { OrganizationDashboardScreen } from "./components/organization-dashboard-screen";
export type { OrganizationDashboardScreenProps } from "./components/organization-dashboard-screen";
export { OrganizationDirectoryScreen } from "./components/organization-directory-screen";
export { OrganizationDetailsScreen } from "./components/organization-details-screen";
export type { OrganizationDetailsScreenProps } from "./components/organization-details-screen";
export { CreateOrganizationScreen } from "./components/create-organization-screen";
export {
  EditOrganizationScreen,
  type EditOrganizationScreenProps,
} from "./components/edit-organization-screen";
export {
  OrganizationLifecycleScreen,
  type OrganizationLifecycleScreenProps,
} from "./components/organization-lifecycle-screen";

// Composable pieces
export {
  OrganizationBoundary,
  type OrganizationBoundaryProps,
} from "./components/organization-boundary";
export {
  OrganizationForm,
  type OrganizationFormProps,
} from "./components/organization-form";
export {
  OrganizationsTable,
  type OrganizationsTableProps,
} from "./components/organizations-table";
export {
  OrganizationStatusBadge,
  type OrganizationStatusBadgeProps,
} from "./components/organization-status-badge";
export {
  DeactivateOrganizationDialog,
  type DeactivateOrganizationDialogProps,
} from "./components/deactivate-organization-dialog";

// Backend integration
export { organizationService } from "./api/organization.service";
export { organizationKeys } from "./api/organization.keys";
export {
  filterOrganizations,
  useCreateOrganization,
  useDeactivateOrganization,
  useOrganization,
  useOrganizations,
  useUpdateOrganization,
  type OrganizationFilters,
} from "./hooks/use-organizations";
export {
  formatAddress,
  toDateInput,
  toOrganizationFormValues,
  toOrganizationRequest,
} from "./mappers/organization.mapper";
export {
  EXPIRY_WARNING_DAYS,
  LIFECYCLE_STAGES,
  SUPPORTED_STAGES,
  daysUntilExpiry,
  expiryState,
  isCurrentStage,
  type ExpiryState,
  type LifecycleStage,
} from "./utils/organization-lifecycle";

// Contracts
export {
  ORGANIZATION_STATUSES,
  type CreateOrganizationRequest,
  type OrganizationDto,
  type OrganizationStatus,
  type UpdateOrganizationRequest,
} from "./types/organization.dto";
export {
  organizationFormDefaults,
  organizationFormSchema,
  type OrganizationFormValues,
} from "./schemas/organization.schema";
export {
  ANY_STATUS,
  DIRECTORY_PAGE_SIZE,
  ORGANIZATION_AUDIT_MODULE,
  STATUS_FILTER_OPTIONS,
  STATUS_PRESENTATION,
  statusPresentation,
} from "./constants";
