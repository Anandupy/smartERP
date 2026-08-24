import { ROUTES } from "@/constants";

import type { WorkspaceStatus } from "./types";

/**
 * Where the app goes once the user is authenticated — the workspace analogue
 * of `core/startup`'s `resolveStartupRoute`, and the only place that decision
 * is made.
 *
 * At sign-in the scope is still `idle` (identity has not loaded), so login
 * always hands off to the workspace route. That route resolves the scope and
 * forwards onward once it is `ready` — immediately for a backend-scoped role,
 * on Continue for anyone who chooses — or to the setup wizard when bootstrap
 * is still required. The auth feature therefore never learns what a workspace
 * is: it asks this function and follows the answer.
 *
 * Pure and total: pass the current status, get a path.
 */
export function resolvePostAuthRoute(status: WorkspaceStatus = "idle"): string {
  if (status === "ready") return ROUTES.app.root;
  if (status === "setup-required") return ROUTES.setup.root;
  return ROUTES.workspace.root;
}
