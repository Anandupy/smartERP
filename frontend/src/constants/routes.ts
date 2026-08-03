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
  /**
   * The authenticated application. Every path below renders inside the
   * dashboard shell and is scoped by the active workspace.
   */
  app: {
    root: "/app",
    /**
     * Global configuration. `settings.maintenance` is the *system settings*
     * screen (maintenance mode + support channels); the separate
     * `app.maintenance` tree below owns maintenance **rules**.
     */
    settings: {
      root: "/app/settings",
      general: "/app/settings/general",
      branding: "/app/settings/branding",
      maintenance: "/app/settings/maintenance",
      systemInformation: "/app/settings/system-information",
      history: "/app/settings/history",
    },
    /**
     * Maintenance **rules**. A rule has no read-only screen of its own: the
     * editor is the detail view, so opening one always lands somewhere it can
     * be changed.
     */
    maintenance: {
      root: "/app/maintenance",
      create: "/app/maintenance/new",
      edit: (id: string) => `/app/maintenance/${id}/edit`,
    },
    audit: {
      root: "/app/audit",
    },
  },
});

export type Routes = typeof ROUTES;
