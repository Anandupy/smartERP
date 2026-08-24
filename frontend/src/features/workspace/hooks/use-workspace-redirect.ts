"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { resolvePostAuthRoute, type WorkspaceStatus } from "@/core/workspace";

/**
 * Leave the selection screen once it has somewhere else to send the user.
 *
 * Two statuses trigger it: `ready` — because the user pressed Continue, or
 * because the resolver settled it outright for a backend-scoped role — and
 * `setup-required`, which this screen cannot resolve at all (setup is not a
 * workspace choice) and must hand off immediately. The destination comes from
 * `resolvePostAuthRoute`, so this hook decides *when* to navigate and never
 * *where* — that stays the platform's single decision.
 *
 * Note what it deliberately does not do: react to a *resolvable* scope. Whether
 * a resolvable scope is also a resolved one is the policy's call, so making the
 * screen auto-forward would be a second, competing decision.
 *
 * `replace` rather than `push`: neither destination is a step worth going back
 * to, and leaving one in history would bounce the user straight forward again
 * on the next Back press.
 */
export function useWorkspaceRedirect(status: WorkspaceStatus): void {
  const router = useRouter();

  useEffect(() => {
    if (status !== "ready" && status !== "setup-required") return;
    router.replace(resolvePostAuthRoute(status));
  }, [status, router]);
}
