"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { BrandMark } from "@/shared/components/brand";

import { NAV_SECTIONS } from "../constants";
import { isNavItemActive } from "../utils/breadcrumbs";

export interface AppSidebarProps {
  /**
   * Workspace switcher, wired at the route. Sits in the footer where the
   * design puts it — beneath the menu, as the thing you change least often.
   */
  workspaceSwitcher?: React.ReactNode;
}

/**
 * The application's primary navigation.
 *
 * Reads the static menu from `constants.ts` and derives its own active state
 * from the current path, so a page never has to declare where it sits — adding
 * a route to `NAV_SECTIONS` is the whole change.
 *
 * Collapsing to an icon rail is what makes the shell work between `tablet` and
 * `laptop`, where 16rem of sidebar is a quarter of the viewport; below
 * `tablet` the primitive swaps to an overlay drawer, and selecting a
 * destination closes it so the user is not left staring at the menu they just
 * used.
 */
export function AppSidebar({ workspaceSwitcher }: AppSidebarProps) {
  const pathname = usePathname();
  const { isMobile, state, setOpenMobile } = useSidebar();
  const isRail = state === "collapsed" && !isMobile;

  const closeOnMobile = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-3 group-data-[collapsible=icon]:px-1.5">
        {/* The wordmark is dropped to a screen-reader label on the rail, where
            there is no room for it — never removed, so the shell keeps its
            accessible name at every width. */}
        <BrandMark size="sm" glyphOnly={isRail} />
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.id}>
            {section.label ? (
              <SidebarGroupLabel className="tracking-wide uppercase">
                {section.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = item.icon;

                  if (item.comingSoon) {
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          aria-disabled="true"
                          tooltip={`${item.label} — coming soon`}
                          className="cursor-default opacity-60"
                        >
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
                          <Badge
                            variant="outline"
                            className="ml-auto group-data-[collapsible=icon]:hidden"
                          >
                            Soon
                          </Badge>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  const isActive = isNavItemActive(pathname, item);

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.description ?? item.label}
                      >
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          onClick={closeOnMobile}
                        >
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {workspaceSwitcher ? (
        <SidebarFooter className="group-data-[collapsible=icon]:hidden">
          <SidebarSeparator className="mx-0" />
          {workspaceSwitcher}
        </SidebarFooter>
      ) : null}

      <SidebarRail />
    </Sidebar>
  );
}
