"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ROUTES } from "@/constants";

import { useAuth } from "../auth-context";

export interface GuestRouteProps {
  children: React.ReactNode;
  /** Where to send already-authenticated users (e.g. away from /login). */
  redirectTo?: string;
  fallback?: React.ReactNode;
}

/**
 * Guard for guest-only routes such as login or forgot-password. Authenticated
 * users are bounced to the application root.
 */
export function GuestRoute({
  children,
  redirectTo = ROUTES.app.root,
  fallback = null,
}: GuestRouteProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, redirectTo, router]);

  if (isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
