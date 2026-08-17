/**
 * The single place backend probe outcomes become frontend health states.
 *
 * Three dimensions, deliberately never collapsed into one "system healthy"
 * flag — `/live` answers "is the process running?", `/ready` answers "can this
 * instance serve traffic?", `/health` answers "are dependencies healthy?", and
 * they fail independently: a database outage makes `/ready` and `/health` fail
 * while `/live` keeps returning 200, because `/live` checks no dependencies at
 * all (`health.controller.ts`, verified in source).
 *
 * `ProbeOutcome` is transport-agnostic on purpose: `httpStatus: null` means the
 * request never reached the server (network error, timeout, cancellation) —
 * that is always `"unknown"`, never assumed to mean any particular subsystem is
 * down. A received non-2xx status is a real answer from the process and is
 * mapped per-probe below.
 */

export interface ProbeOutcome {
  httpOk: boolean;
  /** `null` when no response was ever received — network failure, timeout, cancel. */
  httpStatus: number | null;
  /** The parsed success body, only meaningful when `httpOk` is true. */
  data?: unknown;
}

export type LiveState = "live" | "down" | "unknown";
export type ReadyState = "ready" | "not-ready" | "unknown";
export type HealthOverallState = "healthy" | "degraded" | "unknown";
export type IndicatorState = "up" | "down" | "unknown";

export function mapHealthStatus(kind: "live", outcome: ProbeOutcome): LiveState;
export function mapHealthStatus(kind: "ready", outcome: ProbeOutcome): ReadyState;
export function mapHealthStatus(
  kind: "health",
  outcome: ProbeOutcome,
): HealthOverallState;
export function mapHealthStatus(
  kind: "live" | "ready" | "health",
  outcome: ProbeOutcome,
): LiveState | ReadyState | HealthOverallState {
  if (outcome.httpOk) {
    if (kind === "live") return "live";
    if (kind === "ready") return "ready";
    const status = (outcome.data as { status?: string } | undefined)?.status;
    return status === "ok" ? "healthy" : "degraded";
  }

  // No response reached the server at all — this says nothing about the
  // process, traffic readiness or any dependency. It is unreachable, full stop.
  if (outcome.httpStatus === null) return "unknown";

  // A real, non-2xx answer from the process.
  if (kind === "live") return "down";
  if (kind === "ready") return "not-ready";
  return "degraded";
}

/** Normalize one dependency/resource indicator's reported status. */
export function mapIndicatorStatus(raw: string | undefined): IndicatorState {
  if (raw === "up") return "up";
  if (raw === "down") return "down";
  return "unknown";
}

export type OverallState = "healthy" | "degraded" | "unavailable" | "unknown";

/**
 * Combine the three independent dimensions into one headline word for the
 * page header — never a single boolean "system healthy" flag, but a reader
 * does want one word before the detail. The three cards beneath it always
 * stay independently visible regardless of what this returns.
 */
export function deriveOverallState(
  live: LiveState,
  ready: ReadyState,
  health: HealthOverallState,
): OverallState {
  if (live === "unknown" && ready === "unknown" && health === "unknown") {
    return "unknown";
  }
  if (live === "down") return "unavailable";
  if (ready === "not-ready" || health === "degraded") return "degraded";
  if (live === "live" && ready === "ready" && health === "healthy") {
    return "healthy";
  }
  return "unknown";
}

/** Humanize a process uptime in seconds. Frontend presentation only. */
export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "Unknown";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}
