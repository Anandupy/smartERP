import { api } from "@/core/api";
import { compact } from "@/utils";

import type { AuditLogDto, AuditLogQuery } from "../types/audit.dto";

/**
 * Transport for `/audit-logs`.
 *
 * `list` uses `getEnvelope` rather than `get`: the documentation says the
 * endpoint returns "list of audit logs and pagination meta information", and
 * pagination arrives in `meta`, which the unwrapping helper discards.
 *
 * `summary` and `timeline` are typed `unknown` on purpose. Both endpoints have
 * a documented *purpose* — distribution counts grouped by module, action,
 * severity and status; daily activity counts plus recent events — but **no
 * documented response body**, and the grouped shapes are exactly the sort a
 * frontend cannot guess (`{module: count}`? `[{module, count}]`? nested under
 * `byModule`?). Consumers narrow them in `utils/summary.ts`, which reads what
 * it recognizes and reports the rest as pending.
 */
export const auditService = {
  /** `GET /audit-logs` → paginated, filtered records plus `meta.pagination`. */
  list: (query: AuditLogQuery = {}) =>
    api.getEnvelope<AuditLogDto[]>("/audit-logs", { params: compact(query) }),

  /** `GET /audit-logs/:id` → one record, including `metadata` and `changes`. */
  get: (id: string) => api.get<AuditLogDto>(`/audit-logs/${id}`),

  /** `GET /audit-logs/summary` → distribution metrics. Shape undocumented. */
  summary: (query: AuditLogQuery = {}) =>
    api.get<unknown>("/audit-logs/summary", { params: compact(query) }),

  /** `GET /audit-logs/timeline` → daily counts + recent events. Shape undocumented. */
  timeline: (query: AuditLogQuery = {}) =>
    api.get<unknown>("/audit-logs/timeline", { params: compact(query) }),
} as const;
