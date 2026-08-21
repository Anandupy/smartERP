/**
 * Public surface of the Workspace Admin module.
 *
 * Scope: the ERP's presentation/control plane — `/admin/navigation/modules`,
 * `/admin/navigation/menus`, `/workspace/navigation` (read-only reach
 * indicator), `/workspace/configuration`, `/workspace/setup/status`, and the
 * three health probes `/live`, `/ready`, `/health`.
 *
 * Named `workspace-admin` rather than `workspace` because `src/features/workspace`
 * already exists for a different concept — organization/branch/academic-year
 * scope selection (`docs/workspace.md`). This module never touches that scope;
 * it is gated entirely by role (`SUPER_ADMIN`), not by workspace selection.
 *
 * Three contract facts shape the module:
 *
 * 1. **Module and Menu CRUD are fully real**, contrary to what the initial
 *    brief assumed might be missing — 15 admin endpoints, verified against
 *    backend source, not just the Postman collection (whose response bodies
 *    are largely auto-generated placeholders).
 * 2. **Workspace configuration has two endpoints** — `POST
 *    /workspace/configuration` to upsert, and `GET
 *    /workspace/configuration/:scopeType` (added 2026-08-21) to read one layer
 *    back by its exact scope key. Still no `list`, no `DELETE`. The
 *    Configuration Layer Editor now loads existing values before editing, but
 *    every save still merges into the scope rather than replacing it.
 * 3. **Liveness, readiness and dependency health are three independent
 *    dimensions**, never collapsed into one status. `mapHealthStatus` is the
 *    single place a backend outcome becomes a frontend health state.
 *
 * See `docs/workspace-admin-module.md` for the full screen inventory, API
 * mapping and backend-gap list.
 */

// Screens
export { ModulesScreen } from "./components/modules/modules-screen";
export { ModuleDetailScreen } from "./components/modules/module-detail-screen";
export { CreateModuleScreen } from "./components/modules/create-module-screen";
export { EditModuleScreen } from "./components/modules/edit-module-screen";
export {
  MenusScreen,
  type MenusScreenProps,
} from "./components/menus/menus-screen";
export { ConfigurationEditorScreen } from "./components/configuration/configuration-editor-screen";
export { HealthMonitorScreen } from "./components/health/health-monitor-screen";

// Composable pieces
export { ModuleBoundary } from "./components/modules/module-boundary";
export { ModuleForm } from "./components/modules/module-form";
export { ModulesTable } from "./components/modules/modules-table";
export { ModuleStatusBadge } from "./components/modules/module-status-badge";
export { MenuStatusBadge } from "./components/menus/menu-status-badge";
export { MenuVisibilityIndicator } from "./components/menus/menu-visibility-indicator";
export { MenuTree } from "./components/menus/menu-tree";
export { HealthProbeCard } from "./components/health/health-probe-card";
export { DependencyTable } from "./components/health/dependency-table";
export { SetupStatusBanner } from "./components/setup-status-banner";

// Backend integration
export { moduleService } from "./api/modules.service";
export { moduleKeys } from "./api/modules.keys";
export { menuService } from "./api/menus.service";
export { menuKeys } from "./api/menus.keys";
export { healthService } from "./api/health.service";
export { healthKeys } from "./api/health.keys";
export { configurationService } from "./api/configuration.service";
export { configurationKeys } from "./api/configuration.keys";
export { setupService } from "./api/setup.service";
export { setupKeys } from "./api/setup.keys";
export { navigationService } from "./api/navigation.service";
export { navigationKeys } from "./api/navigation.keys";

export {
  filterModules,
  useCreateModule,
  useDeleteModule,
  useModule,
  useModules,
  useUpdateModule,
  useUpdateModuleStatus,
  type ModuleFilters,
} from "./hooks/use-modules";
export {
  MAX_MENU_DEPTH,
  eligibleParents,
  useCreateMenu,
  useDeleteMenu,
  useDuplicateMenu,
  useMenu,
  useMenus,
  useMoveMenu,
  useReorderMenus,
  useUpdateMenu,
  useUpdateMenuStatus,
} from "./hooks/use-menus";
export {
  useFullHealth,
  useLiveness,
  useReadiness,
  useRefreshHealth,
} from "./hooks/use-health";
export {
  useConfiguration,
  useUpsertConfiguration,
} from "./hooks/use-configuration";
export { useSetupStatus } from "./hooks/use-setup-status";
export { useNavigationTree } from "./hooks/use-navigation";

export {
  deriveOverallState,
  formatUptime,
  mapHealthStatus,
  mapIndicatorStatus,
  type HealthOverallState,
  type IndicatorState,
  type LiveState,
  type OverallState,
  type ProbeOutcome,
  type ReadyState,
} from "./mappers/health.mapper";
export { toModuleFormValues, toModuleRequest } from "./mappers/module.mapper";
export { toMenuFormValues, toMenuRequest } from "./mappers/menu.mapper";
export {
  toConfigurationFormValues,
  toConfigurationRequest,
} from "./mappers/configuration.mapper";

// Contracts
export type {
  CreateModuleRequest,
  ModuleDetailDto,
  ModuleDto,
  ModuleListItemDto,
  UpdateModuleRequest,
  UpdateModuleStatusRequest,
} from "./types/module.dto";
export {
  MENU_STATUSES,
  PERMISSION_MODES,
  type CreateMenuRequest,
  type MenuDetailDto,
  type MenuDto,
  type MenuListItemDto,
  type MenuStatus,
  type MoveMenuRequest,
  type PermissionMode,
  type UpdateMenuRequest,
  type UpdateMenuStatusRequest,
} from "./types/menu.dto";
export type { NavigationTreeDto, NavigationTreeNodeDto } from "./types/navigation.dto";
export {
  WORKSPACE_ROLE_NAMES,
  WORKSPACE_SCOPE_TYPES,
  type UpsertWorkspaceConfigurationRequest,
  type WorkspaceConfigurationDto,
  type WorkspaceRoleName,
  type WorkspaceScopeType,
} from "./types/configuration.dto";
export type { SetupActionDto, WorkspaceSetupStatusDto } from "./types/setup.dto";
export type { HealthCheckResultDto, LivenessDto } from "./types/health.dto";

export {
  moduleFormDefaults,
  moduleFormSchema,
  type ModuleFormValues,
} from "./schemas/module.schema";
export {
  NO_PARENT,
  menuFormDefaults,
  menuFormSchema,
  type MenuFormValues,
} from "./schemas/menu.schema";
export {
  UNSET,
  configurationFormDefaults,
  configurationFormSchema,
  type ConfigurationFormValues,
} from "./schemas/configuration.schema";

export {
  HEALTH_DIMENSION_ICON,
  HEALTH_POLL_INTERVAL_MS,
  HEALTH_STATE_PRESENTATION,
  ICON_NAME_OPTIONS,
  MENU_STATUS_PRESENTATION,
  SCOPE_TYPE_LABELS,
  UNKNOWN_ICON,
  resolveIcon,
} from "./constants";
