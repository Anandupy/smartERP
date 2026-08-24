/**
 * Public surface of the initial setup wizard.
 *
 * Orchestrates the existing Organization, Branch, Academic Year and System
 * Settings modules into a guided first-run flow — it owns no domain CRUD of
 * its own. The one identity write it does own (`POST /users` for `ORG_ADMIN`
 * provisioning) reuses the existing endpoint rather than a parallel one. See
 * `docs/workspace-setup-module.md`.
 */

// Screens
export { SetupWelcomeScreen } from "./components/setup-welcome-screen";
export { SetupReviewScreen } from "./components/setup-review-screen";
export { SetupCompleteScreen } from "./components/setup-complete-screen";

// Composable pieces
export { SetupShell, type SetupShellProps } from "./components/setup-shell";
export {
  ProvisionOrgAdminForm,
  type ProvisionOrgAdminFormProps,
} from "./components/provision-org-admin-form";
export {
  ProvisionOrgAdminPanel,
  type ProvisionOrgAdminPanelProps,
} from "./components/provision-org-admin-panel";

// Hooks
export { useCompleteSetup } from "./hooks/use-complete-setup";
export { useProvisionOrgAdmin } from "./hooks/use-provision-org-admin";

// Backend integration
export { setupCompletionService } from "./api/setup.service";
export { provisionAdminService } from "./api/provision-admin.service";
export { toCreateOrgAdminRequest } from "./mappers/provision-org-admin.mapper";
export type {
  CreateOrgAdminRequest,
  ProvisionedAdminDto,
} from "./types/provision-org-admin.dto";

// Contracts and pure logic
export {
  provisionOrgAdminFormDefaults,
  provisionOrgAdminFormSchema,
  type ProvisionOrgAdminFormValues,
} from "./schemas/provision-org-admin.schema";
export {
  canActOnStage,
  canCompleteSetup,
  roleCanAccessSetupWizard,
} from "./utils/setup-access";
export {
  buildSetupSteps,
  currentSetupStep,
  nextSetupHref,
  type SetupStepDescriptor,
} from "./utils/setup-steps";
