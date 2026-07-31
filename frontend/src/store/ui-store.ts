import { create } from "zustand";

/**
 * Ephemeral, app-wide UI state. Platform-only: navigation chrome and global
 * overlays. Feature-specific state belongs to the feature's own store.
 */
interface UiState {
  isSidebarOpen: boolean;
  isCommandMenuOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setCommandMenuOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: true,
  isCommandMenuOpen: false,
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setCommandMenuOpen: (open) => set({ isCommandMenuOpen: open }),
}));
