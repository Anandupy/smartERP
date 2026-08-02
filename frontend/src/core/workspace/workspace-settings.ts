import type { WorkspaceSelectionPolicy } from "./types";

/**
 * How the platform behaves when a workspace could be resolved without asking.
 *
 * Kept apart from `workspace-policy` on purpose: the policy functions stay pure
 * and total, taking the answer as an argument, while *where that answer comes
 * from* lives here behind a get/set seam — the same shape as `workspace-storage`
 * and `token-storage`.
 *
 * Today the value is a constant. When workspace settings become server-owned,
 * the bootstrap calls `setWorkspaceSelectionPolicy()` once with what the backend
 * returned and nothing else changes: the resolver already reads it through this
 * seam, so no call site has to move.
 */

export const DEFAULT_WORKSPACE_SELECTION_POLICY: WorkspaceSelectionPolicy =
  Object.freeze({
    /**
     * Show the selection screen even when only one workspace is possible.
     *
     * `true` makes the post-login experience identical for every privileged
     * user: they always see which organization, campus and academic year they
     * are entering, and enter it by pressing Continue. The alternative — sending
     * a single-tenant user straight through — saves a click at the cost of never
     * showing them the scope every subsequent request is made in.
     *
     * This is the whole difference between the two behaviors; the roles that are
     * scoped by the backend are unaffected either way, because they are settled
     * before this is consulted.
     */
    alwaysShowSelection: true,
  });

let activePolicy: WorkspaceSelectionPolicy = DEFAULT_WORKSPACE_SELECTION_POLICY;

export function getWorkspaceSelectionPolicy(): WorkspaceSelectionPolicy {
  return activePolicy;
}

/** Override the policy — for a future settings endpoint, and for tests. */
export function setWorkspaceSelectionPolicy(
  policy: Partial<WorkspaceSelectionPolicy>,
): void {
  activePolicy = Object.freeze({ ...activePolicy, ...policy });
}

/** Restore the shipped default. */
export function resetWorkspaceSelectionPolicy(): void {
  activePolicy = DEFAULT_WORKSPACE_SELECTION_POLICY;
}
