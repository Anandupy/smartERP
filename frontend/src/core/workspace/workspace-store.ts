import { create } from "zustand";

import type {
  WorkspaceAvailability,
  WorkspaceSelection,
  WorkspaceSetupStatus,
  WorkspaceStatus,
  WorkspaceUnavailableReason,
} from "./types";
import {
  EMPTY_SELECTION,
  isSelectionComplete,
  narrowSelection,
  resolveWorkspaceAccess,
  roleRequiresSelection,
} from "./workspace-policy";
import { getWorkspaceSelectionPolicy } from "./workspace-settings";
import { getWorkspaceStorage } from "./workspace-storage";

/**
 * The active workspace scope.
 *
 * Deliberately a module-level store rather than React state, because two very
 * different consumers need the same value: components (through `useWorkspace`)
 * and the API layer's header providers, which are plain functions evaluated
 * per request with no component context. One store means those cannot disagree
 * about which branch a request belongs to.
 *
 * It holds **normalized entities and three ids** — never the `/auth/me`
 * envelope. Server state stays in TanStack Query; this is the decision made
 * about it.
 */
interface WorkspaceState {
  /** What the backend offers. `null` until identity has loaded. */
  availability: WorkspaceAvailability | null;
  selection: WorkspaceSelection;
  status: WorkspaceStatus;
  reason: WorkspaceUnavailableReason | null;
  /** The bootstrap state last published alongside availability. */
  setupStatus: WorkspaceSetupStatus | null;

  /**
   * Publish what the user may choose from, and run the resolution policy over
   * it. Seeded with the persisted selection, so a returning user lands back in
   * the workspace they left — provided it is still on offer.
   *
   * `setupStatus` is `/auth/me`'s bootstrap block, published alongside
   * availability by the same call so the two can never disagree. When setup is
   * still required for a role entitled to run it, that short-circuits ordinary
   * resolution entirely — see `docs/workspace-setup-module.md`.
   */
  setAvailability: (
    availability: WorkspaceAvailability,
    setupStatus?: WorkspaceSetupStatus | null,
  ) => void;
  /** Apply a partial change; downstream levels cascade. */
  select: (next: Partial<WorkspaceSelection>) => void;
  /** Accept the current selection: persist it and mark the scope ready. */
  confirm: () => void;
  /** Drop the scope and forget it (sign-out, switch user). */
  clear: () => void;
}

const INITIAL = {
  availability: null,
  selection: EMPTY_SELECTION,
  status: "idle" as WorkspaceStatus,
  reason: null,
  setupStatus: null as WorkspaceSetupStatus | null,
};

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  ...INITIAL,

  setAvailability: (availability, setupStatus = null) => {
    // Setup is checked first and, when it applies, decides the status on its
    // own — `resolveWorkspaceAccess` never learns setup exists. A fresh
    // install has no organizations, which the resolver would otherwise read
    // as "unavailable"; that reading is only correct once bootstrap is done.
    //
    // Roles outside `ROLES_REQUIRING_SELECTION` have no setup authority
    // (`docs/workspace-setup-module.md`), so they fall through to ordinary
    // resolution even while setup is required, and see the existing
    // "unavailable" outcome — unchanged from before this status existed.
    if (setupStatus?.setupRequired && roleRequiresSelection(availability.role)) {
      // Seeded from whatever is already selected (not reset to empty) so a
      // resource created earlier in the wizard — the only organization, the
      // only branch — stays resolved as the next one is created, without
      // marking the scope `ready` or persisting it or sending scope headers
      // (both of those still require `confirm()`, which setup never calls).
      const selection = narrowSelection(availability, get().selection);
      set({
        availability,
        selection,
        status: "setup-required",
        reason: null,
        setupStatus,
      });
      return;
    }

    // Both seams are read here rather than inside the resolver, which stays a
    // pure function of its arguments: the store is the impure edge.
    const resolution = resolveWorkspaceAccess(
      availability,
      getWorkspaceStorage().read(),
      getWorkspaceSelectionPolicy(),
    );

    // Only a resolved scope is worth remembering. Persisting a half-made
    // selection would reopen the screen on the level the user never reached.
    // Under the shipped policy that is `confirm()`'s job in every case, since
    // publishing availability no longer resolves anything on its own.
    if (resolution.status === "ready") {
      getWorkspaceStorage().write(resolution.selection);
    }

    set({
      availability,
      selection: resolution.selection,
      status: resolution.status,
      reason: resolution.reason,
      setupStatus,
    });
  },

  select: (next) => {
    const { availability, selection } = get();
    if (!availability) return;
    set({ selection: narrowSelection(availability, selection, next) });
  },

  confirm: () => {
    const { selection } = get();
    if (!isSelectionComplete(selection)) return;
    getWorkspaceStorage().write(selection);
    set({ status: "ready", reason: null });
  },

  clear: () => {
    getWorkspaceStorage().clear();
    set({ ...INITIAL });
  },
}));

/**
 * Read the scope outside React — used by the API layer's header providers.
 * Components use `useWorkspace()` instead, so they re-render on change.
 */
export function getWorkspaceState(): WorkspaceState {
  return useWorkspaceStore.getState();
}
