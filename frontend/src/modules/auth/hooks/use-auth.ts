'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { useContextStore } from '@/stores/context.store';
import { tokenService } from '@/lib/api/token-service';
import { getDefaultRedirect } from '@/lib/utils/permissions';
import { loginApi, logoutApi, type LoginInput } from '../api/auth.api';
import type { ApiClientError } from '@/types/api.types';
import type { JwtPayload, User } from '@/types/domain.types';

/**
 * Decode a JWT payload (without verification — server validates).
 */
function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const decoded = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Set a lightweight auth indicator cookie for the middleware.
 * The cookie has no sensitive data — it just signals that the user
 * has authenticated recently. Actual validation is done by the API.
 */
function setAuthIndicatorCookie() {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setDate(expires.getDate() + 7); // Match refresh token TTL
  document.cookie = `eduos-auth-indicator=1; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function clearAuthIndicatorCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'eduos-auth-indicator=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

// ── useLogin ──────────────────────────────────────────────────

/**
 * Login mutation hook.
 * Handles token storage, auth store updates, and role-based redirect.
 */
export function useLogin() {
  const router = useRouter();
  const { setUser, clearAuth } = useAuthStore();

  return useMutation<void, ApiClientError, LoginInput>({
    mutationFn: async (data) => {
      const tokens = await loginApi(data);

      // Store tokens
      tokenService.setAccessToken(tokens.accessToken);
      tokenService.setRefreshToken(tokens.refreshToken);

      // Decode JWT to get user data
      const payload = decodeJwtPayload(tokens.accessToken);
      if (!payload) {
        throw new Error('Invalid access token received');
      }

      // Build a minimal User object from JWT payload
      // Full user data fetched lazily when needed
      const user: User = {
        id: payload.sub,
        fullName: '',
        username: '',
        email: payload.email,
        phone: '',
        role: payload.role,
        organizationId: payload.organizationId,
        branchId: payload.branchId,
        status: 'ACTIVE',
        isTwoFactorEnabled: false,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setUser(user);
      setAuthIndicatorCookie();

      // Role-based redirect
      const redirectTo = getDefaultRedirect(payload.role);
      router.push(redirectTo);
    },
    onError: (error) => {
      toast.error(error.message ?? 'Login failed. Please check your credentials.');
    },
  });
}

// ── useLogout ─────────────────────────────────────────────────

/**
 * Logout mutation hook.
 * Clears all tokens and auth state, redirects to login.
 */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clearAuth } = useAuthStore();
  const { resetAll } = useContextStore();

  return useMutation<void, ApiClientError, { allDevices?: boolean }>({
    mutationFn: async ({ allDevices = false }) => {
      const refreshToken = tokenService.getRefreshToken();
      if (refreshToken) {
        // Best-effort logout — don't block on API failure
        try {
          await logoutApi({ refreshToken, allDevices });
        } catch {
          // Ignore API errors during logout
        }
      }

      // Always clear local state
      tokenService.clearAll();
      clearAuth();
      resetAll();
      clearAuthIndicatorCookie();
      queryClient.clear();

      router.push('/login');
    },
  });
}
