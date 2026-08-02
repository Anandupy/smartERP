/**
 * Public surface of the workspace feature. Outside code (routes, other platform
 * wiring) imports ONLY from here — never from a file inside the module.
 *
 * The feature owns the *transport and the screen*: it fetches `/auth/me`,
 * normalizes it, and renders the choice. Where the resulting scope lives, and
 * whether a choice is needed at all, belong to `@/core/workspace` — which is
 * what every other module consumes:
 *
 * ```ts
 * import { useWorkspace } from "@/core/workspace";
 * ```
 *
 * See `docs/workspace.md`.
 */

// Screen
export {
  WorkspaceSelectionScreen,
  type WorkspaceSelectionScreenProps,
} from "./components/workspace-selection-screen";

// Building blocks — reused by the future workspace switcher
export {
  WorkspaceBrandPanel,
  type WorkspaceBrandPanelProps,
} from "./components/workspace-brand-panel";
export {
  WorkspaceIdentity,
  type WorkspaceIdentityProps,
} from "./components/workspace-identity";
export {
  WorkspaceSelectionForm,
  type WorkspaceSelectionFormProps,
} from "./components/workspace-selection-form";
export {
  WorkspaceSelectField,
  type WorkspaceSelectFieldProps,
} from "./components/workspace-select-field";
export {
  WorkspaceBranchField,
  type WorkspaceBranchFieldProps,
} from "./components/workspace-branch-field";
export {
  WorkspaceSummary,
  type WorkspaceSummaryProps,
} from "./components/workspace-summary";
export {
  WorkspaceUnavailable,
  type WorkspaceUnavailableProps,
} from "./components/workspace-unavailable";

// Hooks
export { useIdentity } from "./hooks/use-identity";
export {
  useWorkspaceBootstrap,
  type WorkspaceBootstrap,
} from "./hooks/use-workspace-bootstrap";
export { useWorkspaceRedirect } from "./hooks/use-workspace-redirect";

// Backend integration
export { identityService } from "./api/identity.service";
export { CURRENT_IDENTITY, identityKeys } from "./api/identity.keys";
export {
  toDefaultSelection,
  toIdentityUser,
  toPermissions,
  toWorkspaceAvailability,
} from "./mappers/identity.mapper";
export type {
  IdentityAcademicYearDto,
  IdentityBranchDto,
  IdentityContextDto,
  IdentityDto,
  IdentityScopeDto,
  IdentityUserDto,
} from "./types/identity.dto";

// Contracts and helpers
export {
  validateWorkspaceSelection,
  workspaceSelectionSchema,
  type WorkspaceSelectionValidation,
  type WorkspaceSelectionValues,
} from "./schemas/workspace-selection.schema";
export { firstNameOf, initialsOf, roleLabelOf } from "./utils/identity-display";
export {
  WORKSPACE_ASSURANCES,
  WORKSPACE_SUPPORT_EMAIL,
  WORKSPACE_UNAVAILABLE_COPY,
} from "./constants";
