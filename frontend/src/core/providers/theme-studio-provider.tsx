'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useThemeStore } from '@/stores/theme.store';
import type { ThemeConfig } from '@/stores/theme.store';
import type { DataDensity } from '@/types/ui.types';

// ── CSS Variable Application ──────────────────────────────────

/**
 * Convert a hex color to RGB space-separated values for CSS vars.
 * @example hexToRgb('#4B41E1') → '75 65 225'
 */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0 0';
  return `${parseInt(result[1] ?? '0', 16)} ${parseInt(result[2] ?? '0', 16)} ${parseInt(result[3] ?? '0', 16)}`;
}

/**
 * Apply a ThemeConfig to CSS custom properties on the document root.
 * This is the core of the Theme Engine.
 */
export function applyTheme(theme: Partial<ThemeConfig>): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (theme.primaryColor) {
    root.style.setProperty('--color-primary', hexToRgb(theme.primaryColor));
  }
  if (theme.primaryForeground) {
    root.style.setProperty(
      '--color-primary-foreground',
      hexToRgb(theme.primaryForeground),
    );
  }
  if (theme.secondaryColor) {
    root.style.setProperty(
      '--color-secondary',
      hexToRgb(theme.secondaryColor),
    );
  }
  if (theme.secondaryForeground) {
    root.style.setProperty(
      '--color-secondary-foreground',
      hexToRgb(theme.secondaryForeground),
    );
  }
  if (theme.accentColor) {
    root.style.setProperty('--color-accent', hexToRgb(theme.accentColor));
  }
  if (theme.fontFamily) {
    root.style.setProperty(
      '--font-display',
      `'${theme.fontFamily}', system-ui, sans-serif`,
    );
    root.style.setProperty(
      '--font-body',
      `'${theme.fontFamily}', system-ui, sans-serif`,
    );
  }
}

/**
 * Apply data density to the <html> element via data attribute.
 * CSS rules in globals.css respond to [data-density="..."].
 */
export function applyDensity(density: DataDensity): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-density', density);
}

// ── Provider ──────────────────────────────────────────────────

interface ThemeStudioProviderProps {
  children: React.ReactNode;
}

/**
 * ThemeStudioProvider — applies the active theme to CSS variables.
 *
 * Responsibilities:
 * 1. Apply stored theme on mount (after hydration, using useLayoutEffect)
 * 2. Watch for theme store changes and re-apply
 * 3. Apply draft theme for live preview in Theme Studio
 * 4. Apply data density
 *
 * SSR Safety: useLayoutEffect is skipped on server.
 * The `typeof window` check ensures no SSR execution.
 */
export function ThemeStudioProvider({ children }: ThemeStudioProviderProps) {
  const theme = useThemeStore((s) => s.theme);
  const draft = useThemeStore((s) => s.draft);

  // Track if we've applied the initial theme
  const hasAppliedInitial = useRef(false);

  // useLayoutEffect runs synchronously after DOM mutations but before paint
  // This prevents a flash of unstyled content
  // Note: useLayoutEffect is a no-op on the server (safe)
  useLayoutEffect(() => {
    const effectiveTheme = draft ? { ...theme, ...draft } : theme;
    applyTheme(effectiveTheme);
    applyDensity(effectiveTheme.density);
    hasAppliedInitial.current = true;
  }, [theme, draft]);

  // Also apply on client mount if layout effect hasn't run
  useEffect(() => {
    if (!hasAppliedInitial.current) {
      const effectiveTheme = draft ? { ...theme, ...draft } : theme;
      applyTheme(effectiveTheme);
      applyDensity(effectiveTheme.density);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
