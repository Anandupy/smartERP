import { describe, expect, it } from "vitest";

import {
  ChangePasswordScreen,
  LoginHistoryScreen,
  SecurityAuditScreen,
  SecurityPreferencesScreen,
  TrustedDevicesScreen,
  TwoFactorScreen,
} from "@/features/security";

import { render, screen } from "@tests/setup/render";

/**
 * These six screens have no backend behind them at all. Rendering them must
 * never fire a network request — MSW's repo-wide `onUnhandledRequest: "error"`
 * would fail the test if one did — and every write control must render
 * disabled with a `Backend Pending` explanation rather than a fake success
 * path.
 */
describe("Backend-pending security screens", () => {
  it("Login History ships the full filter UI, all of it inert", () => {
    render(<LoginHistoryScreen />);

    expect(screen.getByText("Login History")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by IP or device/)).toBeDisabled();
    expect(screen.getAllByText("Backend Pending").length).toBeGreaterThan(0);
  });

  it("Change Password ships the full form, submit disabled", () => {
    render(<ChangePasswordScreen />);

    expect(screen.getByLabelText("Current password")).toBeDisabled();
    expect(screen.getByLabelText("New password")).toBeDisabled();
    expect(screen.getByLabelText("Confirm new password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("Two-Factor Authentication never claims a status it cannot verify", () => {
    render(<TwoFactorScreen />);

    expect(screen.getByText("Status unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/2FA is (enabled|disabled)/i)).toBeNull();
    expect(
      screen.getByLabelText("Enable two-factor authentication"),
    ).toBeDisabled();
  });

  it("Security Preferences ships every toggle, all disabled", () => {
    render(<SecurityPreferencesScreen />);

    expect(screen.getByLabelText("New sign-in notifications")).toBeDisabled();
    expect(screen.getByLabelText("Suspicious sign-in alerts")).toBeDisabled();
    expect(screen.getByLabelText("Security email alerts")).toBeDisabled();
  });

  it("Security Activity Audit does not repurpose the generic audit log", () => {
    render(<SecurityAuditScreen />);

    expect(screen.getByText("Security Activity Audit")).toBeInTheDocument();
    expect(screen.getByText(/no events to the generic audit-log/)).toBeInTheDocument();
  });

  it("Trusted Devices does not treat a session as a trusted device", () => {
    render(<TrustedDevicesScreen />);

    expect(screen.getByText("Trusted Devices")).toBeInTheDocument();
    expect(
      screen.getByText(/no trusted-device model or endpoints/),
    ).toBeInTheDocument();
  });
});
