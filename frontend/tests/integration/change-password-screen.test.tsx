import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { createMemoryTokenStorage, setTokenStorage } from "@/core/auth";
import { persistTokens } from "@/features/auth";
import { ChangePasswordScreen } from "@/features/security";

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

const VALID_CURRENT = "OldPassword123!";
const VALID_NEW = "NewPassword456!";

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: { current?: string; next?: string; confirm?: string } = {},
) {
  await user.type(
    screen.getByLabelText("Current password"),
    overrides.current ?? VALID_CURRENT,
  );
  await user.type(
    screen.getByLabelText("New password"),
    overrides.next ?? VALID_NEW,
  );
  await user.type(
    screen.getByLabelText("Confirm new password"),
    overrides.confirm ?? VALID_NEW,
  );
}

describe("Change Password screen", () => {
  beforeEach(() => {
    resetRouterMock();
    setTokenStorage(createMemoryTokenStorage());
    persistTokens({ accessToken: makeAccessToken(), refreshToken: "refresh-1" });
  });

  it("ships a real, enabled form", () => {
    render(<ChangePasswordScreen />);

    expect(screen.getByLabelText("Current password")).toBeEnabled();
    expect(screen.getByLabelText("New password")).toBeEnabled();
    expect(screen.getByLabelText("Confirm new password")).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Update password" }),
    ).toBeEnabled();
    expect(screen.queryByText("Backend Pending")).toBeNull();
  });

  it("submits current/new password and signs the device out on success", async () => {
    const user = userEvent.setup();
    let receivedBody: unknown = null;

    server.use(
      http.post(`${API_BASE}/auth/change-password`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(
          successEnvelope(null, { message: "Password changed successfully" }),
          { status: 201 },
        );
      }),
    );

    render(<ChangePasswordScreen />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(receivedBody).toEqual({
        currentPassword: VALID_CURRENT,
        newPassword: VALID_NEW,
      }),
    );

    // Every refresh token was revoked server-side, so the client mirrors a
    // sign-out: local session cleared, redirected to login.
    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith("/login"),
    );
  });

  it("shows the backend's error inline and does not redirect on failure", async () => {
    const user = userEvent.setup();

    server.use(
      http.post(`${API_BASE}/auth/change-password`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "UNAUTHORIZED",
            message: "Current password is incorrect",
          }),
          { status: 401 },
        ),
      ),
    );

    render(<ChangePasswordScreen />);
    await fillForm(user, { current: "WrongPassword123!" });
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      await screen.findByText("Current password is incorrect"),
    ).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("prevents duplicate submission while the request is in flight", async () => {
    const user = userEvent.setup();
    let callCount = 0;

    server.use(
      http.post(`${API_BASE}/auth/change-password`, async () => {
        callCount += 1;
        // Long enough that the mutation is still pending through the second
        // click's full user-event dispatch sequence (pointerdown…click) —
        // too short a delay makes this race instead of testing prevention.
        await new Promise((resolve) => setTimeout(resolve, 300));
        return HttpResponse.json(successEnvelope(null), { status: 201 });
      }),
    );

    render(<ChangePasswordScreen />);
    await fillForm(user);

    const button = screen.getByRole("button", { name: "Update password" });
    await user.click(button);
    // Wait for the disabled state to actually land before the second click —
    // validation runs asynchronously, so it is not guaranteed to have applied
    // in the same tick `user.click` resolves in.
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalled());
    expect(callCount).toBe(1);
  });

  it("validates the new password against the advertised policy client-side", async () => {
    const user = userEvent.setup();
    let called = false;

    server.use(
      http.post(`${API_BASE}/auth/change-password`, () => {
        called = true;
        return HttpResponse.json(successEnvelope(null), { status: 201 });
      }),
    );

    render(<ChangePasswordScreen />);
    await fillForm(user, { next: "short", confirm: "short" });
    await user.click(screen.getByRole("button", { name: "Update password" }));

    // "At least 12 characters" also appears in the always-rendered strength
    // checklist — the field's own form-message element is what matters here.
    expect(
      await screen.findByText("At least 12 characters", {
        selector: '[data-slot="form-message"]',
      }),
    ).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("flags a new/confirm password mismatch without calling the backend", async () => {
    const user = userEvent.setup();
    let called = false;

    server.use(
      http.post(`${API_BASE}/auth/change-password`, () => {
        called = true;
        return HttpResponse.json(successEnvelope(null), { status: 201 });
      }),
    );

    render(<ChangePasswordScreen />);
    await fillForm(user, { confirm: "SomethingElse123!" });
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(called).toBe(false);
  });
});
