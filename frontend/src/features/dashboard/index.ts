/**
 * Public surface of the dashboard feature.
 *
 * The landing screen for a scoped session. It composes platform primitives and
 * reads the workspace through `useWorkspace()`; it fetches nothing of its own,
 * which is why it has no `api/` directory. Cross-module notices — the live
 * maintenance banner — arrive as slots wired at the route, so the dashboard
 * never imports another feature.
 */

export {
  DashboardScreen,
  type DashboardScreenProps,
} from "./components/dashboard-screen";
export { WorkspaceScopeCards } from "./components/workspace-scope-cards";
