/**
 * Central route registry. Pages are added by feature modules, but their paths
 * are declared here so navigation, guards, and breadcrumbs share one contract
 * and refactors stay type-safe.
 */
export const ROUTES = Object.freeze({
  root: "/",
  auth: {
    login: "/login",
    logout: "/logout",
    forgotPassword: "/forgot-password",
  },
  app: {
    root: "/app",
  },
});

export type Routes = typeof ROUTES;
