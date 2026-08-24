import { api } from "@/core/api";

/**
 * `POST /workspace/setup/complete` — the one write this feature owns.
 *
 * Status reads do not live here: `GET /auth/me` already carries the same
 * `WorkspaceSetupStatus` block (see `@/core/workspace`'s `setupStatus`), so
 * every screen reads progress from `useWorkspaceStore` instead of a second
 * query against a second endpoint for the same data. After this call
 * succeeds, the composing route invalidates identity to refresh it — see
 * `docs/workspace-setup-module.md`.
 *
 * The response is intentionally untyped and unused by callers: it is the same
 * status block identity already provides, one request sooner, and parsing it
 * a second way here would be a second contract to keep in sync.
 */
export const setupCompletionService = {
  complete: () => api.post<unknown>("/workspace/setup/complete"),
} as const;
