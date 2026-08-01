"use client";

import { useSyncExternalStore } from "react";

import { getOnboardingStorage } from "./onboarding-storage";
import { resolveStartupRoute } from "./startup-route";

/** The flag cannot change while the app is mounted, so there is nothing to emit. */
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): boolean {
  return getOnboardingStorage().isCompleted();
}

/** The server cannot read Web Storage, so it has no answer to give. */
function getServerSnapshot(): null {
  return null;
}

/**
 * Resolve where the splash screen should hand off.
 *
 * The flag lives in Web Storage, which the server cannot read, so this returns
 * `null` until the client snapshot is available — callers must tolerate that.
 * Reading it through `useSyncExternalStore` (rather than an effect that sets
 * state) is what keeps the server and hydrating client renders identical.
 *
 * When backend session validation lands, this hook awaits it and passes the
 * result to `resolveStartupRoute`; nothing that consumes the hook changes.
 */
export function useStartupRoute(): string | null {
  const hasCompletedOnboarding = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (hasCompletedOnboarding === null) return null;

  return resolveStartupRoute({ hasCompletedOnboarding, session: null });
}
