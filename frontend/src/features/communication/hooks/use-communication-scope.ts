"use client";

import { useMemo } from "react";

import { useWorkspace } from "@/core/workspace";

/** The organization and branch every scoped Communication request needs. */
export interface CommunicationScope {
  organizationId: string;
  branchId: string;
}

/**
 * The active organization and branch, in the shape the Communication API's
 * `organizationId`/`branchId` query parameters (settings, analytics,
 * delivery logs) and request-body fields (templates, notifications) need.
 *
 * Returns `null` until the workspace scope is `ready` — an honest gate, not a
 * loading flicker: every scoped Communication screen renders its own
 * "no active branch" state rather than firing a request with half a scope.
 */
export function useCommunicationScope(): CommunicationScope | null {
  const { organization, branch, isReady } = useWorkspace();

  return useMemo(() => {
    if (!isReady || !organization || !branch) return null;
    return { organizationId: organization.id, branchId: branch.id };
  }, [isReady, organization, branch]);
}
