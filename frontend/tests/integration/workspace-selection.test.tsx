import userEvent from "@testing-library/user-event";
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
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import { WorkspaceSelectionScreen } from "@/features/workspace";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import {
  identityDto,
  organizationsFixture,
  scopedRoleIdentity,
  singleChoiceIdentity,
} from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { routerMock, resetRouterMock } =
  await import("@tests/mocks/next-navigation");

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

/**
 * The screen is only reachable with a session, and `useIdentity` is gated on
 * one. This establishes the same starting point the app has: signed in from the
 * access token's claims, with identity not yet loaded.
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

/** Open a Radix select by its label and choose the named option. */
async function chooseFrom(label: RegExp, option: RegExp) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
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
  useWorkspaceStore.getState().clear();
});

describe("workspace selection", () => {
  it("announces that it is loading before identity arrives", () => {
    renderScreen();
    expect(screen.getByText("Loading your workspaces")).toBeInTheDocument();
  });

  it("names the page's task as its heading", async () => {
    renderScreen();
    expect(
      screen.getByRole("heading", { level: 1, name: /choose your workspace/i }),
    ).toBeInTheDocument();
  });

  it("shows the three steps and the signed-in identity", async () => {
    renderScreen();

    expect(
      await screen.findByRole("combobox", { name: /organization/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /campus/i })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /academic year/i }),
    ).toBeInTheDocument();

    // The real name replaces the email the token claims stood in with.
    expect(await screen.findByText("Amaan Sheikh")).toBeInTheDocument();
  });
});

describe("cascading", () => {
  it("replaces the campuses when the organization changes", async () => {
    renderScreen();
    await screen.findByRole("combobox", { name: /organization/i });

    await chooseFrom(/organization/i, /universal educational trust/i);
    expect(
      screen.getByRole("radio", { name: /downtown campus/i }),
    ).toBeInTheDocument();

    await chooseFrom(/organization/i, /northfield education group/i);

    await waitFor(() =>
      expect(
        screen.queryByRole("radio", { name: /downtown campus/i }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("radio", { name: /northfield central/i }),
    ).toBeInTheDocument();
  });

  it("offers no campuses until an organization is chosen", async () => {
    renderScreen();
    await screen.findByRole("combobox", { name: /organization/i });

    expect(
      screen.getByText(/select an organization first to see its campuses/i),
    ).toBeInTheDocument();
  });
});

describe("continuing", () => {
  it("names the missing level instead of failing silently", async () => {
    renderScreen();
    await screen.findByRole("combobox", { name: /organization/i });

    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /select an organization/i,
    );
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("enters the app once every level is answered", async () => {
    renderScreen();
    await screen.findByRole("combobox", { name: /organization/i });

    await chooseFrom(/organization/i, /universal educational trust/i);
    await userEvent.click(
      screen.getByRole("radio", { name: /downtown campus/i }),
    );
    await chooseFrom(/academic year/i, /ay 2026-2027/i);

    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith(ROUTES.app.root),
    );
  });
});

describe("skipping the choice", () => {
  it("goes straight to the app when there is only one possible answer", async () => {
    respondWith(singleChoiceIdentity());
    renderScreen();

    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith(ROUTES.app.root),
    );

    // The user was never asked, so no control was ever rendered.
    expect(
      screen.queryByRole("combobox", { name: /organization/i }),
    ).not.toBeInTheDocument();
  });

  it("goes straight to the app for a backend-scoped role", async () => {
    // A branch administrator does not choose which campus they administer,
    // even though the payload lists several.
    respondWith(scopedRoleIdentity());
    renderScreen();

    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith(ROUTES.app.root),
    );
    expect(useWorkspaceStore.getState().selection.branchId).toBe("branch-1");
  });
});

describe("nothing to enter", () => {
  it("explains an account mapped to no organization", async () => {
    respondWith(
      identityDto({
        context: null,
        availableOrganizations: [],
        availableBranches: [],
        availableAcademicYears: [],
      }),
    );
    renderScreen();

    expect(
      await screen.findByText(/no organizations assigned/i),
    ).toBeInTheDocument();
    // Nothing failed, so there is nothing to retry — only someone to ask.
    expect(
      screen.queryByRole("button", { name: /try again/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /contact an administrator/i }),
    ).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("names the level that is empty, not just the outcome", async () => {
    // One organization, so it settles automatically and the gap is genuinely
    // the campus level — with two on offer the user simply has not chosen yet,
    // which is a selection state rather than an empty one.
    respondWith(
      identityDto({
        availableOrganizations: [organizationsFixture[0]],
        availableBranches: [],
      }),
    );
    renderScreen();

    expect(
      await screen.findByText(/no campuses available/i),
    ).toBeInTheDocument();
  });
});

describe("failures", () => {
  it("offers a retry and recovers on the second attempt", async () => {
    let attempts = 0;
    server.use(
      http.get(`${API_BASE}/auth/me`, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json(
              errorEnvelope({
                code: "InternalServerErrorException",
                message: "Identity service unavailable",
              }),
              { status: 500 },
            )
          : HttpResponse.json(successEnvelope(identityDto()));
      }),
    );

    renderScreen();

    expect(
      await screen.findByText(/unable to load your workspaces/i),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(
      await screen.findByRole("combobox", { name: /organization/i }),
    ).toBeInTheDocument();
  });

  it("does not offer a retry for a refusal, which would only be refused again", async () => {
    server.use(
      http.get(`${API_BASE}/auth/me`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "ForbiddenException",
            message: "Your account cannot access workspaces.",
          }),
          { status: 403 },
        ),
      ),
    );

    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /your account cannot access workspaces/i,
    );
    expect(
      screen.queryByRole("button", { name: /try again/i }),
    ).not.toBeInTheDocument();
  });
});
