"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ROUTES } from "@/constants";

import { resolvePostAuthRoute } from "./workspace-route";
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
 * Anything else is sent onward: to the setup wizard while bootstrap is still
 * required, otherwise to the workspace route, which owns resolution and either
 * forwards straight back (nothing to choose) or explains why it cannot. An
 * explicit `redirectTo` always wins — it is an intentional override, not the
 * default two-way split.
 *
 * Pairs with `ProtectedRoute`, which answers "is this user signed in?"; this
 * answers "signed in *where*?". Both are client conveniences — the backend
 * enforces scope on every request via the headers this scope populates.
 */
export function RequireWorkspace({
  children,
  redirectTo,
  fallback = null,
}: RequireWorkspaceProps) {
  const router = useRouter();
  const status = useWorkspaceStore((state) => state.status);
  const target =
    redirectTo ??
    (status === "setup-required" ? ROUTES.setup.root : ROUTES.workspace.root);

  useEffect(() => {
    if (status !== "ready") router.replace(target);
  }, [status, target, router]);

  if (status !== "ready") return <>{fallback}</>;

  return <>{children}</>;
}

export interface RequireSetupIncompleteProps {
  children: React.ReactNode;
  /** Rendered while the redirect is in flight, or while status is `idle`. */
  fallback?: React.ReactNode;
}

/**
 * Gate for the setup wizard itself: renders its children only while bootstrap
 * is genuinely in progress for a role entitled to run it.
 *
 * `idle` also renders `fallback` rather than redirecting — identity has not
 * loaded yet, so redirecting now would be a guess. Once it loads, `status`
 * settles to `setup-required` (stay) or something else (leave), via the same
 * `resolvePostAuthRoute` every other post-auth redirect uses, so a completed
 * install sends a stale `/setup` bookmark to the right place rather than
 * looping the wizard.
 */
export function RequireSetupIncomplete({
  children,
  fallback = null,
}: RequireSetupIncompleteProps) {
  const router = useRouter();
  const status = useWorkspaceStore((state) => state.status);

  useEffect(() => {
    if (status === "idle" || status === "setup-required") return;
    router.replace(resolvePostAuthRoute(status));
  }, [status, router]);

  if (status !== "setup-required") return <>{fallback}</>;

  return <>{children}</>;
}
