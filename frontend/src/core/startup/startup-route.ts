import { ROUTES } from "@/constants";

/**
 * Everything the startup decision depends on. `session` is the seam for backend
 * integration: it is always `null` today because session validation is not
 * implemented, and wiring it later is the only change this module needs.
 */
export interface StartupContext {
  /** Whether first-run onboarding has already been completed. */
  hasCompletedOnboarding: boolean;
  /**
   * Result of validating the stored session. `null` means "not checked" — the
   * current, pre-integration state. Once `core/auth` can validate a session,
   * pass `{ isValid }` here and a valid session short-circuits to the workspace.
   */
  session?: { isValid: boolean } | null;
}

/**
 * Decide where the splash screen hands off.
 *
 * Pure and total, so the whole startup policy is one testable function rather
 * than navigation scattered through page components:
 *
 * - valid session      → workspace   (future; unreachable until sessions exist)
 * - onboarding pending → welcome     (first run, then login)
 * - otherwise          → login       (returning visitor, incl. expired session)
 *
 * The onboarding flag is independent of authentication on purpose: a returning
 * visitor whose session expired still skips welcome.
 */
export function resolveStartupRoute(context: StartupContext): string {
  if (context.session?.isValid) return ROUTES.app.root;
  if (!context.hasCompletedOnboarding) return ROUTES.auth.welcome;
  return ROUTES.auth.login;
}
