import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/constants";
import {
  AccountLockedScreen,
  PasswordSuccessScreen,
  SessionExpiredScreen,
} from "@/features/auth";
import { render, screen } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { routerMock, resetRouterMock } =
  await import("@tests/mocks/next-navigation");

/** One tick per `act`, so each state update commits before the next fires. */
function tick(seconds: number) {
  for (let index = 0; index < seconds; index += 1) {
    act(() => void vi.advanceTimersByTime(1_000));
  }
}

beforeEach(() => {
  resetRouterMock();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<PasswordSuccessScreen />", () => {
  it("confirms the outcome and offers the way forward", () => {
    render(<PasswordSuccessScreen redirectAfterSeconds={0} />);

    expect(
      screen.getByRole("heading", { level: 1, name: /password updated/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /return to login/i }),
    ).toHaveAttribute("href", ROUTES.auth.login);
  });

  it("counts down and redirects to login on its own", () => {
    render(<PasswordSuccessScreen redirectAfterSeconds={3} />);

    expect(
      screen.getByText(/returning to login in 00:03/i),
    ).toBeInTheDocument();

    tick(3);
    expect(routerMock.push).toHaveBeenCalledExactlyOnceWith(ROUTES.auth.login);
  });

  it("leaves the visitor in control when the redirect is disabled", () => {
    render(<PasswordSuccessScreen redirectAfterSeconds={0} />);

    expect(screen.queryByText(/returning to login/i)).not.toBeInTheDocument();
    tick(30);
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});

describe("<AccountLockedScreen />", () => {
  it("explains the lock and shows the remaining time", () => {
    render(<AccountLockedScreen lockoutSeconds={120} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /account temporarily locked/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("02:00")).toBeInTheDocument();
    expect(screen.getByText(/unlocks in/i)).toBeInTheDocument();
  });

  it("offers help and password reset while locked", () => {
    render(<AccountLockedScreen lockoutSeconds={120} />);

    expect(
      screen.getByRole("link", { name: /contact administrator/i }),
    ).toHaveAttribute("href", expect.stringContaining("mailto:"));
    expect(
      screen.getByRole("link", { name: /reset your password/i }),
    ).toHaveAttribute("href", ROUTES.auth.forgotPassword);
  });

  it("keeps retry disabled until the lock clears, then enables it", () => {
    render(<AccountLockedScreen lockoutSeconds={2} />);

    expect(
      screen.getByRole("button", { name: /return to login/i }),
    ).toBeDisabled();

    tick(2);

    expect(screen.getByText(/lock released/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /return to login/i }),
    ).toHaveAttribute("href", ROUTES.auth.login);
  });

  it("gives concrete guidance for the next attempt", () => {
    render(<AccountLockedScreen lockoutSeconds={60} />);

    expect(screen.getByText(/caps lock is off/i)).toBeInTheDocument();
    expect(screen.getByText(/institutional credentials/i)).toBeInTheDocument();
  });
});

describe("<SessionExpiredScreen />", () => {
  it("explains why the session ended and how to resume", () => {
    render(<SessionExpiredScreen redirectAfterSeconds={0} />);

    expect(
      screen.getByRole("heading", { level: 1, name: /session expired/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /login again/i })).toHaveAttribute(
      "href",
      ROUTES.auth.login,
    );
    expect(screen.getByRole("link", { name: /return home/i })).toHaveAttribute(
      "href",
      ROUTES.root,
    );
  });

  it("redirects to login once the countdown elapses", () => {
    render(<SessionExpiredScreen redirectAfterSeconds={2} />);

    expect(
      screen.getByText(/redirecting to login in 00:02/i),
    ).toBeInTheDocument();

    tick(2);
    expect(routerMock.push).toHaveBeenCalledExactlyOnceWith(ROUTES.auth.login);
  });

  it("shows last-activity detail only when the platform knows it", () => {
    const { unmount } = render(
      <SessionExpiredScreen redirectAfterSeconds={0} />,
    );
    expect(screen.queryByText(/last active/i)).not.toBeInTheDocument();
    unmount();

    render(
      <SessionExpiredScreen
        redirectAfterSeconds={0}
        lastActiveLabel="14 minutes ago"
      />,
    );
    expect(screen.getByText(/last active/i)).toBeInTheDocument();
    expect(screen.getByText("14 minutes ago")).toBeInTheDocument();
  });
});
