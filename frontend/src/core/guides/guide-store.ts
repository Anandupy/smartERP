import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { STORAGE_KEYS } from "@/constants";

import type { GuideCompletionRecord, GuideRunStatus } from "./types";

/**
 * Runtime + persisted state for the guide platform.
 *
 * Mirrors `src/store/preferences-store.ts`: only `completed` survives a
 * reload (via `partialize`) — which guide is running, at which step, and for
 * which record (`entityId`) is transient, exactly like a Joyride tour itself
 * never resumes across a hard refresh.
 *
 * This store knows nothing about `GuideDefinition`s (step counts, versions to
 * mark complete) — that logic lives in `useGuide` and `GuideProvider`, the
 * only things that read the registry. Keeping the store itself
 * definition-agnostic is what lets them share one source of truth without
 * either owning guide content.
 */
interface GuideStoreState {
  activeGuideId: string | null;
  /** Logical index into the active guide's `steps` array. Monotonic: it only
   * ever moves forward, via `setStep`. */
  stepIndex: number;
  /**
   * The record (e.g. an academic year id) a cross-route guide is tracking,
   * once its "action" step reveals it. Steps whose route carries a dynamic
   * segment only match against *this* id — see `guide-provider.tsx` — so
   * navigating to an unrelated record's page can never make the guide jump
   * ahead onto it.
   */
  entityId: string | null;
  status: GuideRunStatus;
  completed: Record<string, GuideCompletionRecord>;
  start: (guideId: string) => void;
  /** Moves the floor to `index` (never backward — callers only ever move it
   * forward) and optionally records the entity the guide is now scoped to. */
  setStep: (index: number, entityId?: string) => void;
  stop: (status: "completed" | "skipped") => void;
  markCompleted: (guideId: string, version: number) => void;
}

export const useGuideStore = create<GuideStoreState>()(
  persist(
    (set) => ({
      activeGuideId: null,
      stepIndex: 0,
      entityId: null,
      status: "idle",
      completed: {},
      start: (guideId) =>
        set({
          activeGuideId: guideId,
          stepIndex: 0,
          entityId: null,
          status: "running",
        }),
      setStep: (index, entityId) =>
        set((state) => ({
          stepIndex: index,
          entityId: entityId ?? state.entityId,
        })),
      stop: (status) =>
        set({ activeGuideId: null, stepIndex: 0, entityId: null, status }),
      markCompleted: (guideId, version) =>
        set((state) => ({
          completed: {
            ...state.completed,
            [guideId]: { version, completedAt: new Date().toISOString() },
          },
        })),
    }),
    {
      name: STORAGE_KEYS.guideProgress,
      storage: createJSONStorage(() => localStorage),
      // Persist completion records only; a run in progress does not survive
      // a reload, and re-persisting it would replay a guide mid-step on a
      // page whose target — or whose record — may not even be the one still
      // in view.
      partialize: (state) => ({ completed: state.completed }),
    },
  ),
);
