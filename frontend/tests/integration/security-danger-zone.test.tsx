import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { createMemoryTokenStorage, setTokenStorage } from "@/core/auth";
import { DangerZoneScreen } from "@/features/security";
import { persistTokens } from "@/features/auth";

import { successEnvelope } from "@tests/fixtures/api";
import { makeAccessToken } from "@tests/mocks/auth-handlers";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor, within } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock, routerMock } = await import(
  "@tests/mocks/next-navigation"
);

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

beforeEach(() => {
  resetRouterMock();
  // `useLogout` only calls the API when a refresh token is stored — mirror a
  // signed-in session, exactly as `auth-session-lifecycle.test.tsx` does.
  setTokenStorage(createMemoryTokenStorage());
  persistTokens({ accessToken: makeAccessToken(), refreshToken: "refresh-1" });
});

describe("Danger Zone", () => {
  it("renders the two real actions and the two backend-pending ones", () => {
    render(<DangerZoneScreen />);

    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out everywhere" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Backend Pending")).toHaveLength(2);
  });

  it("signs out this device without a confirmation dialog", async () => {
    const user = userEvent.setup();
    let loggedOutAllDevices: boolean | null = null;

    server.use(
      http.post(`${API_BASE}/auth/logout`, ({ request }) => {
        loggedOutAllDevices = request.url.includes("allDevices=true");
        return HttpResponse.json(successEnvelope(null), { status: 201 });
      }),
    );

    render(<DangerZoneScreen />);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(loggedOutAllDevices).toBe(false));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalled());
  });

  it("requires confirmation before signing out every device", async () => {
    const user = userEvent.setup();
    let loggedOutAllDevices: boolean | null = null;

    server.use(
      http.post(`${API_BASE}/auth/logout`, ({ request }) => {
        loggedOutAllDevices = request.url.includes("allDevices=true");
        return HttpResponse.json(successEnvelope(null), { status: 201 });
      }),
    );

    render(<DangerZoneScreen />);

    await user.click(
      screen.getByRole("button", { name: "Sign out everywhere" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/including this one/i);
    expect(loggedOutAllDevices).toBeNull();

    await user.click(
      within(dialog).getByRole("button", { name: "Sign out everywhere" }),
    );

    await waitFor(() => expect(loggedOutAllDevices).toBe(true));
  });
});
