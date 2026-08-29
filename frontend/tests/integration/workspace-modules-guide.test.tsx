import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { useAuth } from "@/core/auth";
import { GuideProvider, registerGuide } from "@/core/guides";
import { useGuideStore } from "@/core/guides/guide-store";
import { __resetGuideRegistryForTests } from "@/core/guides/registry";
import {
  CreateModuleScreen,
  ModuleDetailScreen,
  ModulesScreen,
  workspaceModulesGuide,
} from "@/features/workspace-admin";

import { successEnvelope } from "@tests/fixtures/api";
import { moduleDetailDto } from "@tests/fixtures/workspace-admin";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock, setPathname, setSearchParams } = await import(
  "@tests/mocks/next-navigation"
);

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

/** Signs a user in with the given roles, mirroring `workspace-admin-modules.test.tsx`. */
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
  setPathname("/app/workspace-admin/modules");
  setSearchParams();
  resetGuideStore();
  __resetGuideRegistryForTests();
  registerGuide(workspaceModulesGuide);
});

describe("the list-create-link step", () => {
  it("shows its tooltip once the guide is running for a Super Admin", async () => {
    useGuideStore.getState().start("workspace-modules");

    render(
      <SignedIn>
        <GuideProvider>
          <ModulesScreen />
        </GuideProvider>
      </SignedIn>,
    );

    expect(await screen.findByText("Register a module")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("is unavailable to a non-Super-Admin — the guide never starts", () => {
    useGuideStore.getState().start("workspace-modules");

    render(
      <SignedIn roles={["BRANCH_ADMIN"]}>
        <GuideProvider>
          <ModulesScreen />
        </GuideProvider>
      </SignedIn>,
    );

    expect(
      screen.queryByText("Register a module"),
    ).not.toBeInTheDocument();
  });
});

describe("creating the module", () => {
  it("captures the new id and advances past create-submit on success", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_BASE}/admin/navigation/modules`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          successEnvelope(moduleDetailDto({ ...body, id: "module-new" } as never)),
          { status: 201 },
        );
      }),
    );
    useGuideStore.getState().start("workspace-modules");
    useGuideStore.getState().setStep(1);
    setPathname("/app/workspace-admin/modules/new");

    render(
      <SignedIn>
        <GuideProvider>
          <CreateModuleScreen />
        </GuideProvider>
      </SignedIn>,
    );

    await user.type(await screen.findByLabelText(/module name/i), "Hostel Management");
    await user.type(screen.getByLabelText(/^code$/i), "HOSTEL");
    await user.click(screen.getByRole("button", { name: /create module/i }));

    await waitFor(() => {
      expect(useGuideStore.getState().stepIndex).toBe(2);
    });
    expect(useGuideStore.getState().entityId).toBe("module-new");
    expect(useGuideStore.getState().status).toBe("running");
  });
});

describe("the id-scoped detail step", () => {
  it("finishes the guide from the Next button, explaining Menus is next", async () => {
    const user = userEvent.setup();
    useGuideStore.getState().start("workspace-modules");
    useGuideStore.getState().setStep(2, "module-1");
    setPathname("/app/workspace-admin/modules/module-1");

    render(
      <SignedIn>
        <GuideProvider>
          <ModuleDetailScreen id="module-1" />
        </GuideProvider>
      </SignedIn>,
    );

    expect(await screen.findByText("Add menus next")).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(() => {
      expect(useGuideStore.getState().status).toBe("completed");
    });
    expect(useGuideStore.getState().completed["workspace-modules"]).toEqual({
      version: 1,
      completedAt: expect.any(String),
    });
  });
});
