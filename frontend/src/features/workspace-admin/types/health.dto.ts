/**
 * Wire shapes for `/live`, `/ready` and `/health`.
 *
 * Transcribed from `health-response.dto.ts` and `health.controller.ts` on the
 * backend. These three routes are `@Public()`, `@SkipThrottle()` and
 * **version-neutral** — they live at `<root>/live` etc, not `<root>/v1/live` —
 * so the service layer calls them with an explicit `baseURL` override rather
 * than through the normal `/v1`-relative path every other service uses.
 *
 * `/live` checks nothing but the process itself. `/ready` and `/health` both
 * return the identical Terminus `HealthCheckResultDto` shape but check
 * different indicators: `/ready` checks only `database`; `/health` checks
 * `database` and `memoryHeap`. Indicator names are therefore not fixed — the
 * dependency table in this module renders whatever keys `details` actually
 * contains, tolerant of a future indicator being added on the backend.
 */

/** `GET /live` success body. */
export interface LivenessDto {
  status: string;
  uptimeSeconds: number;
}

/** One dependency/resource indicator entry, e.g. `{ status: "up" }`. */
export interface HealthIndicatorEntry {
  status?: string;
  [key: string]: unknown;
}

/** `GET /ready` and `GET /health` success body — a Terminus health report. */
export interface HealthCheckResultDto {
  status: string;
  /** Indicators that passed, keyed by indicator name. */
  info?: Record<string, HealthIndicatorEntry>;
  /** Indicators that failed, keyed by indicator name. */
  error?: Record<string, HealthIndicatorEntry>;
  /** Every indicator, passing and failing. */
  details: Record<string, HealthIndicatorEntry>;
}
