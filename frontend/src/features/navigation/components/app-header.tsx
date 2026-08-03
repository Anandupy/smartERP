"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { GlobalSearch } from "./global-search";
import { NavBreadcrumbs } from "./nav-breadcrumbs";
import { NotificationsMenu } from "./notifications-menu";
import { ProfileMenu } from "./profile-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

export interface AppHeaderProps {
  /** Sign-out control, passed through to the profile menu. */
  signOut?: React.ReactNode;
}

/**
 * The application's top bar.
 *
 * Everything in it is either navigation (the sidebar toggle, breadcrumbs) or
 * an account-level affordance (search, notifications, workspace, profile) —
 * nothing page-specific, which is why pages never touch it.
 *
 * Priority under pressure is set by what drops first: the workspace switcher
 * hides below `lg` (the sidebar footer still carries it), breadcrumbs collapse
 * to the current page below `sm`, and search shrinks to an icon. The sidebar
 * toggle and the profile menu are never dropped, because on a phone they are
 * the only routes to navigation and to sign-out.
 */
export function AppHeader({ signOut }: AppHeaderProps) {
  return (
    <div className="flex h-14 items-center gap-2 px-3 sm:px-4 lg:px-6">
      <SidebarTrigger />
      <Separator
        orientation="vertical"
        className="hidden h-5 sm:block"
        aria-hidden="true"
      />
      <NavBreadcrumbs className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <GlobalSearch />
        <WorkspaceSwitcher variant="compact" className="hidden lg:flex" />
        <NotificationsMenu />
        <ProfileMenu signOut={signOut} />
      </div>
    </div>
  );
}
