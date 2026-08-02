"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { resolvePostAuthRoute, type WorkspaceStatus } from "@/core/workspace";

/**
 * Leave the selection screen once a workspace is active.
 *
 * Covers both ways that happens, with one rule — the scope became `ready`:
 * because the user pressed Continue, or because the resolver settled it outright
 * for a backend-scoped role. The destination comes from `resolvePostAuthRoute`,
 * so this hook decides *when* to navigate and never *where* — that stays the
 * platform's single decision.
 *
 * Note what it deliberately does not do: react to a *resolvable* scope. Whether
 * a resolvable scope is also a resolved one is the policy's call, so making the
 * screen auto-forward would be a second, competing decision.
 *
 * `replace` rather than `push`: a resolved workspace is not a step worth going
 * back to, and leaving it in history would bounce the user straight forward
 * again on the next Back press.
 */
export function useWorkspaceRedirect(status: WorkspaceStatus): void {
  const router = useRouter();

  useEffect(() => {
    if (status !== "ready") return;
    router.replace(resolvePostAuthRoute(status));
  }, [status, router]);
}
