'use client';

// ============================================================
// Theme Store — Theme Engine State
// Persisted in localStorage.
// Applied to CSS variables by ThemeStudioProvider.
// Draft state enables live preview without committing.
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DataDensity, SidebarLayout, HeaderLayout, ContentLayout } from '@/types/ui.types';

export interface ThemeConfig {
  // Colors
  primaryColor: string;
  primaryForeground: string;
  secondaryColor: string;
  secondaryForeground: string;
  accentColor: string;
  accentForeground: string;

  // Typography
  fontFamily: string;

  // Layout
  sidebarLayout: SidebarLayout;
  headerLayout: HeaderLayout;
  contentLayout: ContentLayout;

  // Data Density
  density: DataDensity;

  // Branding
  logoUrl: string | null;
  faviconUrl: string | null;
}

/**
 * System defaults — used when no org theme is loaded.
 */
export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#0A0A0A',
  primaryForeground: '#FFFFFF',
  secondaryColor: '#4B41E1',
  secondaryForeground: '#FFFFFF',
  accentColor: '#4B41E1',
  accentForeground: '#FFFFFF',
  fontFamily: 'Inter',
  sidebarLayout: 'fixed',
  headerLayout: 'fixed',
  contentLayout: 'fluid',
  density: 'erp-dense',
  logoUrl: null,
  faviconUrl: null,
};

interface ThemeState {
  // Active theme (applied to CSS vars)
  theme: ThemeConfig;

  /**
   * Draft theme — used for live preview in Theme Studio.
   * null = no active draft (using published theme).
   */
  draft: Partial<ThemeConfig> | null;

  /**
   * Source of current theme:
   * - 'default'  → system defaults
   * - 'org'      → loaded from organization
   * - 'branch'   → loaded from branch (overrides org)
   */
  source: 'default' | 'org' | 'branch';

  // Actions
  setTheme: (theme: Partial<ThemeConfig>, source?: ThemeState['source']) => void;
  setDraft: (draft: Partial<ThemeConfig> | null) => void;
  applyDraft: () => void;
  discardDraft: () => void;
  updateDensity: (density: DataDensity) => void;
  resetToDefault: () => void;

  /** Returns the effective theme (draft merged over active). */
  getEffectiveTheme: () => ThemeConfig;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: DEFAULT_THEME,
      draft: null,
      source: 'default',

      setTheme: (partial, source = 'org') =>
        set((state) => ({
          theme: { ...state.theme, ...partial },
          source,
          draft: null, // Clear draft when a new theme is set
        })),

      setDraft: (draft) => set({ draft }),

      applyDraft: () =>
        set((state) => {
          if (!state.draft) return state;
          return {
            theme: { ...state.theme, ...state.draft },
            draft: null,
          };
        }),

      discardDraft: () => set({ draft: null }),

      updateDensity: (density) =>
        set((state) => ({
          theme: { ...state.theme, density },
        })),

      resetToDefault: () =>
        set({ theme: DEFAULT_THEME, draft: null, source: 'default' }),

      getEffectiveTheme: () => {
        const { theme, draft } = get();
        if (!draft) return theme;
        return { ...theme, ...draft };
      },
    }),
    {
      name: 'eduos-theme',
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
      // Persist theme but not draft (draft is session-only)
      partialize: (state) => ({
        theme: state.theme,
        source: state.source,
      }),
    },
  ),
);

// ── Selectors ─────────────────────────────────────────────────

export const selectTheme = (s: ThemeState) => s.theme;
export const selectDraft = (s: ThemeState) => s.draft;
export const selectDensity = (s: ThemeState) => s.theme.density;
