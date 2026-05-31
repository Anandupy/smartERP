'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

/**
 * Thin wrapper over next-themes ThemeProvider.
 * Manages light/dark/system color mode.
 *
 * The `attribute="class"` strategy adds/removes the `dark` class on <html>,
 * which activates our `.dark` CSS variable overrides in globals.css.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
