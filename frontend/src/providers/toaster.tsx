"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster } from "sonner";

/**
 * Global toast portal (Sonner), theme-aware via next-themes. Mounted once at
 * the app root by `AppProviders`.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      theme={(resolvedTheme as "light" | "dark" | undefined) ?? "system"}
      position="top-right"
      richColors
      closeButton
    />
  );
}
