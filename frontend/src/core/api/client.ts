import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

import { apiConfig } from "@/config";
import type { ApiResponse } from "@/types/api";

import { attachInterceptors } from "./interceptors";
import { registerDefaultHeaderProviders } from "./headers";

/**
 * Create a configured Axios instance. Exposed for tests, which need isolated
 * clients; application code should import the shared `apiClient` singleton.
 */
export function createApiClient(
  config: AxiosRequestConfig = {},
): AxiosInstance {
  const instance = axios.create({
    baseURL: apiConfig.baseURL,
    timeout: apiConfig.timeout,
    withCredentials: apiConfig.withCredentials,
    headers: { "Content-Type": "application/json" },
    ...config,
  });

  attachInterceptors(instance);
  return instance;
}

// Register platform header providers once, at module load.
registerDefaultHeaderProviders();

/** The shared, application-wide API client singleton. */
export const apiClient = createApiClient();

/**
 * Thin typed helpers over the shared client.
 *
 * `get`/`post`/… unwrap the backend success envelope and return the `data`
 * payload directly — the 90% case. When callers also need `meta` (e.g. list
 * pagination), the `*Envelope` variants return the full {@link ApiResponse}.
 * The response interceptor guarantees a rejected promise becomes an `ApiError`,
 * so these only ever resolve on success.
 */
export const api = {
  get: async <TData>(url: string, config?: AxiosRequestConfig) =>
    (await apiClient.get<ApiResponse<TData>>(url, config)).data.data,
  post: async <TData, TBody = unknown>(
    url: string,
    body?: TBody,
    config?: AxiosRequestConfig,
  ) => (await apiClient.post<ApiResponse<TData>>(url, body, config)).data.data,
  put: async <TData, TBody = unknown>(
    url: string,
    body?: TBody,
    config?: AxiosRequestConfig,
  ) => (await apiClient.put<ApiResponse<TData>>(url, body, config)).data.data,
  patch: async <TData, TBody = unknown>(
    url: string,
    body?: TBody,
    config?: AxiosRequestConfig,
  ) => (await apiClient.patch<ApiResponse<TData>>(url, body, config)).data.data,
  delete: async <TData>(url: string, config?: AxiosRequestConfig) =>
    (await apiClient.delete<ApiResponse<TData>>(url, config)).data.data,

  /** Like `get`, but returns the full success envelope (`data` + `meta`). */
  getEnvelope: async <TData>(url: string, config?: AxiosRequestConfig) =>
    (await apiClient.get<ApiResponse<TData>>(url, config)).data,
} as const;
