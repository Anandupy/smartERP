"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps as NextThemesProviderProps } from "next-themes";

/**
 * Platform theme provider. Wraps `next-themes` so light/dark mode works today,
 * while presenting a stable API the app depends on. When dynamic (workspace or
 * backend-driven) theming lands, the registry + adapter plug in here without
 * changing any consumer.
 */
export type ThemeProviderProps = NextThemesProviderProps;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
