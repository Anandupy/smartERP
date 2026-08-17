/**
 * Wire shape for `GET /workspace/setup/status` and `POST /workspace/setup/complete`.
 *
 * Transcribed from `workspace-setup-status.dto.ts` on the backend. Both
 * endpoints return the identical `WorkspaceSetupStatusDto` shape.
 *
 * Used in this module only as a small non-blocking banner (see
 * `SetupStatusBanner`) — a full setup wizard is out of scope for the six
 * screens this module ships; see `docs/workspace-admin-module.md`.
 */

export const SETUP_RESOURCES = ["ORGANIZATION", "BRANCH", "ACADEMIC_YEAR"] as const;
export type SetupResource = (typeof SETUP_RESOURCES)[number];

export const SETUP_STAGES = [
  "ORGANIZATION",
  "BRANCH",
  "ACADEMIC_YEAR",
  "FINALIZE",
  "COMPLETED",
] as const;
export type WorkspaceSetupStage = (typeof SETUP_STAGES)[number];

/** One request permitted while setup is incomplete. */
export interface SetupActionDto {
  action: string;
  method: string;
  path: string;
  description: string;
}

export interface WorkspaceSetupStatusDto {
  /** True until the workspace has been marked initialized. */
  setupRequired: boolean;
  setupStage: WorkspaceSetupStage;
  missingResources: SetupResource[];
  completedResources: SetupResource[];
  allowedActions: SetupActionDto[];
  initializedAt: string | null;
}
