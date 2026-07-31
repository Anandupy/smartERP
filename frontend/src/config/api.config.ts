import { env } from "./env";

/**
 * Transport-level API configuration consumed by the core API client.
 * Kept free of business logic so every module shares one source of truth.
 */
export const apiConfig = Object.freeze({
  baseURL: env.NEXT_PUBLIC_API_URL,
  timeout: env.NEXT_PUBLIC_API_TIMEOUT,
  /**
   * Retry strategy placeholder. The core client reads these values; the actual
   * retry transport is intentionally deferred until the backend contract for
   * idempotency and rate limiting is finalized.
   */
  retry: {
    enabled: false,
    maxRetries: 2,
    /** Base delay in ms; real backoff transport is added later. */
    baseDelayMs: 300,
    /** Only these methods are ever eligible for automatic retries. */
    retriableMethods: ["get", "head", "options"] as const,
  },
  withCredentials: false,
});

export type ApiConfig = typeof apiConfig;
