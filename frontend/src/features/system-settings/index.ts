/**
 * Public surface of the System Settings module.
 *
 * Scope: the global configuration record at `/system-settings` — product
 * identity, environment, the installation-wide maintenance switch and support
 * channels. Documented endpoints are `GET`, `PATCH` and a one-time
 * `POST /system-settings/init`.
 *
 * Two of the module's screens have no contract behind them and say so:
 * **Branding & Identity** (no branding fields, no upload endpoint) is layout
 * only, and the infrastructure half of **System Information** is marked
 * pending. Neither invents a field name.
 *
 * **History & Audit** is not implemented here. Configuration history is the
 * audit trail, which belongs to the audit module; the route composes the two,
 * so neither feature imports the other.
 */

// Screens
export { SystemSettingsScreen } from "./components/system-settings-screen";
export { GeneralSettingsScreen } from "./components/general-settings-screen";
export { BrandingScreen } from "./components/branding-screen";
export { MaintenanceSupportScreen } from "./components/maintenance-support-screen";
export { SystemInformationScreen } from "./components/system-information-screen";

// Composable pieces
export { SettingsNav, type SettingsNavProps } from "./components/settings-nav";
export {
  SettingsBoundary,
  type SettingsBoundaryProps,
} from "./components/settings-boundary";
export {
  SettingsStatusStrip,
  type SettingsStatusStripProps,
} from "./components/settings-status-strip";
export { MaintenanceModeBanner } from "./components/maintenance-mode-banner";
export {
  GeneralSettingsForm,
  type GeneralSettingsFormProps,
} from "./components/general-settings-form";
export {
  InitializeSettingsForm,
  type InitializeSettingsFormProps,
} from "./components/initialize-settings-form";
export {
  InitializeSettingsDialog,
  type InitializeSettingsDialogProps,
} from "./components/initialize-settings-dialog";
export {
  MaintenanceSupportForm,
  type MaintenanceSupportFormProps,
} from "./components/maintenance-support-form";

// Backend integration
export { systemSettingsService } from "./api/system-settings.service";
export {
  GLOBAL_SETTINGS,
  systemSettingsKeys,
} from "./api/system-settings.keys";
export {
  isNotInitialized,
  useInitializeSystemSettings,
  useSystemSettings,
  useUpdateSystemSettings,
} from "./hooks/use-system-settings";
export {
  toGeneralFormValues,
  toGeneralUpdateRequest,
  toInitRequest,
  toMaintenanceFormValues,
  toMaintenanceUpdateRequest,
} from "./mappers/system-settings.mapper";

// Contracts
export {
  SYSTEM_ENVIRONMENTS,
  type InitSystemSettingsRequest,
  type SystemEnvironment,
  type SystemSettingsDto,
  type UpdateSystemSettingsRequest,
} from "./types/system-settings.dto";
export {
  generalSettingsFormSchema,
  initSettingsFormDefaults,
  initSettingsFormSchema,
  maintenanceSupportFormSchema,
  type GeneralSettingsFormValues,
  type InitSettingsFormValues,
  type MaintenanceSupportFormValues,
} from "./schemas/system-settings.schema";
export {
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_PRESENTATION,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "./constants";
