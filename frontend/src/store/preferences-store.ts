import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { STORAGE_KEYS } from "@/constants";

export type UiDensity = "comfortable" | "compact";

/**
 * Durable, cross-session user UI preferences. Persisted to Web Storage under a
 * namespaced key. Kept free of business data — those are server-owned.
 */
interface PreferencesState {
  density: UiDensity;
  sidebarCollapsed: boolean;
  setDensity: (density: UiDensity) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      density: "comfortable",
      sidebarCollapsed: false,
      setDensity: (density) => set({ density }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    {
      name: STORAGE_KEYS.preferences,
      storage: createJSONStorage(() => localStorage),
      // Persist preferences only; never persist derived/transient values.
      partialize: (state) => ({
        density: state.density,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
