'use client';

// ============================================================
// UI Store — Application UI State
// Sidebar, drawers, command menu, tours, notification panel.
// sidebarCollapsed persists in localStorage.
// Everything else is in-memory only.
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;

  // Detail Drawer
  activeDrawerId: string | null;
  drawerMode: 'view' | 'edit' | 'create';

  // Command Menu (CMD+K)
  commandMenuOpen: boolean;

  // Notification Panel
  notificationPanelOpen: boolean;

  // Tour
  activeTourId: string | null;
  completedTourIds: string[];

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
  openDrawer: (id: string, mode?: 'view' | 'edit' | 'create') => void;
  closeDrawer: () => void;
  toggleCommandMenu: () => void;
  setCommandMenuOpen: (value: boolean) => void;
  toggleNotificationPanel: () => void;
  setActiveTour: (tourId: string | null) => void;
  markTourCompleted: (tourId: string) => void;
  isTourCompleted: (tourId: string) => boolean;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarCollapsed: false,
      activeDrawerId: null,
      drawerMode: 'view',
      commandMenuOpen: false,
      notificationPanelOpen: false,
      activeTourId: null,
      completedTourIds: [],

      // Sidebar
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),

      // Drawer
      openDrawer: (id, mode = 'view') =>
        set({ activeDrawerId: id, drawerMode: mode }),

      closeDrawer: () =>
        set({ activeDrawerId: null, drawerMode: 'view' }),

      // Command Menu
      toggleCommandMenu: () =>
        set((state) => ({ commandMenuOpen: !state.commandMenuOpen })),

      setCommandMenuOpen: (value) => set({ commandMenuOpen: value }),

      // Notifications
      toggleNotificationPanel: () =>
        set((state) => ({
          notificationPanelOpen: !state.notificationPanelOpen,
        })),

      // Tours
      setActiveTour: (tourId) => set({ activeTourId: tourId }),

      markTourCompleted: (tourId) =>
        set((state) => ({
          completedTourIds: state.completedTourIds.includes(tourId)
            ? state.completedTourIds
            : [...state.completedTourIds, tourId],
          activeTourId: state.activeTourId === tourId ? null : state.activeTourId,
        })),

      isTourCompleted: (tourId) => get().completedTourIds.includes(tourId),
    }),
    {
      name: 'eduos-ui',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return localStorage;
      }),
      // Only persist sidebar state and completed tours
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        completedTourIds: state.completedTourIds,
      }),
    },
  ),
);

// ── Selectors ─────────────────────────────────────────────────

export const selectSidebarCollapsed = (s: UIState) => s.sidebarCollapsed;
export const selectActiveDrawerId = (s: UIState) => s.activeDrawerId;
export const selectCommandMenuOpen = (s: UIState) => s.commandMenuOpen;
