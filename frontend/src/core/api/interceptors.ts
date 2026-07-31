import type {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";

import { headerRegistry } from "./headers";
import { ApiError, normalizeError } from "./errors";

/**
 * Optional hook invoked when a request fails with 401. This is the seam for the
 * future refresh-token flow: an auth module registers a handler that attempts a
 * silent refresh (and retries) or triggers logout. Until then it is unset and
 * 401s simply propagate as a normalized `ApiError`.
 */
export type UnauthorizedHandler = (
  error: ApiError,
  config: InternalAxiosRequestConfig,
) => void | Promise<void>;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(
  handler: UnauthorizedHandler | null,
): void {
  unauthorizedHandler = handler;
}

/** Attach dynamic, configurable headers to every outgoing request. */
function onRequest(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  const dynamicHeaders = headerRegistry.resolve();
  for (const [name, value] of Object.entries(dynamicHeaders)) {
    config.headers.set(name, value);
  }
  return config;
}

/** Normalize every rejected response into a typed `ApiError`. */
async function onResponseError(error: AxiosError): Promise<never> {
  const normalized = normalizeError(error);
  const apiError = new ApiError(normalized);

  if (apiError.kind === "unauthorized" && unauthorizedHandler && error.config) {
    // Placeholder for refresh-token / logout orchestration.
    await unauthorizedHandler(apiError, error.config);
  }

  return Promise.reject(apiError);
}

export function attachInterceptors(instance: AxiosInstance): void {
  instance.interceptors.request.use(onRequest);
  instance.interceptors.response.use((response) => response, onResponseError);
}
