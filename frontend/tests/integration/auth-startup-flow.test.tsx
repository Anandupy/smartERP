import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/constants";
import {
  createMemoryOnboardingStorage,
  getOnboardingStorage,
  setOnboardingStorage,
  type OnboardingStorage,
} from "@/core/startup";
import {
  SPLASH_BOOT_STEPS,
  SPLASH_STEP_DURATION_MS,
  SplashScreen,
  WelcomeCta,
} from "@/features/auth";
import { render, screen } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { routerMock, resetRouterMock } =
  await import("@tests/mocks/next-navigation");

const originalStorage = getOnboardingStorage();

/** Advance the whole boot sequence, one step per `act`. */
function runBootSequence() {
  for (let index = 0; index < SPLASH_BOOT_STEPS.length; index += 1) {
    act(() => void vi.advanceTimersByTime(SPLASH_STEP_DURATION_MS));
  }
}

describe("application startup flow", () => {
  let storage: OnboardingStorage;

  beforeEach(() => {
    resetRouterMock();
    storage = createMemoryOnboardingStorage();
    setOnboardingStorage(storage);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    setOnboardingStorage(originalStorage);
  });

  it("sends a first-time visitor from splash to welcome", () => {
    render(<SplashScreen />);
    runBootSequence();

    expect(routerMock.replace).toHaveBeenCalledExactlyOnceWith(
      ROUTES.auth.welcome,
    );
  });

  it("sends a returning visitor from splash straight to login", () => {
    storage.setCompleted(true);

    render(<SplashScreen />);
    runBootSequence();

    expect(routerMock.replace).toHaveBeenCalledExactlyOnceWith(
      ROUTES.auth.login,
    );
  });

  it("still honors an explicit destination over the startup policy", () => {
    render(<SplashScreen redirectTo={ROUTES.auth.sessionExpired} />);
    runBootSequence();

    expect(routerMock.replace).toHaveBeenCalledExactlyOnceWith(
      ROUTES.auth.sessionExpired,
    );
  });

  it("does not show welcome again once onboarding is complete", () => {
    // Simulates the second launch after the CTA above was followed.
    storage.setCompleted(true);

    render(<SplashScreen />);
    runBootSequence();

    expect(routerMock.replace).not.toHaveBeenCalledWith(ROUTES.auth.welcome);
  });
});

// Real timers: this exercises a user click, and `userEvent` drives its own
// internal delays that fake timers would starve.
describe("welcome hand-off", () => {
  let storage: OnboardingStorage;

  beforeEach(() => {
    storage = createMemoryOnboardingStorage();
    setOnboardingStorage(storage);
  });

  afterEach(() => {
    setOnboardingStorage(originalStorage);
  });

  it("marks onboarding complete when welcome hands off to login", async () => {
    render(<WelcomeCta />);
    expect(storage.isCompleted()).toBe(false);

    const cta = screen.getByRole("link", { name: /continue to login/i });
    expect(cta).toHaveAttribute("href", ROUTES.auth.login);

    await userEvent.click(cta);
    expect(storage.isCompleted()).toBe(true);
  });
});
