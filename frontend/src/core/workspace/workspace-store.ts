import { create } from "zustand";

import type {
  WorkspaceAvailability,
  WorkspaceSelection,
  WorkspaceStatus,
  WorkspaceUnavailableReason,
} from "./types";
import {
  EMPTY_SELECTION,
  isSelectionComplete,
  narrowSelection,
  resolveWorkspaceAccess,
} from "./workspace-policy";
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

  /**
   * Publish what the user may choose from, and run the resolution policy over
   * it. Seeded with the persisted selection, so a returning user lands back in
   * the workspace they left — provided it is still on offer.
   */
  setAvailability: (availability: WorkspaceAvailability) => void;
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
};

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  ...INITIAL,

  setAvailability: (availability) => {
    const resolution = resolveWorkspaceAccess(
      availability,
      getWorkspaceStorage().read(),
    );

    // Only a resolved scope is worth remembering. Persisting a half-made
    // selection would reopen the screen on the level the user never reached.
    if (resolution.status === "ready") {
      getWorkspaceStorage().write(resolution.selection);
    }

    set({
      availability,
      selection: resolution.selection,
      status: resolution.status,
      reason: resolution.reason,
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
