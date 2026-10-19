import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { ROUTES } from "@/constants";
import {
  BRANCH_SETTINGS_SECTIONS,
  BranchSettingsDashboardScreen,
} from "@/features/branch";
import { AppSidebar, NavBreadcrumbs } from "@/features/navigation";
import {
  SECURITY_SECTIONS,
  SecurityDashboardScreen,
} from "@/features/security";
import {
  SETTINGS_SECTIONS,
  SystemSettingsScreen,
} from "@/features/system-settings";
import { useUiStore } from "@/store";

import { render, screen, within } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock, setPathname } =
  await import("@tests/mocks/next-navigation");

beforeEach(() => {
  resetRouterMock();
  useUiStore.setState({ isSidebarOpen: true, isCommandMenuOpen: false });
});

/**
 * One persistent sidebar (`docs/layouts.md`).
 *
 * System Settings (and Numbering beneath it), Account & Security and Branch
 * Settings each used to have a nested route layout whose only job was to put
 * a second vertical navigation column beside every page. Those layouts are
 * gone; each module's sections are reached from its overview cards and left
 * through the breadcrumbs.
 */

const APP_ROUTES = join(process.cwd(), "src/app/(app)");

function layoutsUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return layoutsUnder(path);
    return /^layout\.(t|j)sx?$/.test(name) ? [relative(APP_ROUTES, path)] : [];
  });
}

describe("One persistent sidebar", () => {
  it("has no nested layout under the app shell that could add a second navigation column", () => {
    // The (app) group's own layout mounts AppLayout with the primary sidebar.
    // Nothing beneath it may wrap pages in navigation of its own.
    expect(layoutsUnder(APP_ROUTES)).toEqual(["layout.tsx"]);
  });

  it("keeps the primary sidebar and breadcrumbs on a Numbering page", () => {
    setPathname(ROUTES.app.settings.numbering.root);
    render(
      <SidebarProvider>
        <AppSidebar />
        <NavBreadcrumbs />
      </SidebarProvider>,
    );

    const sidebar = document.querySelector<HTMLElement>(
      '[data-sidebar="sidebar"]',
    );
    expect(sidebar).not.toBeNull();
    expect(
      within(sidebar!).getByRole("link", { name: "Numbering" }),
    ).toHaveAttribute("href", ROUTES.app.settings.numbering.root);
    expect(
      within(sidebar!).getByRole("link", { name: "System Settings" }),
    ).toHaveAttribute("href", ROUTES.app.settings.root);

    const trail = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(
      within(trail).getByRole("link", { name: "System Settings" }),
    ).toHaveAttribute("href", ROUTES.app.settings.root);

    // No module section navigation anywhere.
    expect(
      screen.queryByRole("navigation", { name: /sections/i }),
    ).not.toBeInTheDocument();
  });
});

describe("Every section stays reachable from its overview", () => {
  it("System Settings links all of its sections", async () => {
    render(<SystemSettingsScreen />);

    for (const section of SETTINGS_SECTIONS) {
      expect(
        await screen.findByRole("link", { name: new RegExp(section.label) }),
      ).toHaveAttribute("href", section.href);
    }
  });

  it("Account & Security links all of its sections, Backend Pending markers intact", async () => {
    render(<SecurityDashboardScreen />);

    for (const section of SECURITY_SECTIONS) {
      const link = await screen.findByRole("link", {
        name: new RegExp(section.label),
      });
      expect(link).toHaveAttribute("href", section.href);
      if (section.backendPending) {
        expect(within(link).getByText("Backend Pending")).toBeInTheDocument();
      }
    }
  });

  it("Branch Settings links all of its sections, scoped to the branch", async () => {
    render(<BranchSettingsDashboardScreen id="branch-1" />);

    for (const section of BRANCH_SETTINGS_SECTIONS) {
      expect(
        await screen.findByRole("link", { name: new RegExp(section.label) }),
      ).toHaveAttribute("href", section.href("branch-1"));
    }
  });
});
