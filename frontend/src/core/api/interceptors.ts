import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

import { headerRegistry } from "./headers";
import { ApiError, normalizeError } from "./errors";

/**
 * Optional hook invoked when a request fails with 401. This is the seam for the
 * refresh-token flow: an auth module registers a handler that attempts a silent
 * refresh, or triggers logout. Until one is registered, 401s simply propagate
 * as a normalized `ApiError`.
 *
 * Resolving `true` means "recovered — replay the original request once". Any
 * other result (or a throw) lets the original `ApiError` propagate.
 */
export type UnauthorizedHandler = (
  error: ApiError,
  config: InternalAxiosRequestConfig,
) => boolean | void | Promise<boolean | void>;

/** Marks a config that has already been replayed, so a retry can never loop. */
const RETRIED = Symbol("api.retried");

type RetriableConfig = InternalAxiosRequestConfig & { [RETRIED]?: boolean };

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

/**
 * Normalize every rejected response into a typed `ApiError`, giving the
 * unauthorized handler a chance to recover first.
 */
function createResponseErrorHandler(instance: AxiosInstance) {
  return async function onResponseError(
    error: AxiosError,
  ): Promise<AxiosResponse> {
    const normalized = normalizeError(error);
    const apiError = new ApiError(normalized);
    const config = error.config as RetriableConfig | undefined;

    // Only the first 401 for a given request may trigger recovery: the replay
    // is marked, so a refresh that itself 401s can never recurse.
    if (
      apiError.kind === "unauthorized" &&
      unauthorizedHandler &&
      config &&
      !config[RETRIED]
    ) {
      config[RETRIED] = true;
      const recovered = await unauthorizedHandler(apiError, config);
      if (recovered === true) {
        // Fresh credentials are attached by the request interceptor on replay.
        return instance.request(config);
      }
    }

    return Promise.reject(apiError);
  };
}

export function attachInterceptors(instance: AxiosInstance): void {
  instance.interceptors.request.use(onRequest);
  instance.interceptors.response.use(
    (response) => response,
    createResponseErrorHandler(instance),
  );
}
