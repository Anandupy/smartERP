"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, PermissionProvider, SessionProvider } from "@/core/auth";
import { ThemeProvider } from "@/core/theme";
import { WorkspaceProvider } from "@/core/workspace";

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
 *             WorkspaceProvider  → scope headers + session scope mirroring
 *               TooltipProvider  → shared Radix tooltip delay/lifecycle context
 *
 * `WorkspaceProvider` sits inside `SessionProvider` because it writes the
 * active scope into it, and after `AuthProvider` because a scope only means
 * something once there is a user to scope.
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
              <WorkspaceProvider>
                <TooltipProvider>{children}</TooltipProvider>
              </WorkspaceProvider>
            </PermissionProvider>
          </AuthProvider>
        </SessionProvider>
      </QueryProvider>
      <Toaster />
    </ThemeProvider>
  );
}
