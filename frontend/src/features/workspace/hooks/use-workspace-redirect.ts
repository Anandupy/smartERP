"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { resolvePostAuthRoute, type WorkspaceStatus } from "@/core/workspace";

/**
 * Leave the selection screen once a workspace is active.
 *
 * Covers both ways that happens, with one rule: the user confirmed a choice, or
 * there was never a choice to make and the resolver settled it outright. The
 * destination comes from `resolvePostAuthRoute`, so this hook decides *when* to
 * navigate and never *where* — that stays the platform's single decision.
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
