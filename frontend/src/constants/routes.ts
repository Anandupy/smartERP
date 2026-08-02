/**
 * Central route registry. Pages are added by feature modules, but their paths
 * are declared here so navigation, guards, and breadcrumbs share one contract
 * and refactors stay type-safe.
 */
export const ROUTES = Object.freeze({
  root: "/",
  auth: {
    splash: "/splash",
    welcome: "/welcome",
    login: "/login",
    logout: "/logout",
    // Password recovery, in flow order.
    forgotPassword: "/forgot-password",
    emailSent: "/email-sent",
    verifyOtp: "/verify-otp",
    resetPassword: "/reset-password",
    passwordSuccess: "/password-success",
    // Session states.
    accountLocked: "/account-locked",
    sessionExpired: "/session-expired",
  },
  /**
   * Workspace scope selection. Sits between authentication and the app: a user
   * with more than one valid organization/branch/academic-year combination
   * chooses here before any scoped screen renders.
   */
  workspace: {
    root: "/workspace",
  },
  app: {
    root: "/app",
  },
});

export type Routes = typeof ROUTES;
