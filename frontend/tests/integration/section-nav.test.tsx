import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/constants";
import { BranchSettingsNav } from "@/features/branch";
import { SecurityNav } from "@/features/security";
import { SettingsNav } from "@/features/system-settings";
import { isSectionActive } from "@/shared/components/layout";

import { render, screen, within } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock, setPathname } =
  await import("@tests/mocks/next-navigation");

beforeEach(() => resetRouterMock());

function current(nav: HTMLElement) {
  return within(nav)
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page");
}

describe("isSectionActive", () => {
  const item = {
    id: "n",
    label: "Numbering",
    href: "/app/settings/numbering",
    icon: () => null,
  };

  it("matches the section and its nested routes", () => {
    expect(isSectionActive(item as never, "/app/settings/numbering")).toBe(
      true,
    );
    expect(isSectionActive(item as never, "/app/settings/numbering/new")).toBe(
      true,
    );
    expect(
      isSectionActive(item as never, "/app/settings/numbering/abc/edit"),
    ).toBe(true);
  });

  it("does not match a sibling that merely shares a prefix", () => {
    expect(isSectionActive(item as never, "/app/settings/numberingx")).toBe(
      false,
    );
  });

  it("matches an exact item only on its own path", () => {
    const overview = {
      ...item,
      href: "/app/settings",
      match: "exact" as const,
    };
    expect(isSectionActive(overview as never, "/app/settings")).toBe(true);
    expect(isSectionActive(overview as never, "/app/settings/numbering")).toBe(
      false,
    );
  });
});

describe("System Settings section navigation", () => {
  it("marks the current section, and not Overview, on a section page", () => {
    setPathname(ROUTES.app.settings.general);
    render(<SettingsNav />);

    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    const active = current(nav);
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent("General");
  });

  it("marks only Overview active on the section root", () => {
    setPathname(ROUTES.app.settings.root);
    render(<SettingsNav />);

    const active = current(
      screen.getByRole("navigation", { name: "Settings sections" }),
    );
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent("Overview");
  });

  it("links every section to its own URL", () => {
    setPathname(ROUTES.app.settings.root);
    render(<SettingsNav />);

    expect(screen.getByRole("link", { name: /^Overview$/ })).toHaveAttribute(
      "href",
      ROUTES.app.settings.root,
    );
    expect(screen.getByRole("link", { name: /^General/ })).toHaveAttribute(
      "href",
      ROUTES.app.settings.general,
    );
  });
});

describe("Account & Security section navigation", () => {
  it("shows every label in full and states the backend-pending sections accessibly", () => {
    setPathname(ROUTES.app.security.root);
    render(<SecurityNav />);

    // Full labels — the pending pill used to truncate these to "Two-Fa…".
    const twoFactor = screen.getByRole("link", {
      name: /two-factor authentication/i,
    });
    expect(twoFactor).toHaveAccessibleName(/backend pending/i);
    expect(
      screen.getByRole("link", { name: /login history/i }),
    ).toHaveAccessibleName(/backend pending/i);
    // A real section carries no marker.
    expect(
      screen.getByRole("link", { name: /active sessions/i }),
    ).not.toHaveAccessibleName(/backend pending/i);
  });

  it("never hides the pending marker at narrow widths", () => {
    setPathname(ROUTES.app.security.root);
    render(<SecurityNav />);

    const marker = within(
      screen.getByRole("link", { name: /trusted devices/i }),
    ).getByText("Backend Pending");
    expect(marker.parentElement?.className ?? "").not.toMatch(/\bhidden\b/);
  });

  it("gives Overview an icon so its label aligns with the others", () => {
    setPathname(ROUTES.app.security.root);
    render(<SecurityNav />);

    const overview = screen.getByRole("link", { name: /^Overview$/ });
    expect(overview.querySelector("svg")).not.toBeNull();
  });
});

describe("Branch settings section navigation", () => {
  it("builds hrefs for the branch and marks the current section", () => {
    setPathname(ROUTES.app.branches.settings.root("branch-9") + "/history");
    render(<BranchSettingsNav branchId="branch-9" />);

    const nav = screen.getByRole("navigation", {
      name: "Branch settings sections",
    });
    const active = current(nav);
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAttribute(
      "href",
      ROUTES.app.branches.settings.root("branch-9") + "/history",
    );
  });
});
