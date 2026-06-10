'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useThemeStore } from '@/stores/theme.store';
import type { ThemeConfig } from '@/stores/theme.store';
import type { DataDensity } from '@/types/ui.types';

// ── Helpers ───────────────────────────────────────────────────

/** Convert hex color (#RRGGBB) to "R G B" space-separated string for CSS vars */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '10 10 10';
  return [
    parseInt(result[1] ?? '0', 16),
    parseInt(result[2] ?? '0', 16),
    parseInt(result[3] ?? '0', 16),
  ].join(' ');
}

// ── Theme Application ─────────────────────────────────────────

/**
 * Applies a ThemeConfig to the EduOS CSS design tokens.
 *
 * Sets --eduos-* variables (RGB triples) which flow through the
 * shadcn bridge and Tailwind @theme inline into all utilities.
 *
 * Theme Studio → --eduos-* → --primary/--background/... → bg-primary/text-foreground/...
 */
export function applyTheme(theme: Partial<ThemeConfig>): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const set = (variable: string, value: string) =>
    root.style.setProperty(variable, value);

  if (theme.primaryColor)     set('--eduos-primary',     hexToRgb(theme.primaryColor));
  if (theme.primaryForeground) set('--eduos-primary-fg', hexToRgb(theme.primaryForeground));
  if (theme.secondaryColor)   set('--eduos-secondary',   hexToRgb(theme.secondaryColor));
  if (theme.secondaryForeground) set('--eduos-secondary-fg', hexToRgb(theme.secondaryForeground));
  if (theme.accentColor) {
    set('--eduos-accent',     hexToRgb(theme.accentColor));
    set('--eduos-secondary',  hexToRgb(theme.accentColor)); // secondary = accent in default theme
  }
  if (theme.accentForeground) set('--eduos-accent-fg', hexToRgb(theme.accentForeground));

  if (theme.fontFamily) {
    set('--font-body',           `'${theme.fontFamily}'`);
    set('--font-display-family', `'${theme.fontFamily}'`);
  }
}

/** Apply data density via data attribute on <html> */
export function applyDensity(density: DataDensity): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-density', density);
}

// ── Provider ──────────────────────────────────────────────────

/**
 * ThemeStudioProvider — bridges ThemeStore → CSS variables.
 *
 * On mount and on theme changes, applies the effective theme
 * (draft merged over published) to the EduOS CSS tokens.
 * All Tailwind utilities and shadcn components update automatically
 * because they reference those tokens through the @theme inline bridge.
 */
export function ThemeStudioProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const draft = useThemeStore((s) => s.draft);
  const hasApplied = useRef(false);

  useLayoutEffect(() => {
    const effective = draft ? { ...theme, ...draft } : theme;
    applyTheme(effective);
    applyDensity(effective.density);
    hasApplied.current = true;
  }, [theme, draft]);

  useEffect(() => {
    if (!hasApplied.current) {
      const effective = draft ? { ...theme, ...draft } : theme;
      applyTheme(effective);
      applyDensity(effective.density);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
