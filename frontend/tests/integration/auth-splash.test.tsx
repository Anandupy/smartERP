import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/constants";
import {
  SPLASH_BOOT_STEPS,
  SPLASH_STEP_DURATION_MS,
  SplashScreen,
} from "@/features/auth";
import { render, screen } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { routerMock, resetRouterMock } =
  await import("@tests/mocks/next-navigation");

/**
 * Advance whole boot steps one at a time — each tick must settle in its own
 * `act` so the effect can schedule the next timer.
 */
function advanceSteps(count: number) {
  for (let index = 0; index < count; index += 1) {
    act(() => void vi.advanceTimersByTime(SPLASH_STEP_DURATION_MS));
  }
}

describe("<SplashScreen />", () => {
  beforeEach(() => {
    resetRouterMock();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the brand lockup, edition and release", () => {
    render(<SplashScreen />);

    expect(screen.getByText("CampusFlow")).toBeInTheDocument();
    expect(screen.getByText("Enterprise Edition")).toBeInTheDocument();
    expect(screen.getByText(/^Version /)).toBeInTheDocument();
  });

  it("exposes determinate startup progress to assistive tech", () => {
    render(<SplashScreen />);

    const progress = screen.getByRole("progressbar", {
      name: /startup progress/i,
    });
    expect(progress).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText(SPLASH_BOOT_STEPS[0])).toBeInTheDocument();
  });

  it("announces each boot step in a live region", () => {
    render(<SplashScreen />);

    const status = screen.getByText(SPLASH_BOOT_STEPS[0]);
    expect(status).toHaveAttribute("aria-live", "polite");

    advanceSteps(1);
    expect(screen.getByText(SPLASH_BOOT_STEPS[1])).toBeInTheDocument();
  });

  it("walks every boot step, then hands off to the welcome screen", () => {
    render(<SplashScreen />);

    advanceSteps(SPLASH_BOOT_STEPS.length - 1);
    expect(
      screen.getByText(SPLASH_BOOT_STEPS[SPLASH_BOOT_STEPS.length - 1]),
    ).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();

    advanceSteps(1);
    expect(routerMock.replace).toHaveBeenCalledExactlyOnceWith(
      ROUTES.auth.welcome,
    );
  });

  it("honors an explicit hand-off target", () => {
    render(<SplashScreen redirectTo={ROUTES.auth.login} />);

    advanceSteps(SPLASH_BOOT_STEPS.length);
    expect(routerMock.replace).toHaveBeenCalledExactlyOnceWith(
      ROUTES.auth.login,
    );
  });
});
