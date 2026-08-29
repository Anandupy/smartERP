import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/core/auth";
import { GuideProvider, registerGuide } from "@/core/guides";
import { useGuideStore } from "@/core/guides/guide-store";
import { __resetGuideRegistryForTests } from "@/core/guides/registry";
import { MenusScreen, workspaceMenusGuide } from "@/features/workspace-admin";

import { render, screen, waitFor } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock, setPathname, setSearchParams } = await import(
  "@tests/mocks/next-navigation"
);

/** Signs a user in with the given roles, mirroring the Modules guide test. */
function SignedIn({
  children,
  roles = ["SUPER_ADMIN"],
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { setSession, isAuthenticated } = useAuth();

  useEffect(() => {
    setSession(
      { id: "user-1", name: "Admin", email: "admin@institution.edu", roles, permissions: [] },
      { accessToken: "access-token" },
    );
  }, [setSession, roles]);

  return isAuthenticated ? <>{children}</> : null;
}

function resetGuideStore() {
  useGuideStore.setState({
    activeGuideId: null,
    stepIndex: 0,
    entityId: null,
    status: "idle",
    completed: {},
  });
}

beforeEach(() => {
  resetRouterMock();
  setPathname("/app/workspace-admin/menus");
  setSearchParams();
  resetGuideStore();
  __resetGuideRegistryForTests();
  registerGuide(workspaceMenusGuide);
});

describe("the Menu Details guide", () => {
  it("walks the module switcher and the create action, then finishes without touching the create dialog", async () => {
    const user = userEvent.setup();
    useGuideStore.getState().start("workspace-menus");

    render(
      <SignedIn>
        <GuideProvider>
          <MenusScreen />
        </GuideProvider>
      </SignedIn>,
    );

    expect(await screen.findByText("Pick a module")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    expect(await screen.findByText("Add a menu")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(() => {
      expect(useGuideStore.getState().status).toBe("completed");
    });
    // The tour never opened the create dialog itself — it only pointed at
    // the button, per the "modal priority" rule.
    expect(screen.queryByText("Create menu")).not.toBeInTheDocument();
  });
});
