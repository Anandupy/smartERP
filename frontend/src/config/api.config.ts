import { env } from "./env";

/** The API root with any trailing slash removed, e.g. `https://host/api`. */
const apiRoot = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");

/**
 * Transport-level API configuration consumed by the core API client.
 * Kept free of business logic so every module shares one source of truth.
 */
export const apiConfig = Object.freeze({
  /** Unversioned API root — only needed to build version-agnostic URLs. */
  root: apiRoot,
  /**
   * The backend version segment this build talks to. Services never spell the
   * version into their paths; they call `/students` and the client resolves
   * `<root>/<version>/students`. Bumping to `v2` is an env change.
   */
  version: env.NEXT_PUBLIC_API_VERSION,
  /** Versioned base URL every request is relative to, e.g. `.../api/v1`. */
  baseURL: `${apiRoot}/${env.NEXT_PUBLIC_API_VERSION}`,
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
