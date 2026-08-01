"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, PermissionProvider, SessionProvider } from "@/core/auth";
import { ThemeProvider } from "@/core/theme";

import { QueryProvider } from "./query-provider";
import { Toaster } from "./toaster";

/**
 * Single composition root for all client-side providers. Order matters:
 *
 *   ThemeProvider          → color mode available to everything (incl. toasts)
 *     QueryProvider        → server-state cache + devtools
 *       SessionProvider    → active tenant/branch/workspace scope
 *         AuthProvider     → authentication state
 *           PermissionProvider → derived permission checks (depends on auth)
 *             TooltipProvider  → shared Radix tooltip delay/lifecycle context
 *
 * Mounting everything here keeps `app/layout.tsx` a thin server component.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <SessionProvider>
          <AuthProvider>
            <PermissionProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </PermissionProvider>
          </AuthProvider>
        </SessionProvider>
      </QueryProvider>
      <Toaster />
    </ThemeProvider>
  );
}
