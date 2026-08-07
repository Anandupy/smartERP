import { api } from "@/core/api";
import { compact } from "@/utils";

import type {
  AuditLogDto,
  AuditLogPage,
  AuditLogQuery,
} from "../types/audit.dto";

/**
 * Transport for `/audit-logs`.
 *
 * `list` uses `get`, not `getEnvelope`: this endpoint nests its pagination
 * **inside the payload** as `{ items, meta }` rather than lifting it onto the
 * envelope's `meta.pagination`. Both conventions exist in the API and each
 * endpoint documents its own; reading the wrong one here handed the table an
 * object where it expected an array, so no row ever rendered and the pager had
 * no totals.
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
  /** `GET /audit-logs` → `{ items, meta }` — the page and its pagination. */
  list: (query: AuditLogQuery = {}) =>
    api.get<AuditLogPage>("/audit-logs", { params: compact(query) }),

  /** `GET /audit-logs/:id` → one record, including `metadata` and `changes`. */
  get: (id: string) => api.get<AuditLogDto>(`/audit-logs/${id}`),

  /** `GET /audit-logs/summary` → distribution metrics. Shape undocumented. */
  summary: (query: AuditLogQuery = {}) =>
    api.get<unknown>("/audit-logs/summary", { params: compact(query) }),

  /** `GET /audit-logs/timeline` → daily counts + recent events. Shape undocumented. */
  timeline: (query: AuditLogQuery = {}) =>
    api.get<unknown>("/audit-logs/timeline", { params: compact(query) }),
} as const;
