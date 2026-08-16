import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { createMemoryTokenStorage, setTokenStorage } from "@/core/auth";
import { persistTokens } from "@/features/auth";
import { ActiveSessionsScreen } from "@/features/security";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { makeAccessToken } from "@tests/mocks/auth-handlers";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock, routerMock } = await import(
  "@tests/mocks/next-navigation"
);

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

type SessionRow = {
  id: string;
  device: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "session-1",
    device: "Desktop",
    ipAddress: "203.0.113.42",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    createdAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

function withSessions(...sessions: SessionRow[]) {
  server.use(
    http.get(`${API_BASE}/auth/sessions`, () =>
      HttpResponse.json(successEnvelope(sessions)),
    ),
  );
}

beforeEach(() => {
  resetRouterMock();
  // `useLogout` only calls the API when a refresh token is stored.
  setTokenStorage(createMemoryTokenStorage());
  persistTokens({ accessToken: makeAccessToken(), refreshToken: "refresh-1" });
});

describe("Active Sessions", () => {
  it("lists every session GET /auth/sessions returns, with no session marked current", async () => {
    withSessions(
      session({ id: "session-1", device: "Desktop" }),
      session({ id: "session-2", device: "Mobile", ipAddress: "198.51.100.7" }),
    );

    render(<ActiveSessionsScreen />);

    await screen.findByText("203.0.113.42", { exact: false });
    expect(screen.getByText("198.51.100.7", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/current session/i)).toBeNull();
    expect(screen.queryByText(/this device/i)).toBeNull();
  });

  it("shows the empty state when there are no sessions", async () => {
    withSessions();

    render(<ActiveSessionsScreen />);

    expect(await screen.findByText("No active sessions")).toBeInTheDocument();
  });

  it("renders the shared error state on failure", async () => {
    server.use(
      http.get(`${API_BASE}/auth/sessions`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "InternalServerError", message: "Boom" }),
          { status: 500 },
        ),
      ),
    );

    render(<ActiveSessionsScreen />);

    expect(await screen.findByText(/Something went wrong/i)).toBeInTheDocument();
  });

  it("opens the details drawer for a session and shows only real fields", async () => {
    const user = userEvent.setup();
    withSessions(session({ id: "session-1" }));

    render(<ActiveSessionsScreen />);

    await user.click(await screen.findByRole("button", { name: "Details" }));

    const drawer = await screen.findByRole("dialog");
    expect(drawer).toHaveTextContent("Desktop");
    expect(drawer).toHaveTextContent("203.0.113.42");
    expect(drawer).toHaveTextContent("session-1");
    expect(drawer).toHaveTextContent(/not available/i);
  });

  it("revokes a session only after confirmation", async () => {
    const user = userEvent.setup();
    let revoked: string | null = null;

    withSessions(session({ id: "session-9" }));
    server.use(
      http.delete(`${API_BASE}/auth/sessions/:id`, ({ params }) => {
        revoked = String(params.id);
        return HttpResponse.json(successEnvelope(null));
      }),
    );

    render(<ActiveSessionsScreen />);

    await user.click(
      (await screen.findAllByRole("button", { name: "Revoke" }))[0]!,
    );
    expect(revoked).toBeNull();

    await user.click(
      await screen.findByRole("button", { name: "Revoke session" }),
    );

    await waitFor(() => expect(revoked).toBe("session-9"));
  });

  it("offers sign-out-all only with more than one session, and it clears the local session", async () => {
    const user = userEvent.setup();
    let loggedOut = false;

    withSessions(session({ id: "session-1" }), session({ id: "session-2" }));
    server.use(
      http.post(`${API_BASE}/auth/logout`, ({ request }) => {
        loggedOut = request.url.includes("allDevices=true");
        return HttpResponse.json(successEnvelope(null), { status: 201 });
      }),
    );

    render(<ActiveSessionsScreen />);

    await user.click(
      await screen.findByRole("button", { name: /Sign out of all devices/ }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Sign out everywhere" }),
    );

    await waitFor(() => expect(loggedOut).toBe(true));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalled());
  });
});
