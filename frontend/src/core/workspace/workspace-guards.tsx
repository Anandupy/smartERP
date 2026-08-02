"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ROUTES } from "@/constants";

import { useWorkspaceStore } from "./workspace-store";

export interface RequireWorkspaceProps {
  children: React.ReactNode;
  /** Where to send users whose scope is not resolved yet. */
  redirectTo?: string;
  /** Rendered while the redirect is in flight. */
  fallback?: React.ReactNode;
}

/**
 * Gate for scoped areas of the app: renders its children only once a workspace
 * is active.
 *
 * Anything else — `idle` on a cold load, `selecting`, `unavailable` — is sent
 * to the workspace route, which owns resolution and either forwards straight
 * back (nothing to choose) or explains why it cannot.
 *
 * Pairs with `ProtectedRoute`, which answers "is this user signed in?"; this
 * answers "signed in *where*?". Both are client conveniences — the backend
 * enforces scope on every request via the headers this scope populates.
 */
export function RequireWorkspace({
  children,
  redirectTo = ROUTES.workspace.root,
  fallback = null,
}: RequireWorkspaceProps) {
  const router = useRouter();
  const status = useWorkspaceStore((state) => state.status);

  useEffect(() => {
    if (status !== "ready") router.replace(redirectTo);
  }, [status, redirectTo, router]);

  if (status !== "ready") return <>{fallback}</>;

  return <>{children}</>;
}
