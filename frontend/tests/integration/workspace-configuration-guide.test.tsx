import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/core/auth";
import { GuideProvider, registerGuide } from "@/core/guides";
import { useGuideStore } from "@/core/guides/guide-store";
import { __resetGuideRegistryForTests } from "@/core/guides/registry";
import {
  ConfigurationEditorScreen,
  workspaceConfigurationGuide,
} from "@/features/workspace-admin";

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
// One stable array: an inline default is a new array on every render,
// which re-fires the setSession effect below and loops forever.
const SUPER_ADMIN_ROLES = ["SUPER_ADMIN"];

function SignedIn({
  children,
  roles = SUPER_ADMIN_ROLES,
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
  setPathname("/app/workspace-admin/configuration");
  setSearchParams();
  resetGuideStore();
  __resetGuideRegistryForTests();
  registerGuide(workspaceConfigurationGuide);
});

describe("the Configuration Layer Editor guide", () => {
  it("explains merge order, then completes the guide on a successful save", async () => {
    const user = userEvent.setup();
    useGuideStore.getState().start("workspace-configuration");

    render(
      <SignedIn>
        <GuideProvider>
          <ConfigurationEditorScreen />
        </GuideProvider>
      </SignedIn>,
    );

    expect(await screen.findByText("How layers combine")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    expect(await screen.findByText("Save the layer")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();

    // The default USER scope requires an id; without one the save fails
    // validation and never reaches the backend.
    await user.type(screen.getByLabelText("User id"), "user-42");
    await user.click(
      screen.getByRole("button", { name: /save configuration layer/i }),
    );

    await waitFor(() => {
      expect(useGuideStore.getState().status).toBe("completed");
    });
    expect(useGuideStore.getState().completed["workspace-configuration"]).toEqual({
      version: 1,
      completedAt: expect.any(String),
    });
  });
});
