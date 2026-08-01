"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { useAuth } from "@/core/auth";
import { invalidateKeys } from "@/core/query";

import { authKeys } from "../api/auth.keys";
import { authService } from "../api/auth.service";
import { clearTokens } from "../utils/session-manager";
import { getTokenStorage } from "@/core/auth";

/**
 * Session management: list the devices a user is signed in on, revoke them, and
 * sign out.
 *
 * `GET /auth/sessions` returns `{ id, device, ipAddress, userAgent, createdAt }`
 * — the backend exposes no "current session" marker, so the UI cannot highlight
 * which row is this browser.
 */

/** Active sessions for the signed-in user. */
export function useSessions(enabled = true) {
  return useQuery({
    queryKey: authKeys.sessions(),
    queryFn: () => authService.getSessions(),
    enabled,
  });
}

/** Revoke one session by id, then refresh the list. */
export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => authService.revokeSession(id),
    onSuccess: () => invalidateKeys(queryClient, [authKeys.sessions()]),
  });
}

/** Revoke every session, including this one. */
export function useRevokeAllSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.revokeAllSessions(),
    onSuccess: () => invalidateKeys(queryClient, [authKeys.sessions()]),
  });
}

/**
 * Sign out.
 *
 * The backend needs the refresh token in the body *and* a valid access token,
 * so the call is made before local state is cleared. Local credentials are
 * dropped either way: a failed logout must never strand the user in a
 * half-signed-in state, and the refresh token is revoked server-side on the
 * next rotation regardless.
 */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clearSession } = useAuth();

  return useMutation({
    mutationFn: async (allDevices?: boolean) => {
      const refreshToken = getTokenStorage().getRefreshToken();
      if (!refreshToken) return null;
      return authService.logout({ refreshToken }, allDevices ?? false);
    },
    onSettled: () => {
      clearTokens();
      clearSession();
      queryClient.clear();
      router.replace(ROUTES.auth.login);
    },
  });
}
