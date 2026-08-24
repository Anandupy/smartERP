import { http, HttpResponse } from "msw";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { ROUTES } from "@/constants";
import {
  createMemoryTokenStorage,
  setTokenStorage,
  useAuth,
} from "@/core/auth";
import {
  createMemoryWorkspaceStorage,
  resetWorkspaceSelectionPolicy,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import { WorkspaceSelectionScreen } from "@/features/workspace";

import { successEnvelope } from "@tests/fixtures/api";
import {
  freshInstallSetupDto,
  identityDto,
  setupStatusDto,
} from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } = await import(
    "@tests/mocks/next-navigation"
  );
  return createNextNavigationMock();
});

const { routerMock, resetRouterMock } = await import(
  "@tests/mocks/next-navigation"
);

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

/**
 * `WorkspaceSelectionScreen` is where `/auth/me` is fetched, so it is also
 * where the very first setup-required redirect fires — before this feature
 * existed, a fresh install with zero organizations would have rendered
 * "unavailable" here instead.
 *
 * The session claims here are only a pre-`/auth/me` stand-in — the role that
 * actually decides the outcome is the mocked `/auth/me` response's own
 * `user.role`, exactly as `toWorkspaceAvailability` reads it.
 */
function SignedIn({ children }: { children: React.ReactNode }) {
  const { setSession, isAuthenticated } = useAuth();

  useEffect(() => {
    setSession(
      {
        id: "user-1",
        name: "admin@institution.edu",
        email: "admin@institution.edu",
        roles: ["SUPER_ADMIN"],
        permissions: [],
      },
      { accessToken: "access-token" },
    );
  }, [setSession]);

  return isAuthenticated ? <>{children}</> : null;
}

function renderScreen() {
  return render(
    <SignedIn>
      <WorkspaceSelectionScreen />
    </SignedIn>,
  );
}

function respondWith(dto: unknown) {
  server.use(
    http.get(`${API_BASE}/auth/me`, () =>
      HttpResponse.json(successEnvelope(dto)),
    ),
  );
}

beforeEach(() => {
  resetRouterMock();
  setTokenStorage(createMemoryTokenStorage());
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  resetWorkspaceSelectionPolicy();
  useWorkspaceStore.getState().clear();
});

describe("fresh install", () => {
  it("sends a SUPER_ADMIN to the setup wizard instead of 'no organizations'", async () => {
    respondWith(
      identityDto({
        availableOrganizations: [],
        availableBranches: [],
        availableAcademicYears: [],
        context: null,
        setup: freshInstallSetupDto(),
      }),
    );
    renderScreen();

    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith(ROUTES.setup.root),
    );
    expect(useWorkspaceStore.getState().status).toBe("setup-required");
  });

  it("sends an ORG_ADMIN to the setup wizard too", async () => {
    respondWith(
      identityDto({
        user: { id: "user-2", fullName: "Org Admin", role: "ORG_ADMIN" },
        availableOrganizations: [],
        availableBranches: [],
        availableAcademicYears: [],
        context: null,
        setup: freshInstallSetupDto(),
      }),
    );
    renderScreen();

    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith(ROUTES.setup.root),
    );
  });

  it("leaves a role with no setup authority on the existing 'no organizations' outcome", async () => {
    respondWith(
      identityDto({
        user: { id: "user-3", fullName: "Staff Member", role: "STAFF" },
        availableOrganizations: [],
        availableBranches: [],
        availableAcademicYears: [],
        context: null,
        setup: freshInstallSetupDto(),
      }),
    );
    renderScreen();

    expect(
      await screen.findByText(/no organizations assigned/i),
    ).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalledWith(ROUTES.setup.root);
  });
});

describe("regression: an already-initialized workspace", () => {
  it("behaves exactly as before when the backend omits the setup block", async () => {
    respondWith(identityDto());
    renderScreen();

    expect(
      await screen.findByRole("combobox", { name: /organization/i }),
    ).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("behaves exactly as before when setup is explicitly reported complete", async () => {
    respondWith(identityDto({ setup: setupStatusDto() }));
    renderScreen();

    expect(
      await screen.findByRole("combobox", { name: /organization/i }),
    ).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
