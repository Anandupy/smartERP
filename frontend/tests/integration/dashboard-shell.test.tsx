import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { ROUTES } from "@/constants";
import {
  createMemoryWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import {
  AppHeader,
  AppSidebar,
  CommandPalette,
  NavBreadcrumbs,
  WorkspaceSwitcher,
} from "@/features/navigation";
import { useUiStore } from "@/store";

import { toWorkspaceAvailability } from "@/features/workspace";

import { identityDto } from "@tests/fixtures/workspace";
import { render, screen, waitFor, within } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock, routerMock, setPathname } =
  await import("@tests/mocks/next-navigation");

beforeEach(() => {
  resetRouterMock();
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  useWorkspaceStore.setState({
    availability: null,
    selection: { organizationId: null, branchId: null, academicYearId: null },
    status: "idle",
    reason: null,
  });
  useUiStore.setState({ isSidebarOpen: true, isCommandMenuOpen: false });
});

/** The sidebar primitive supplies context the nav components read. */
function withSidebar(ui: React.ReactElement) {
  return render(<SidebarProvider>{ui}</SidebarProvider>);
}

describe("Application sidebar", () => {
  it("offers the shipped modules as links", async () => {
    setPathname(ROUTES.app.root);
    withSidebar(<AppSidebar />);

    for (const label of [
      "Dashboard",
      "Organizations",
      "Branches",
      "Academic Years",
      "System Settings",
      "Maintenance",
      "Audit Logs",
    ]) {
      expect(await screen.findByRole("link", { name: label })).toBeVisible();
    }
  });

  it("keeps a nested branch route inside its section", async () => {
    setPathname(ROUTES.app.branches.settings.general("branch-1"));
    withSidebar(<AppSidebar />);

    expect(
      await screen.findByRole("link", { name: "Branches" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Organizations" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("no longer advertises Organizations as coming soon", async () => {
    // It moved out of the placeholder section when the module shipped.
    setPathname(ROUTES.app.root);
    withSidebar(<AppSidebar />);

    const organizations = await screen.findByRole("link", {
      name: "Organizations",
    });
    expect(organizations).toHaveAttribute(
      "href",
      ROUTES.app.organizations.root,
    );
    expect(screen.queryByText("Organization")).toBeNull();
  });

  it("keeps a nested organization route inside its section", async () => {
    setPathname(ROUTES.app.organizations.directory);
    withSidebar(<AppSidebar />);

    expect(
      await screen.findByRole("link", { name: "Organizations" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("marks the current section, and only that one", async () => {
    setPathname(ROUTES.app.settings.general);
    withSidebar(<AppSidebar />);

    const settings = await screen.findByRole("link", {
      name: "System Settings",
    });
    expect(settings).toHaveAttribute("aria-current", "page");

    // The dashboard is the prefix of every app route and must not light up.
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("advertises unbuilt modules without offering them as destinations", async () => {
    setPathname(ROUTES.app.root);
    withSidebar(<AppSidebar />);

    expect(screen.queryByRole("link", { name: /Admissions/ })).toBeNull();
    const admissions = await screen.findByText("Admissions");
    expect(admissions.closest("[aria-disabled='true']")).not.toBeNull();
  });
});

describe("Breadcrumbs", () => {
  it("derives the trail from the URL, with the current page unlinked", async () => {
    setPathname(ROUTES.app.settings.branding);
    render(<NavBreadcrumbs />);

    const settings = await screen.findByRole("link", {
      name: "System Settings",
    });
    expect(settings).toHaveAttribute("href", ROUTES.app.settings.root);

    // The current page is announced as current and is not navigable — linking
    // a crumb to the page it is already on is a dead control.
    const current = screen.getByText("Branding & Identity");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).not.toHaveAttribute("href");
  });
});

describe("Command palette", () => {
  it("stays closed until something raises it", () => {
    setPathname(ROUTES.app.root);
    render(<CommandPalette />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens from the header's search affordance and navigates", async () => {
    const user = userEvent.setup();
    setPathname(ROUTES.app.root);

    withSidebar(
      <>
        <AppHeader />
        <CommandPalette />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Search" }));

    const dialog = await screen.findByRole("dialog");
    await user.click(
      await within(dialog).findByRole("option", { name: /Audit Logs/ }),
    );

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(ROUTES.app.audit.root),
    );
  });

  it("names record search as pending rather than pretending to do it", async () => {
    setPathname(ROUTES.app.root);
    useUiStore.setState({ isCommandMenuOpen: true });

    render(<CommandPalette />);

    expect(
      await screen.findByText(/needs a backend\s+search endpoint/i),
    ).toBeInTheDocument();
  });
});

describe("Workspace switcher", () => {
  it("stays out of the way until a workspace is resolved", async () => {
    setPathname(ROUTES.app.root);
    withSidebar(<AppHeader />);

    await screen.findByRole("button", { name: "Search" });
    expect(screen.queryByText(/Change workspace/)).toBeNull();
  });

  it("shows the active scope once it is", async () => {
    setPathname(ROUTES.app.root);
    useWorkspaceStore.setState({
      // Through the real mapper, so the switcher is fed the same normalized
      // entities `/auth/me` would produce rather than raw wire shapes.
      availability: toWorkspaceAvailability(identityDto()),
      selection: {
        organizationId: "org-1",
        branchId: "branch-1",
        academicYearId: "ay-2026",
      },
      status: "ready",
      reason: null,
    });

    withSidebar(<AppSidebar workspaceSwitcher={<WorkspaceSwitcher />} />);

    const trigger = await screen.findByRole("button", {
      name: /Change workspace/,
    });
    expect(
      within(trigger).getByText("Universal Educational Trust"),
    ).toBeVisible();
    expect(
      within(trigger).getByText(/Downtown Campus · AY 2026-2027/),
    ).toBeVisible();
  });
});
