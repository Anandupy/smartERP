import { REQUEST_HEADERS } from "@/constants";
import { headerRegistry } from "@/core/api";

import { getWorkspaceState } from "./workspace-store";

/**
 * Resolve a scope id for a request, or `null` to omit the header.
 *
 * Scope headers are sent **only once the scope is `ready`**. A half-made
 * selection is a UI state, not an operating scope, so letting it reach the wire
 * would have requests answered against a branch the user never confirmed.
 */
function scopeHeader(
  pick: (
    selection: ReturnType<typeof getWorkspaceState>["selection"],
  ) => string | null,
) {
  return () => {
    const state = getWorkspaceState();
    return state.status === "ready" ? pick(state.selection) : null;
  };
}

/**
 * Point the platform's tenant/branch/academic-year headers at the active
 * workspace, replacing the `null` placeholders `core/api` ships.
 *
 * Follows the same pattern as the auth feature's `Authorization` wiring: the
 * API layer never learns what a workspace is, it just asks the registry for a
 * value on every request. Returns a teardown that restores the placeholders.
 *
 * `X-Workspace-Id` is deliberately left alone — the backend's scope is the
 * organization/branch/year triple, and there is no fourth id to send.
 */
export function registerWorkspaceHeaders(): () => void {
  headerRegistry
    .register(
      REQUEST_HEADERS.tenant,
      scopeHeader((selection) => selection.organizationId),
    )
    .register(
      REQUEST_HEADERS.branch,
      scopeHeader((selection) => selection.branchId),
    )
    .register(
      REQUEST_HEADERS.academicYear,
      scopeHeader((selection) => selection.academicYearId),
    );

  return () => {
    headerRegistry
      .register(REQUEST_HEADERS.tenant, () => null)
      .register(REQUEST_HEADERS.branch, () => null)
      .register(REQUEST_HEADERS.academicYear, () => null);
  };
}
