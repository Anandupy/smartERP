import { apiConfig } from "@/config";
import { api, isApiError } from "@/core/api";

import type { ProbeOutcome } from "../mappers/health.mapper";
import type { HealthCheckResultDto, LivenessDto } from "../types/health.dto";

/** One probe attempt, including what the frontend itself observed. */
export interface ProbeResult<T> {
  outcome: ProbeOutcome & { data?: T };
  /** Frontend-measured round-trip time — "response time," not backend execution time. */
  latencyMs: number;
  checkedAt: string;
  error?: {
    message: string;
    kind: string;
    code?: string;
    requestId?: string;
    timestamp?: string;
  };
}

/**
 * Runs one probe and never throws.
 *
 * `/live`, `/ready` and `/health` are called independently (never
 * `Promise.all`) so one failing probe can never prevent the others from
 * resolving — the reason this returns a result object instead of rejecting.
 * `httpStatus: null` on failure means the request never reached the server at
 * all (network error, timeout, cancellation); a real non-2xx response is
 * distinguished from that.
 */
async function probe<T>(fn: () => Promise<T>): Promise<ProbeResult<T>> {
  const start =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const data = await fn();
    return {
      outcome: { httpOk: true, httpStatus: 200, data },
      latencyMs:
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        start,
      checkedAt,
    };
  } catch (error) {
    const latencyMs =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      start;

    if (isApiError(error)) {
      return {
        outcome: { httpOk: false, httpStatus: error.status },
        latencyMs,
        checkedAt,
        error: {
          message: error.message,
          kind: error.kind,
          code: error.code,
          requestId: error.requestId,
          timestamp: error.timestamp,
        },
      };
    }

    return {
      outcome: { httpOk: false, httpStatus: null },
      latencyMs,
      checkedAt,
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
        kind: "unknown",
      },
    };
  }
}

/**
 * The three probes. All are `@Public()`, `@SkipThrottle()` and
 * **version-neutral** on the backend (`health.controller.ts`) — called against
 * `apiConfig.root` rather than the normal `/v1`-relative base, and with no
 * Authorization header required.
 */
export const healthService = {
  getLive: () =>
    probe(() =>
      api.get<LivenessDto>("/live", { baseURL: apiConfig.root }),
    ),
  /** Checks only `database`. 503 while the database is unreachable. */
  getReady: () =>
    probe(() =>
      api.get<HealthCheckResultDto>("/ready", { baseURL: apiConfig.root }),
    ),
  /** Checks `database` and `memoryHeap`. 503 while any indicator fails. */
  getFull: () =>
    probe(() =>
      api.get<HealthCheckResultDto>("/health", { baseURL: apiConfig.root }),
    ),
} as const;
