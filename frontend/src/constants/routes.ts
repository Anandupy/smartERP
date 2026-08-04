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
    /**
     * Organizations — the platform's tenants.
     *
     * `root` is the management overview and `directory` the full list, the
     * same split System Settings uses. Each record has a read-only detail
     * screen, an editor, and a lifecycle screen, because the operational state
     * of a tenant is a different decision from its details and should not sit
     * on the same page as a name field.
     */
    organizations: {
      root: "/app/organizations",
      directory: "/app/organizations/directory",
      create: "/app/organizations/new",
      detail: (id: string) => `/app/organizations/${id}`,
      edit: (id: string) => `/app/organizations/${id}/edit`,
      lifecycle: (id: string) => `/app/organizations/${id}/lifecycle`,
    },
    /**
     * Branches — the campuses inside an organization.
     *
     * Mirrors the organization tree: an overview at the root, a directory, and
     * per-record detail, editor and lifecycle screens. Settings are nested
     * under a branch rather than sitting beside it, because every one of them
     * is scoped to a single campus.
     */
    branches: {
      root: "/app/branches",
      directory: "/app/branches/directory",
      create: "/app/branches/new",
      detail: (id: string) => `/app/branches/${id}`,
      edit: (id: string) => `/app/branches/${id}/edit`,
      lifecycle: (id: string) => `/app/branches/${id}/lifecycle`,
      settings: {
        root: (id: string) => `/app/branches/${id}/settings`,
        general: (id: string) => `/app/branches/${id}/settings/general`,
        academic: (id: string) => `/app/branches/${id}/settings/academic`,
        communication: (id: string) =>
          `/app/branches/${id}/settings/communication`,
        integrations: (id: string) =>
          `/app/branches/${id}/settings/integrations`,
        history: (id: string) => `/app/branches/${id}/settings/history`,
      },
    },
    /**
     * Academic years — the administrative timeframes inside a branch.
     *
     * Mirrors the branch tree: an overview at the root, a directory, and
     * per-record detail, editor and lifecycle screens. `calendar` is the one
     * addition, and it sits beside the directory rather than under a record
     * because it plots every year of the branch on one axis.
     *
     * Every screen below is scoped to the **active branch** — `branchId` is a
     * documented required parameter on both read endpoints — so these paths
     * carry no branch segment and are read in the workspace's current scope.
     */
    academicYears: {
      root: "/app/academic-years",
      directory: "/app/academic-years/directory",
      calendar: "/app/academic-years/calendar",
      create: "/app/academic-years/new",
      detail: (id: string) => `/app/academic-years/${id}`,
      edit: (id: string) => `/app/academic-years/${id}/edit`,
      lifecycle: (id: string) => `/app/academic-years/${id}/lifecycle`,
    },
  },
});

export type Routes = typeof ROUTES;
