"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ROUTES } from "@/constants";

import { useAuth } from "../auth-context";
import { usePermissions } from "../permission-context";

export interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Optional permission gate; user must satisfy all listed permissions. */
  requiredPermissions?: string[];
  /** Where to send unauthenticated users. */
  redirectTo?: string;
  /** Rendered while the redirect is in flight. */
  fallback?: React.ReactNode;
}

/**
 * Client-side guard for authenticated areas. Redirects unauthenticated users to
 * the login route and, optionally, enforces permission requirements. Real apps
 * pair this with server-side checks; this is the client convenience layer.
 */
export function ProtectedRoute({
  children,
  requiredPermissions,
  redirectTo = ROUTES.auth.login,
  fallback = null,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, status } = useAuth();
  const { canAll } = usePermissions();

  const permitted =
    !requiredPermissions || requiredPermissions.length === 0
      ? true
      : canAll(requiredPermissions);

  useEffect(() => {
    if (status === "authenticating") return;
    if (!isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, status, redirectTo, router]);

  if (!isAuthenticated || !permitted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
