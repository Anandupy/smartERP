import { STORAGE_KEYS } from "@/constants";

/**
 * Storage abstraction for the first-run onboarding flag, mirroring the
 * token-storage seam in `core/auth`: the contract is fixed, the backing store
 * is swappable (Web Storage by default, in-memory for tests).
 *
 * The flag is deliberately independent of authentication. A returning visitor
 * whose session has expired has still completed onboarding, so it must not be
 * cleared when a session is.
 */
export interface OnboardingStorage {
  isCompleted(): boolean;
  setCompleted(completed: boolean): void;
  clear(): void;
}

const hasWindow = typeof window !== "undefined";

/** Web Storage backed implementation, guarded for SSR and private-mode throws. */
export function createWebOnboardingStorage(
  storage: Storage | undefined = hasWindow ? window.localStorage : undefined,
): OnboardingStorage {
  return {
    isCompleted: () => {
      try {
        return storage?.getItem(STORAGE_KEYS.onboardingCompleted) === "true";
      } catch {
        // Storage can throw in private mode or when blocked by policy; treating
        // it as "not completed" degrades to showing welcome, never to a crash.
        return false;
      }
    },
    setCompleted: (completed) => {
      try {
        storage?.setItem(
          STORAGE_KEYS.onboardingCompleted,
          completed ? "true" : "false",
        );
      } catch {
        // Non-fatal: onboarding simply shows again next launch.
      }
    },
    clear: () => {
      try {
        storage?.removeItem(STORAGE_KEYS.onboardingCompleted);
      } catch {
        // Non-fatal.
      }
    },
  };
}

/** In-memory implementation for tests and non-browser environments. */
export function createMemoryOnboardingStorage(
  initial = false,
): OnboardingStorage {
  let completed = initial;
  return {
    isCompleted: () => completed,
    setCompleted: (next) => {
      completed = next;
    },
    clear: () => {
      completed = false;
    },
  };
}

let activeStorage: OnboardingStorage = createWebOnboardingStorage();

export function getOnboardingStorage(): OnboardingStorage {
  return activeStorage;
}

export function setOnboardingStorage(storage: OnboardingStorage): void {
  activeStorage = storage;
}

/**
 * Record that onboarding is done. Called when the visitor moves from welcome
 * into login for the first time; the welcome screen is not shown again unless
 * the flag is intentionally reset.
 */
export function completeOnboarding(): void {
  activeStorage.setCompleted(true);
}

/** Intentional reset — exposed so QA and future settings UI can replay first run. */
export function resetOnboarding(): void {
  activeStorage.clear();
}
