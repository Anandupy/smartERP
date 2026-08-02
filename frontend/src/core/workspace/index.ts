/**
 * Workspace scope platform.
 *
 * Owns *which* organization / branch / academic year the app is operating in,
 * and nothing about how that is fetched or rendered — the transport, mapping
 * and UI belong to `features/workspace`. That split is what lets the selection
 * screen, the future workspace switcher and every scoped module share one
 * answer.
 *
 * See `docs/workspace.md`.
 */
export { useWorkspace } from "./workspace-context";
export { WorkspaceProvider } from "./workspace-provider";
export {
  RequireWorkspace,
  type RequireWorkspaceProps,
} from "./workspace-guards";
export { resolvePostAuthRoute } from "./workspace-route";
export { registerWorkspaceHeaders } from "./workspace-headers";
export { getWorkspaceState, useWorkspaceStore } from "./workspace-store";
export {
  createMemoryWorkspaceStorage,
  createWebWorkspaceStorage,
  getWorkspaceStorage,
  setWorkspaceStorage,
  type WorkspaceStorage,
} from "./workspace-storage";
export {
  EMPTY_SELECTION,
  ROLES_REQUIRING_SELECTION,
  academicYearsFor,
  branchesFor,
  hasRealChoice,
  isSelectionComplete,
  narrowSelection,
  optionsFor,
  resolveWorkspaceAccess,
  roleRequiresSelection,
} from "./workspace-policy";
export type {
  WorkspaceAcademicYear,
  WorkspaceAvailability,
  WorkspaceBranch,
  WorkspaceContextValue,
  WorkspaceEntity,
  WorkspaceOptions,
  WorkspaceOrganization,
  WorkspaceResolution,
  WorkspaceSelection,
  WorkspaceStatus,
  WorkspaceUnavailableReason,
} from "./types";
