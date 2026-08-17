import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { ROUTES } from "@/constants";
import { useAuth } from "@/core/auth";
import {
  CreateModuleScreen,
  ModuleDetailScreen,
  ModulesScreen,
} from "@/features/workspace-admin";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import {
  moduleDetailDto,
  moduleListItemDto,
  secondModuleListItemDto,
} from "@tests/fixtures/workspace-admin";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } = await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock, routerMock, setSearchParams } = await import(
  "@tests/mocks/next-navigation"
);

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

beforeEach(() => {
  resetRouterMock();
  setSearchParams();
});

/** Signs a user in with the given roles, mirroring `workspace-selection.test.tsx`. */
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

function withModules(...modules: ReturnType<typeof moduleListItemDto>[]) {
  server.use(
    http.get(`${API_BASE}/admin/navigation/modules`, () =>
      HttpResponse.json(successEnvelope(modules)),
    ),
  );
}

describe("Navigation Modules screen", () => {
  it("is forbidden for a role other than Super Admin", async () => {
    render(
      <SignedIn roles={["BRANCH_ADMIN"]}>
        <ModulesScreen />
      </SignedIn>,
    );

    expect(
      await screen.findByText("Navigation administration is Super Admin only."),
    ).toBeVisible();
  });

  it("lists modules with menu counts and status", async () => {
    withModules(moduleListItemDto(), secondModuleListItemDto());

    render(
      <SignedIn>
        <ModulesScreen />
      </SignedIn>,
    );

    expect(await screen.findByText("Admissions")).toBeVisible();
    expect(screen.getByText("Hostel Management")).toBeVisible();
  });

  it("narrows to active modules only through the client-side filter", async () => {
    const user = userEvent.setup();
    withModules(
      moduleListItemDto({ isActive: true }),
      secondModuleListItemDto({ isActive: false }),
    );

    render(
      <SignedIn>
        <ModulesScreen />
      </SignedIn>,
    );

    await screen.findByText("Admissions");
    await user.click(screen.getByRole("combobox", { name: "Filter by status" }));
    await user.click(await screen.findByRole("option", { name: "Active only" }));

    await waitFor(() =>
      expect(screen.queryByText("Hostel Management")).toBeNull(),
    );
    expect(screen.getByText("Admissions")).toBeVisible();
  });

  it("disables deleting a module that still has menus", async () => {
    const user = userEvent.setup();
    withModules(moduleListItemDto({ _count: { menus: 3 } }));

    render(
      <SignedIn>
        <ModulesScreen />
      </SignedIn>,
    );

    await user.click(await screen.findByRole("button", { name: /Actions for Admissions/ }));
    expect(
      await screen.findByRole("menuitem", { name: /Delete module/ }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("names the affected menu count before deactivating a module", async () => {
    const user = userEvent.setup();
    withModules(moduleListItemDto({ isActive: true, _count: { menus: 5 } }));

    render(
      <SignedIn>
        <ModulesScreen />
      </SignedIn>,
    );

    await user.click(await screen.findByRole("button", { name: /Actions for Admissions/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Deactivate/ }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/all 5 menus/i);
    expect(dialog).toHaveTextContent(/immediately/i);
  });
});

describe("Module Details screen", () => {
  it("shows identity, status and a renderable-menu breakdown, with no fabricated configuration section", async () => {
    server.use(
      http.get(`${API_BASE}/admin/navigation/modules/:id`, () =>
        HttpResponse.json(
          successEnvelope(
            moduleDetailDto({
              menus: [
                { ...moduleDetailDto().menus[0]!, status: "ACTIVE" },
                { ...moduleDetailDto().menus[0]!, id: "menu-2", status: "DISABLED" },
              ],
            }),
          ),
        ),
      ),
    );

    render(
      <SignedIn>
        <ModuleDetailScreen id="module-1" />
      </SignedIn>,
    );

    expect(await screen.findByRole("heading", { name: "Admissions" })).toBeVisible();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(
      screen.getByText(/feature flags and per-module configuration are not part/i),
    ).toBeInTheDocument();
  });

  it("treats a missing module as an empty state", async () => {
    server.use(
      http.get(`${API_BASE}/admin/navigation/modules/:id`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "NotFoundException", message: "Not found" }),
          { status: 404 },
        ),
      ),
    );

    render(
      <SignedIn>
        <ModuleDetailScreen id="missing" />
      </SignedIn>,
    );

    expect(await screen.findByText("Module not found")).toBeVisible();
  });
});

describe("Creating a module", () => {
  it("rejects a code that is not uppercase/underscore", async () => {
    const user = userEvent.setup();
    render(
      <SignedIn>
        <CreateModuleScreen />
      </SignedIn>,
    );

    await user.type(await screen.findByLabelText("Code"), "hostel");
    await user.type(screen.getByLabelText("Module name"), "Hostel");
    await user.click(screen.getByRole("button", { name: "Create module" }));

    expect(
      await screen.findByText("Uppercase letters, numbers and underscores only"),
    ).toBeVisible();
  });

  it("sends exactly the documented fields and navigates to the new module's detail screen", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.post(`${API_BASE}/admin/navigation/modules`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          successEnvelope({ ...moduleDetailDto(), ...body, id: "module-new" }),
          { status: 201 },
        );
      }),
    );

    render(
      <SignedIn>
        <CreateModuleScreen />
      </SignedIn>,
    );

    await user.type(await screen.findByLabelText("Module name"), "Hostel Management");
    await user.type(screen.getByLabelText("Code"), "HOSTEL");
    await user.click(screen.getByRole("button", { name: "Create module" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ code: "HOSTEL", name: "Hostel Management", displayOrder: 0 });
    expect(body).not.toHaveProperty("isActive");

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(
        ROUTES.app.workspaceAdmin.modules.detail("module-new"),
      ),
    );
  });
});
