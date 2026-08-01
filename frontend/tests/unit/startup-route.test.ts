import { afterEach, describe, expect, it } from "vitest";

import { ROUTES } from "@/constants";
import {
  completeOnboarding,
  createMemoryOnboardingStorage,
  createWebOnboardingStorage,
  getOnboardingStorage,
  resetOnboarding,
  resolveStartupRoute,
  setOnboardingStorage,
} from "@/core/startup";

describe("resolveStartupRoute", () => {
  it("sends a first-time visitor to welcome", () => {
    expect(resolveStartupRoute({ hasCompletedOnboarding: false })).toBe(
      ROUTES.auth.welcome,
    );
  });

  it("sends a returning visitor straight to login", () => {
    expect(resolveStartupRoute({ hasCompletedOnboarding: true })).toBe(
      ROUTES.auth.login,
    );
  });

  it("keeps skipping welcome when a returning visitor's session is invalid", () => {
    // The onboarding flag is independent of authentication: an expired session
    // must not resurrect the first-run experience.
    expect(
      resolveStartupRoute({
        hasCompletedOnboarding: true,
        session: { isValid: false },
      }),
    ).toBe(ROUTES.auth.login);
  });

  it("short-circuits to the workspace once a session is valid", () => {
    expect(
      resolveStartupRoute({
        hasCompletedOnboarding: true,
        session: { isValid: true },
      }),
    ).toBe(ROUTES.app.root);
  });

  it("prefers a valid session over pending onboarding", () => {
    expect(
      resolveStartupRoute({
        hasCompletedOnboarding: false,
        session: { isValid: true },
      }),
    ).toBe(ROUTES.app.root);
  });
});

describe("onboarding storage", () => {
  const original = getOnboardingStorage();

  afterEach(() => {
    setOnboardingStorage(original);
  });

  it("starts incomplete and records completion", () => {
    setOnboardingStorage(createMemoryOnboardingStorage());
    expect(getOnboardingStorage().isCompleted()).toBe(false);

    completeOnboarding();
    expect(getOnboardingStorage().isCompleted()).toBe(true);
  });

  it("can be intentionally reset to replay first run", () => {
    setOnboardingStorage(createMemoryOnboardingStorage(true));
    resetOnboarding();
    expect(getOnboardingStorage().isCompleted()).toBe(false);
  });

  it("persists through the exact contract key", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    } as unknown as Storage;

    const onboarding = createWebOnboardingStorage(storage);
    onboarding.setCompleted(true);

    expect(store.get("campusflow.onboarding.completed")).toBe("true");
    expect(onboarding.isCompleted()).toBe(true);
  });

  it("degrades to 'not completed' when storage throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked by policy");
      },
      setItem: () => {
        throw new Error("blocked by policy");
      },
      removeItem: () => {
        throw new Error("blocked by policy");
      },
    } as unknown as Storage;

    const onboarding = createWebOnboardingStorage(storage);
    expect(() => onboarding.setCompleted(true)).not.toThrow();
    expect(onboarding.isCompleted()).toBe(false);
  });

  it("is a no-op without a backing store (SSR)", () => {
    const onboarding = createWebOnboardingStorage(undefined);
    expect(onboarding.isCompleted()).toBe(false);
    expect(() => onboarding.setCompleted(true)).not.toThrow();
  });
});
