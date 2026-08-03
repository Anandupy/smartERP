/**
 * Public surface of the navigation feature — the application shell's content.
 *
 * `components/layouts/AppLayout` owns the *structure* (sidebar column, sticky
 * header, content, footer); this module owns what goes in it. Splitting them
 * that way is what lets the shell stay a generic, business-free layout while
 * the menu, breadcrumbs and account affordances live somewhere they can grow.
 *
 * The menu is static this phase (see `constants.ts`). Nothing outside reads it
 * directly: routes compose `AppSidebar` / `AppHeader`, and both derive their
 * own active state from the URL.
 */

export { AppSidebar, type AppSidebarProps } from "./components/app-sidebar";
export { AppHeader, type AppHeaderProps } from "./components/app-header";
export { AppFooter } from "./components/app-footer";
export { CommandPalette } from "./components/command-palette";
export {
  GlobalSearch,
  type GlobalSearchProps,
} from "./components/global-search";
export {
  NavBreadcrumbs,
  type NavBreadcrumbsProps,
} from "./components/nav-breadcrumbs";
export { NotificationsMenu } from "./components/notifications-menu";
export { ProfileMenu, type ProfileMenuProps } from "./components/profile-menu";
export {
  WorkspaceSwitcher,
  type WorkspaceSwitcherProps,
} from "./components/workspace-switcher";

export {
  BREADCRUMB_LABELS,
  NAV_SECTIONS,
  SEARCH_PLACEHOLDER,
} from "./constants";
export { isNavItemActive, resolveBreadcrumbs } from "./utils/breadcrumbs";
export type { Breadcrumb, NavItem, NavSection } from "./types";
