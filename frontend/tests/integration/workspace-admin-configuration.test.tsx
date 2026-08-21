import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { useAuth } from "@/core/auth";
import {
  createMemoryWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import { ConfigurationEditorScreen } from "@/features/workspace-admin";
import { toWorkspaceAvailability } from "@/features/workspace";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { identityDto } from "@tests/fixtures/workspace";
import { workspaceConfigurationDto } from "@tests/fixtures/workspace-admin";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } = await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock } = await import("@tests/mocks/next-navigation");

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

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

beforeEach(() => {
  resetRouterMock();
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  useWorkspaceStore.setState({
    availability: toWorkspaceAvailability(identityDto()),
    selection: { organizationId: "org-1", branchId: "branch-1", academicYearId: "ay-2026" },
    status: "ready",
    reason: null,
  });
});

describe("Configuration Layer Editor", () => {
  it("is forbidden for a role other than Super Admin — mirrors the backend's own guard", async () => {
    render(
      <SignedIn roles={["ORG_ADMIN"]}>
        <ConfigurationEditorScreen />
      </SignedIn>,
    );

    expect(
      await screen.findByText(/Workspace configuration is Super Admin only/),
    ).toBeVisible();
  });

  it("prompts to choose a scope before any field is touched (no scopeId yet for the default USER scope)", async () => {
    render(
      <SignedIn>
        <ConfigurationEditorScreen />
      </SignedIn>,
    );

    expect(
      await screen.findByText(/Choose a scope to load its existing configuration/),
    ).toBeVisible();
  });

  it("loads and prefills an existing layer for the chosen scope", async () => {
    const user = userEvent.setup();

    // The scopeId text field fires a lookup on every keystroke, not only the
    // final value — respond to all of them with the same existing layer.
    server.use(
      http.get(`${API_BASE}/workspace/configuration/USER`, () =>
        HttpResponse.json(
          successEnvelope(
            workspaceConfigurationDto({
              id: "config-existing",
              scopeType: "USER",
              scopeId: "user-42",
              navigationPreferences: { sidebarCollapsed: true },
              clientPreferences: { theme: "dark" },
            }),
          ),
        ),
      ),
    );

    render(
      <SignedIn>
        <ConfigurationEditorScreen />
      </SignedIn>,
    );

    await user.type(await screen.findByLabelText("User id"), "user-42");

    expect(
      await screen.findByText("Editing existing layer config-existing"),
    ).toBeVisible();
    expect(
      await screen.findByRole("combobox", { name: "Sidebar collapsed" }),
    ).toHaveTextContent("On");
  });

  it("states plainly when no layer exists yet for the chosen scope", async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/workspace/configuration/USER`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "NOT_FOUND",
            message: "No configuration layer exists for this scope",
          }),
          { status: 404 },
        ),
      ),
    );

    render(
      <SignedIn>
        <ConfigurationEditorScreen />
      </SignedIn>,
    );

    await user.type(await screen.findByLabelText("User id"), "user-99");

    expect(
      await screen.findByText(/No configuration layer exists yet for this scope/),
    ).toBeVisible();
  });

  it("omits untouched preference fields from the request body, defaulting to a USER scope", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.post(`${API_BASE}/workspace/configuration`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          successEnvelope(workspaceConfigurationDto()),
          { status: 201 },
        );
      }),
    );

    render(
      <SignedIn>
        <ConfigurationEditorScreen />
      </SignedIn>,
    );

    await user.type(await screen.findByLabelText("User id"), "user-42");
    await user.click(screen.getByRole("button", { name: "Save configuration layer" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ scopeType: "USER", scopeId: "user-42" });
    expect(body!.navigationPreferences).toBeUndefined();
    expect(body!.clientPreferences).toBeUndefined();
  });

  it("sends only the preference fields the user actually set, as a tri-state boolean", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.post(`${API_BASE}/workspace/configuration`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(workspaceConfigurationDto()), {
          status: 201,
        });
      }),
    );

    render(
      <SignedIn>
        <ConfigurationEditorScreen />
      </SignedIn>,
    );

    await user.click(await screen.findByRole("combobox", { name: "Scope type" }));
    await user.click(await screen.findByRole("option", { name: "Product (global default)" }));

    await user.click(screen.getByRole("combobox", { name: "Sidebar collapsed" }));
    await user.click(await screen.findByRole("option", { name: "On" }));

    await user.click(screen.getByRole("button", { name: "Save configuration layer" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ scopeType: "PRODUCT", scopeId: null });
    expect(body!.navigationPreferences).toEqual({ sidebarCollapsed: true });
  });

  it("shows the saved layer's id on success", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_BASE}/workspace/configuration`, () =>
        HttpResponse.json(
          successEnvelope(workspaceConfigurationDto({ id: "config-42" })),
          { status: 201 },
        ),
      ),
    );

    render(
      <SignedIn>
        <ConfigurationEditorScreen />
      </SignedIn>,
    );

    await user.type(await screen.findByLabelText("User id"), "user-42");
    await user.click(screen.getByRole("button", { name: "Save configuration layer" }));

    expect(await screen.findByText("config-42")).toBeVisible();
  });
});
