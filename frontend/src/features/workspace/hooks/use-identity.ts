"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/core/auth";

import { CURRENT_IDENTITY, identityKeys } from "../api/identity.keys";
import { identityService } from "../api/identity.service";

/**
 * The signed-in user's identity, permissions and available scopes.
 *
 * Server state, so it lives in the query cache and nowhere else — the workspace
 * store holds the *decision* made about it, never a second copy of it. That is
 * what lets every module call `useWorkspace()` without re-fetching.
 *
 * Gated on authentication: firing before a token exists would only produce a
 * 401 and a pointless refresh attempt. The error is rendered inline by the
 * screen, so the global toast is suppressed.
 */
export function useIdentity() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: identityKeys.detail(CURRENT_IDENTITY),
    queryFn: identityService.me,
    enabled: isAuthenticated,
    meta: { skipErrorToast: true },
  });
}
