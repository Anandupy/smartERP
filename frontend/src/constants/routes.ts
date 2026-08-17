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
     * Account & Security Center — the signed-in user's own sessions, sign-out
     * controls and (mostly backend-pending) account security screens. Scoped
     * to the caller, never to another user: every real read/write here is
     * `/auth/sessions` or `/auth/logout`, which the backend already resolves
     * from the bearer token.
     */
    security: {
      root: "/app/account/security",
      sessions: "/app/account/security/sessions",
      loginHistory: "/app/account/security/login-history",
      changePassword: "/app/account/security/change-password",
      twoFactor: "/app/account/security/two-factor",
      preferences: "/app/account/security/preferences",
      audit: "/app/account/security/audit",
      dangerZone: "/app/account/security/danger-zone",
      trustedDevices: "/app/account/security/trusted-devices",
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
    /**
     * Programs — the academic classification inside a branch.
     *
     * Scoped to the **active branch**: `branchId` is a documented required
     * parameter on both list endpoints, so these paths carry no branch segment
     * and are read in the workspace's current scope.
     *
     * `tree` sits beside the directory rather than under a record, because it
     * plots the whole branch's hierarchy on one screen.
     */
    programs: {
      root: "/app/programs",
      directory: "/app/programs/directory",
      tree: "/app/programs/tree",
      create: "/app/programs/new",
      detail: (id: string) => `/app/programs/${id}`,
      edit: (id: string) => `/app/programs/${id}/edit`,
    },
    /**
     * Academic units — the operational structure inside a program.
     *
     * Scoped to the active branch **and** academic year: both are documented
     * required parameters on the list and tree endpoints, which is what makes
     * this the first module needing two levels of workspace scope at once.
     */
    academicUnits: {
      root: "/app/academic-units",
      directory: "/app/academic-units/directory",
      tree: "/app/academic-units/tree",
      create: "/app/academic-units/new",
      detail: (id: string) => `/app/academic-units/${id}`,
      edit: (id: string) => `/app/academic-units/${id}/edit`,
    },
    /**
     * Communication — templates, delivery logs, analytics and settings.
     *
     * `root` is the overview. Every read here is scoped to the active
     * organization and branch (`useCommunicationScope`); none of these paths
     * carry a scope segment. Templates are the only sub-resource with its own
     * record screens — delivery logs and settings are singleton-per-scope
     * views with no id in the URL.
     */
    communication: {
      root: "/app/communication",
      templates: {
        root: "/app/communication/templates",
        create: "/app/communication/templates/new",
        detail: (id: string) => `/app/communication/templates/${id}`,
        edit: (id: string) => `/app/communication/templates/${id}/edit`,
      },
      deliveryLogs: "/app/communication/delivery-logs",
      analytics: "/app/communication/analytics",
      settings: "/app/communication/settings",
      sendNotification: "/app/communication/notifications/new",
    },
    /**
     * Workspace Admin — the ERP's presentation/control plane: navigation
     * modules and menus, the workspace configuration layer editor, and the
     * system health monitor. Distinct from `workspace` above (organization /
     * branch / academic-year scope selection) and from `core/workspace` (the
     * scope consumer) — this is the backend's "Workspace Platform" module.
     *
     * `menus.detail` deep-links into the single Menu Details screen (tree +
     * detail panel together) rather than a separate record page — there is no
     * standalone "menu list" screen in the Stitch design.
     */
    workspaceAdmin: {
      root: "/app/workspace-admin",
      modules: {
        root: "/app/workspace-admin/modules",
        create: "/app/workspace-admin/modules/new",
        detail: (id: string) => `/app/workspace-admin/modules/${id}`,
        edit: (id: string) => `/app/workspace-admin/modules/${id}/edit`,
      },
      menus: {
        root: "/app/workspace-admin/menus",
        detail: (id: string) => `/app/workspace-admin/menus/${id}`,
      },
      configuration: "/app/workspace-admin/configuration",
      health: "/app/workspace-admin/health",
    },
  },
});

export type Routes = typeof ROUTES;
