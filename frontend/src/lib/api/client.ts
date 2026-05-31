// ============================================================
// Axios API Client — Central HTTP client for EduOS
//
// Responsibilities:
//   1. Inject Authorization header (access token)
//   2. Inject x-organization-id and x-branch-id context headers
//   3. Unwrap the API response envelope (data.data)
//   4. Handle 401 with silent token refresh
//   5. Normalize errors into ApiClientError
//   6. Redirect to /login on auth failure
// ============================================================

import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { tokenService } from './token-service';
import { ApiClientError, type ApiResponse } from '@/types/api.types';
import { useContextStore } from '@/stores/context.store';
import { useAuthStore } from '@/stores/auth.store';

// Track whether a token refresh is in progress
// to avoid multiple simultaneous refresh calls
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processRefreshQueue(token: string | null, error: unknown = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else if (token) resolve(token);
  });
  refreshQueue = [];
}

/**
 * Create the main Axios instance.
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: env.apiUrl,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30_000,
  });

  // ── Request Interceptor ──────────────────────────────────
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Inject access token
      const token = tokenService.getAccessToken();
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }

      // Inject ERP context headers (for future backend multi-tenant support)
      // Context store is accessed directly (not via hook) because this runs outside React
      const contextState = useContextStore.getState();
      if (contextState.organizationId) {
        config.headers['x-organization-id'] = contextState.organizationId;
      }
      if (contextState.branchId) {
        config.headers['x-branch-id'] = contextState.branchId;
      }

      return config;
    },
    (error: unknown) => Promise.reject(error),
  );

  // ── Response Interceptor ─────────────────────────────────
  client.interceptors.response.use(
    (response) => {
      // Unwrap the API response envelope
      // Backend always returns { success, message, data, meta, error }
      const apiResponse = response.data as ApiResponse;

      if (!apiResponse.success) {
        throw new ApiClientError(
          apiResponse.message ?? 'Request failed',
          response.status,
          apiResponse.error?.code ?? 'UNKNOWN',
          apiResponse.meta?.requestId as string | undefined,
          apiResponse.error?.details,
        );
      }

      // Return the unwrapped data
      return { ...response, data: apiResponse.data };
    },

    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // ── Handle 401 Unauthorized ───────────────────────────
      if (error.response?.status === 401 && !originalRequest._retry) {
        // Check if we have a refresh token to attempt silent refresh
        if (!tokenService.hasRefreshToken()) {
          handleAuthFailure();
          return Promise.reject(normalizeError(error));
        }

        if (isRefreshing) {
          // Queue this request until the refresh completes
          return new Promise((resolve, reject) => {
            refreshQueue.push({
              resolve: (token) => {
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
                resolve(client(originalRequest));
              },
              reject,
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = tokenService.getRefreshToken();
          const response = await client.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
            '/auth/refresh',
            { refreshToken },
          );

          const newTokens = response.data as unknown as {
            accessToken: string;
            refreshToken: string;
          };

          tokenService.setAccessToken(newTokens.accessToken);
          tokenService.setRefreshToken(newTokens.refreshToken);

          processRefreshQueue(newTokens.accessToken);
          originalRequest.headers['Authorization'] = `Bearer ${newTokens.accessToken}`;

          return client(originalRequest);
        } catch (refreshError) {
          processRefreshQueue(null, refreshError);
          handleAuthFailure();
          return Promise.reject(normalizeError(error));
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(normalizeError(error));
    },
  );

  return client;
}

/**
 * Clear auth state and redirect to login.
 * Called when tokens are invalid and refresh fails.
 */
function handleAuthFailure() {
  tokenService.clearAll();
  useAuthStore.getState().clearAuth();
  useContextStore.getState().resetAll();

  // Client-side redirect
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

/**
 * Normalize any Axios error into an ApiClientError.
 */
function normalizeError(error: AxiosError): ApiClientError {
  const response = error.response;
  const apiData = response?.data as ApiResponse | undefined;

  const message =
    apiData?.message ??
    error.message ??
    'An unexpected error occurred';

  const status = response?.status ?? 0;
  const code = apiData?.error?.code ?? error.code ?? 'NETWORK_ERROR';
  const requestId = apiData?.meta?.requestId as string | undefined;
  const details = apiData?.error?.details;

  return new ApiClientError(message, status, code, requestId, details);
}

/**
 * Singleton API client instance.
 * Import this in all API functions.
 */
export const apiClient: AxiosInstance = createApiClient();

/**
 * Convenience typed GET wrapper.
 */
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await apiClient.get<T>(url, { params });
  return response.data;
}

/**
 * Convenience typed POST wrapper.
 */
export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.post<T>(url, data);
  return response.data;
}

/**
 * Convenience typed PATCH wrapper.
 */
export async function apiPatch<T>(url: string, data?: unknown): Promise<T> {
  const response = await apiClient.patch<T>(url, data);
  return response.data;
}

/**
 * Convenience typed DELETE wrapper.
 */
export async function apiDelete<T>(url: string): Promise<T> {
  const response = await apiClient.delete<T>(url);
  return response.data;
}
