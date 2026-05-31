import { apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { AuthTokens, Session } from '@/types/domain.types';

// ── Auth API Functions ────────────────────────────────────────

export interface LoginInput {
  identifier: string;
  password: string;
}

/**
 * Login with email, username, or phone + password.
 * Returns access token and refresh token.
 */
export async function loginApi(data: LoginInput): Promise<AuthTokens> {
  return apiPost<AuthTokens>(ENDPOINTS.auth.login, data);
}

/**
 * Refresh access token using a valid refresh token.
 */
export async function refreshTokenApi(refreshToken: string): Promise<AuthTokens> {
  return apiPost<AuthTokens>(ENDPOINTS.auth.refresh, { refreshToken });
}

export interface LogoutInput {
  refreshToken: string;
  allDevices?: boolean;
}

/**
 * Logout and revoke the current session.
 * Pass allDevices: true to revoke all sessions.
 */
export async function logoutApi(data: LogoutInput): Promise<void> {
  const url = data.allDevices
    ? `${ENDPOINTS.auth.logout}?allDevices=true`
    : ENDPOINTS.auth.logout;
  await apiPost<void>(url, { refreshToken: data.refreshToken });
}

/**
 * Get all active sessions for the current user.
 */
export async function getSessionsApi(): Promise<Session[]> {
  return apiPost<Session[]>(ENDPOINTS.auth.sessions);
}
