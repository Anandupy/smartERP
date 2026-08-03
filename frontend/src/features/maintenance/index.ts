/**
 * Public surface of the Maintenance module.
 *
 * Scope: `/maintenance-rules` — the scoped, schedulable rules the backend's
 * `MaintenanceGuard` evaluates on every request. Distinct from the
 * installation-wide `maintenanceMode` flag, which belongs to System Settings.
 *
 * Two contract gaps shape this module, and both are visible in the UI rather
 * than papered over:
 *
 * 1. **The list endpoint documents no query parameters**, so search, filtering
 *    and paging happen in the client, and the screen says so.
 * 2. **`GET /maintenance-rules/active/status` documents no response body**, so
 *    its payload is read defensively by `readActiveStatus` and an unreadable
 *    answer is reported as pending rather than assumed to mean "all clear".
 */

// Screens
export { MaintenanceScreen } from "./components/maintenance-screen";
export { CreateRuleScreen } from "./components/create-rule-screen";
export {
  EditRuleScreen,
  type EditRuleScreenProps,
} from "./components/edit-rule-screen";

// Composable pieces
export {
  MaintenanceBanner,
  type MaintenanceBannerProps,
} from "./components/maintenance-banner";
export { MaintenanceStatusCard } from "./components/maintenance-status-card";
export {
  MaintenanceRulePreview,
  type MaintenanceRulePreviewProps,
} from "./components/maintenance-rule-preview";
export {
  MaintenanceRulesTable,
  type MaintenanceRulesTableProps,
} from "./components/maintenance-rules-table";
export {
  DeleteRuleDialog,
  type DeleteRuleDialogProps,
} from "./components/delete-rule-dialog";

// Backend integration
export { maintenanceService } from "./api/maintenance.service";
export { maintenanceKeys } from "./api/maintenance.keys";
export {
  filterRules,
  useActiveMaintenanceStatus,
  useCreateMaintenanceRule,
  useDeleteMaintenanceRule,
  useMaintenanceRule,
  useMaintenanceRules,
  useUpdateMaintenanceRule,
  type MaintenanceRuleFilters,
} from "./hooks/use-maintenance-rules";
export { toRuleFormValues, toRuleRequest } from "./mappers/maintenance.mapper";
export {
  readActiveStatus,
  type ActiveMaintenanceStatus,
} from "./utils/active-status";

// Contracts
export {
  MAINTENANCE_SCOPE_TYPES,
  type CreateMaintenanceRuleRequest,
  type MaintenanceRuleDto,
  type MaintenanceScopeType,
  type RecurrenceDayOfWeek,
  type UpdateMaintenanceRuleRequest,
} from "./types/maintenance.dto";
export {
  maintenanceRuleFormDefaults,
  maintenanceRuleFormSchema,
  resolveLocalTimezone,
  type MaintenanceRuleFormValues,
} from "./schemas/maintenance-rule.schema";
export {
  DAY_OF_WEEK_OPTIONS,
  SCOPE_OPTIONS,
  SCOPE_PRESENTATION,
  STATUS_FILTER_OPTIONS,
  type MaintenanceStatusFilter,
} from "./constants";
