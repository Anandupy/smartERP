'use client';

// ============================================================
// Auth Store — Authentication state
// Access token is in-memory only (never persisted).
// User metadata is non-sensitive and can be persisted.
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, UserRole } from '@/types/domain.types';

interface AuthState {
  // State
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  /**
   * true after the initial auth check completes (on boot).
   * Components should show a loading state until this is true.
   */
  isInitialized: boolean;

  // Actions
  setUser: (user: User) => void;
  setRole: (role: UserRole) => void;
  setAuthenticated: (value: boolean) => void;
  setInitialized: () => void;
  clearAuth: () => void;
}

/**
 * Auth store — persists non-sensitive user metadata.
 * The access token is NOT stored here. See TokenService.
 * The refresh token lives in localStorage via TokenService.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      isAuthenticated: false,
      isInitialized: false,

      setUser: (user) =>
        set({ user, role: user.role, isAuthenticated: true }),

      setRole: (role) => set({ role }),

      setAuthenticated: (value) => set({ isAuthenticated: value }),

      setInitialized: () => set({ isInitialized: true }),

      clearAuth: () =>
        set({
          user: null,
          role: null,
          isAuthenticated: false,
          // Keep isInitialized true — we've confirmed unauthenticated state
          isInitialized: true,
        }),
    }),
    {
      name: 'eduos-auth',
      storage: createJSONStorage(() => {
        // SSR-safe storage access
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return localStorage;
      }),
      // Only persist non-sensitive user metadata, NOT auth tokens
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
        // isInitialized is NOT persisted — always re-checked on boot
      }),
      // After rehydration, mark as initialized if we have persisted data
      onRehydrateStorage: () => (state) => {
        if (state) {
          // If we have persisted auth state, mark as initialized
          // The actual token validity is checked by the boot sequence
          state.setInitialized();
        }
      },
    },
  ),
);

// ── Selectors (for performance — avoid re-renders) ──────────

export const selectUser = (s: AuthState) => s.user;
export const selectRole = (s: AuthState) => s.role;
export const selectIsAuthenticated = (s: AuthState) => s.isAuthenticated;
export const selectIsInitialized = (s: AuthState) => s.isInitialized;
