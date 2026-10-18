import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { useAuth } from "@/core/auth";
import { MenusScreen } from "@/features/workspace-admin";

import { successEnvelope } from "@tests/fixtures/api";
import {
  childMenuListItemDto,
  menuListItemDto,
  moduleListItemDto,
} from "@tests/fixtures/workspace-admin";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor, within } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } = await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock, setSearchParams } = await import("@tests/mocks/next-navigation");

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

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

beforeEach(() => {
  resetRouterMock();
  setSearchParams();
  server.use(
    http.get(`${API_BASE}/admin/navigation/modules`, () =>
      HttpResponse.json(successEnvelope([moduleListItemDto()])),
    ),
  );
});

function withMenus(...menus: ReturnType<typeof menuListItemDto>[]) {
  server.use(
    http.get(`${API_BASE}/admin/navigation/menus`, () =>
      HttpResponse.json(successEnvelope(menus)),
    ),
  );
}

describe("Menu Details screen", () => {
  it("is forbidden for a role other than Super Admin", async () => {
    render(
      <SignedIn roles={["STAFF"]}>
        <MenusScreen />
      </SignedIn>,
    );

    expect(
      await screen.findByText("Navigation administration is Super Admin only."),
    ).toBeVisible();
  });

  it("renders the menu hierarchy of the default module as a tree", async () => {
    withMenus(menuListItemDto(), childMenuListItemDto());

    render(
      <SignedIn>
        <MenusScreen />
      </SignedIn>,
    );

    expect(await screen.findByText("Applicants")).toBeVisible();
    expect(screen.getByText("New Applicant")).toBeVisible();
    expect(screen.getByRole("tree", { name: "Menus in this module" })).toBeVisible();
  });

  it("shows a menu's detail on selection, including that hiding it does not revoke route access", async () => {
    const user = userEvent.setup();
    withMenus(menuListItemDto());

    render(
      <SignedIn>
        <MenusScreen />
      </SignedIn>,
    );

    await user.click(await screen.findByText("Applicants"));

    expect(
      await screen.findByText(/Hiding a menu here does not revoke access to its route/),
    ).toBeVisible();
    expect(screen.getByText("/admissions/applicants")).toBeInTheDocument();
  });

  it("creates a menu with the fields split from comma-separated text into arrays", async () => {
    const user = userEvent.setup();
    withMenus();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.post(`${API_BASE}/admin/navigation/menus`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          successEnvelope({ ...menuListItemDto(), ...body, id: "menu-new" }),
          { status: 201 },
        );
      }),
    );

    render(
      <SignedIn>
        <MenusScreen />
      </SignedIn>,
    );

    await user.click(await screen.findByRole("button", { name: "New menu" }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Display name"), "Applicants");
    await user.type(within(dialog).getByLabelText("Code"), "ADMISSIONS_APPLICANTS");
    await user.type(within(dialog).getByLabelText("Route"), "/admissions/applicants");
    await user.type(
      within(dialog).getByLabelText("Required permissions"),
      "admissions.view, admissions.manage",
    );

    await user.click(within(dialog).getByRole("button", { name: "Create menu" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      code: "ADMISSIONS_APPLICANTS",
      route: "/admissions/applicants",
      permissions: ["admissions.view", "admissions.manage"],
    });
  });

  it("explains why deleting a menu with children is blocked", async () => {
    const user = userEvent.setup();
    withMenus(menuListItemDto(), childMenuListItemDto());

    render(
      <SignedIn>
        <MenusScreen />
      </SignedIn>,
    );

    await user.click(await screen.findByText("Applicants"));
    await user.click(await screen.findByRole("button", { name: /^Delete$/ }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/has child menus and cannot be deleted/i);
  });

  it("deletes a leaf menu once confirmed", async () => {
    const user = userEvent.setup();
    withMenus(menuListItemDto());
    let deleted: string | null = null;

    server.use(
      http.delete(`${API_BASE}/admin/navigation/menus/:id`, ({ params }) => {
        deleted = String(params.id);
        return HttpResponse.json(successEnvelope({ success: true }));
      }),
    );

    render(
      <SignedIn>
        <MenusScreen />
      </SignedIn>,
    );

    await user.click(await screen.findByText("Applicants"));
    await user.click(await screen.findByRole("button", { name: /^Delete$/ }));
    await user.click(await screen.findByRole("button", { name: "Delete menu" }));

    await waitFor(() => expect(deleted).toBe("menu-1"));
  });
});
