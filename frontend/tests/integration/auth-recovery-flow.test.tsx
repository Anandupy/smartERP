import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { ROUTES } from "@/constants";
import {
  EmailSentScreen,
  ForgotPasswordScreen,
  OtpVerificationScreen,
  RESEND_COOLDOWN_SECONDS,
  ResetPasswordScreen,
  useRecoveryStore,
} from "@/features/auth";
import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { routerMock, resetRouterMock, setSearchParams } =
  await import("@tests/mocks/next-navigation");

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

const IDENTIFIER = "admin@institution.edu";

/** Put the flow store where a given step expects to find it. */
function seedFlow({ verified = false } = {}) {
  act(() => {
    useRecoveryStore.getState().startRecovery(IDENTIFIER);
    if (verified) useRecoveryStore.getState().completeVerification("token-123");
  });
}

beforeEach(() => {
  resetRouterMock();
  act(() => useRecoveryStore.getState().reset());
});

describe("<ForgotPasswordScreen />", () => {
  it("names the page and labels the control", () => {
    render(<ForgotPasswordScreen />);

    expect(
      screen.getByRole("heading", { level: 1, name: /reset your password/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/institutional email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to login/i }),
    ).toHaveAttribute("href", ROUTES.auth.login);
  });

  it("blocks submission and reports an invalid email", async () => {
    render(<ForgotPasswordScreen />);

    await userEvent.type(screen.getByLabelText(/institutional email/i), "nope");
    await userEvent.click(
      screen.getByRole("button", { name: /send reset code/i }),
    );

    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("records the identifier and advances on a valid email", async () => {
    render(<ForgotPasswordScreen />);

    await userEvent.type(
      screen.getByLabelText(/institutional email/i),
      IDENTIFIER,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /send reset code/i }),
    );

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(ROUTES.auth.emailSent),
    );
    expect(useRecoveryStore.getState().identifier).toBe(IDENTIFIER);
  });
});

describe("<EmailSentScreen />", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the address the code was sent to", () => {
    seedFlow();
    render(<EmailSentScreen />);

    expect(
      screen.getByRole("heading", { level: 1, name: /check your email/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(IDENTIFIER)).toBeInTheDocument();
  });

  it("throttles resend behind a visible countdown", () => {
    seedFlow();
    render(<EmailSentScreen />);

    const throttled = screen.getByRole("button", { name: /resend in \d/i });
    expect(throttled).toBeDisabled();

    // `useCountdown` ticks on a persistent interval, so one bulk advance fires
    // every tick — unlike the splash boot sequence, which chains timeouts.
    act(() => void vi.advanceTimersByTime(RESEND_COOLDOWN_SECONDS * 1_000));

    expect(
      screen.getByRole("button", { name: /^resend email$/i }),
    ).toBeEnabled();
  });

  it("offers no 'continue' step — the flow resumes in the inbox", () => {
    seedFlow();
    render(<EmailSentScreen />);

    // Regression: this screen used to send users to /verify-otp, which dead-ends
    // because the backend resets passwords with an emailed link, not a code.
    expect(
      screen.queryByRole("link", { name: /verification code/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /continue/i }),
    ).not.toBeInTheDocument();
  });

  it("sends the visitor back to the start when the flow state is gone", () => {
    render(<EmailSentScreen />);

    expect(
      screen.getByRole("heading", { level: 1, name: /start again/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /reset your password/i }),
    ).toHaveAttribute("href", ROUTES.auth.forgotPassword);
  });
});

// Real timers: `userEvent` drives its own internal delays, which the fake
// timers used for the resend countdown above would starve.
describe("<EmailSentScreen /> interactions", () => {
  it("clears the flow when the visitor changes email", async () => {
    seedFlow();
    render(<EmailSentScreen />);

    await userEvent.click(
      screen.getByRole("button", { name: /use a different email/i }),
    );

    expect(useRecoveryStore.getState().identifier).toBeNull();
    expect(routerMock.push).toHaveBeenCalledWith(ROUTES.auth.forgotPassword);
  });
});

describe("<OtpVerificationScreen />", () => {
  it("labels the code field and shows the destination", () => {
    seedFlow();
    render(<OtpVerificationScreen />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /enter verification code/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(IDENTIFIER)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/6-digit verification code/i),
    ).toBeInTheDocument();
  });

  it("rejects an incomplete code", async () => {
    seedFlow();
    render(<OtpVerificationScreen />);

    await userEvent.type(
      screen.getByLabelText(/6-digit verification code/i),
      "123",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /verify and continue/i }),
    );

    expect(
      await screen.findByText("Enter the 6-digit code"),
    ).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("accepts a pasted six-digit code and advances", async () => {
    seedFlow();
    render(<OtpVerificationScreen />);

    const field = screen.getByLabelText(/6-digit verification code/i);
    await userEvent.click(field);
    await userEvent.paste("123456");

    expect(field).toHaveValue("123456");

    await userEvent.click(
      screen.getByRole("button", { name: /verify and continue/i }),
    );

    // OTP is no longer part of password recovery — the backend resets via an
    // emailed link — so a verified code returns to login by default rather
    // than to a reset screen that would have no token.
    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(ROUTES.auth.login),
    );
    expect(useRecoveryStore.getState().isVerified).toBe(true);
  });

  it("guards against arriving without a flow", () => {
    render(<OtpVerificationScreen />);
    expect(
      screen.getByRole("heading", { level: 1, name: /start again/i }),
    ).toBeInTheDocument();
  });
});

describe("<ResetPasswordScreen />", () => {
  const RESET_LINK_TOKEN = "a4f7b2c9deadbeef";

  it("explains an incomplete link instead of showing an unusable form", () => {
    // No `?token=` — a mistyped link, one truncated by a mail client, or the
    // page opened directly.
    render(<ResetPasswordScreen />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /this reset link is incomplete/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /request a new link/i }),
    ).toHaveAttribute("href", ROUTES.auth.forgotPassword);
    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();
  });

  it("renders the form when the emailed link carries a token", () => {
    setSearchParams({ token: RESET_LINK_TOKEN });
    render(<ResetPasswordScreen />);

    expect(
      screen.getByRole("heading", { level: 1, name: /create new password/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
  });

  it("needs no prior client-side flow state", () => {
    // The email is the proof of ownership, so a fresh browser must work.
    setSearchParams({ token: RESET_LINK_TOKEN });
    render(<ResetPasswordScreen />);

    expect(useRecoveryStore.getState().identifier).toBeNull();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
  });

  it("reflects policy progress as the password is typed", async () => {
    setSearchParams({ token: RESET_LINK_TOKEN });
    render(<ResetPasswordScreen />);

    expect(screen.getByText(/enter a password/i)).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText(/^new password$/i),
      "Str0ng-Passphrase!",
    );

    expect(await screen.findByText("Strong")).toBeInTheDocument();
  });

  it("reports a mismatched confirmation without submitting", async () => {
    setSearchParams({ token: RESET_LINK_TOKEN });
    render(<ResetPasswordScreen />);

    await userEvent.type(
      screen.getByLabelText(/^new password$/i),
      "Str0ng-Passphrase!",
    );
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      "Different-Passphrase1!",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("submits the link token and advances on success", async () => {
    setSearchParams({ token: RESET_LINK_TOKEN });

    let submitted: unknown = null;
    server.use(
      http.post(`${API_BASE}/auth/reset-password`, async ({ request }) => {
        submitted = await request.json();
        return HttpResponse.json(successEnvelope(null), { status: 201 });
      }),
    );

    render(<ResetPasswordScreen />);

    await userEvent.type(
      screen.getByLabelText(/^new password$/i),
      "Str0ng-Passphrase!",
    );
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      "Str0ng-Passphrase!",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(ROUTES.auth.passwordSuccess),
    );
    // The token comes from the URL; `confirmPassword` never leaves the client.
    expect(submitted).toEqual({
      token: RESET_LINK_TOKEN,
      password: "Str0ng-Passphrase!",
    });
  });

  it("surfaces an expired or consumed token inline", async () => {
    setSearchParams({ token: "stale-token" });
    server.use(
      http.post(`${API_BASE}/auth/reset-password`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "BadRequestException",
            message: "Invalid or expired password reset token",
          }),
          { status: 400 },
        ),
      ),
    );

    render(<ResetPasswordScreen />);

    await userEvent.type(
      screen.getByLabelText(/^new password$/i),
      "Str0ng-Passphrase!",
    );
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      "Str0ng-Passphrase!",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /invalid or expired password reset token/i,
    );
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("toggles visibility on each password field independently", async () => {
    setSearchParams({ token: RESET_LINK_TOKEN });
    render(<ResetPasswordScreen />);

    const newPassword = screen.getByLabelText(/^new password$/i);
    expect(newPassword).toHaveAttribute("type", "password");

    const [firstToggle] = screen.getAllByRole("button", {
      name: /show password/i,
    });
    await userEvent.click(firstToggle);

    expect(newPassword).toHaveAttribute("type", "text");
    expect(screen.getByLabelText(/confirm new password/i)).toHaveAttribute(
      "type",
      "password",
    );
  });
});
