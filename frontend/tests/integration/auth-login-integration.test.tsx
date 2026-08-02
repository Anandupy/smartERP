import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { ROUTES } from "@/constants";
import {
  createMemoryTokenStorage,
  getTokenStorage,
  setTokenStorage,
} from "@/core/auth";
import { LoginScreen, persistTokens, useLockoutStore } from "@/features/auth";
import { successEnvelope } from "@tests/fixtures/api";
import {
  accountLockedEnvelope,
  authTokens,
  invalidCredentialsEnvelope,
} from "@tests/mocks/auth-handlers";
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

async function signIn(
  { remember = false }: { remember?: boolean } = {},
  email = "admin@institution.edu",
  password = "Password123!",
) {
  await userEvent.type(screen.getByLabelText(/institutional email/i), email);
  await userEvent.type(screen.getByLabelText(/^password$/i), password);
  if (remember) {
    await userEvent.click(
      screen.getByRole("checkbox", { name: /remember me on this device/i }),
    );
  }
  await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
}

beforeEach(() => {
  resetRouterMock();
  setTokenStorage(createMemoryTokenStorage());
  useLockoutStore.getState().clear();
});

afterEach(() => {
  setTokenStorage(createMemoryTokenStorage());
});

describe("login → backend", () => {
  it("posts the mapped credentials to the versioned login route", async () => {
    let submitted: unknown = null;
    let requestUrl = "";

    server.use(
      http.post(`${API_BASE}/auth/login`, async ({ request }) => {
        requestUrl = request.url;
        submitted = await request.json();
        return HttpResponse.json(successEnvelope(authTokens), { status: 201 });
      }),
    );

    render(<LoginScreen />);
    await signIn({ remember: true });

    await waitFor(() => expect(submitted).not.toBeNull());

    expect(requestUrl).toBe(`${API_BASE}/auth/login`);
    // `email` became `identifier`; `rememberMe` never left the client.
    expect(submitted).toEqual({
      identifier: "admin@institution.edu",
      password: "Password123!",
    });
  });

  it("stores both tokens and routes into the workspace on success", async () => {
    render(<LoginScreen />);
    await signIn();

    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith(ROUTES.workspace.root),
    );

    expect(getTokenStorage().getAccessToken()).toBe(authTokens.accessToken);
    expect(getTokenStorage().getRefreshToken()).toBe(authTokens.refreshToken);
  });

  it("shows invalid credentials inline and stores nothing", async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(invalidCredentialsEnvelope, { status: 401 }),
      ),
    );

    render(<LoginScreen />);
    await signIn();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/sign-in failed/i);
    // The backend's reason, verbatim.
    expect(alert).toHaveTextContent(/invalid credentials/i);
    expect(getTokenStorage().getAccessToken()).toBeNull();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("never enters the session-expired pipeline on a failed sign-in", async () => {
    let refreshCalls = 0;

    server.use(
      http.post(`${API_BASE}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(successEnvelope(authTokens), { status: 201 });
      }),
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(invalidCredentialsEnvelope, { status: 401 }),
      ),
    );

    // A stale refresh token from a previous session must not tempt the
    // interceptor into "recovering" a rejected login.
    persistTokens({ accessToken: "stale-access", refreshToken: "stale" });

    render(<LoginScreen />);
    await signIn();

    await screen.findByRole("alert");

    expect(refreshCalls).toBe(0);
    expect(routerMock.push).not.toHaveBeenCalledWith(
      ROUTES.auth.sessionExpired,
    );
    expect(routerMock.replace).not.toHaveBeenCalledWith(
      ROUTES.auth.sessionExpired,
    );
    // The user stays put and can retry.
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
  });

  it("does not persist a refresh token when 'remember me' is unchecked", async () => {
    render(<LoginScreen />);
    await signIn({ remember: false });

    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith(ROUTES.workspace.root),
    );

    // Memory-backed storage: nothing survives a reload, which is the point.
    expect(
      window.localStorage.getItem("campusflow:auth.refresh-token"),
    ).toBeNull();
  });

  it("persists the refresh token when 'remember me' is checked", async () => {
    render(<LoginScreen />);
    await signIn({ remember: true });

    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith(ROUTES.workspace.root),
    );

    expect(window.localStorage.getItem("campusflow:auth.refresh-token")).toBe(
      authTokens.refreshToken,
    );
    // The access token stays in memory even when the session is remembered.
    expect(
      window.localStorage.getItem("campusflow:auth.access-token"),
    ).toBeNull();
  });
});

describe("login → account locked", () => {
  it("routes to the Account Locked screen instead of reporting inline", async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(accountLockedEnvelope, { status: 403 }),
      ),
    );

    render(<LoginScreen />);
    await signIn();

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(ROUTES.auth.accountLocked),
    );
  });

  it("carries the backend message through verbatim", async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(accountLockedEnvelope, { status: 403 }),
      ),
    );

    render(<LoginScreen />);
    await signIn();

    await waitFor(() =>
      // Exactly what the server said — no re-wording, no parsed duration.
      expect(useLockoutStore.getState().message).toBe(
        "Account locked. Try again after 7 minutes",
      ),
    );
  });

  it("leaves an ordinary 403 on the form rather than hijacking it", async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "ForbiddenException",
            message: "You do not have permission to perform this action",
          },
          { status: 403 },
        ),
      ),
    );

    render(<LoginScreen />);
    await signIn();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalledWith(ROUTES.auth.accountLocked);
  });
});
