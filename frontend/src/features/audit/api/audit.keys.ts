import { createQueryKeys } from "@/core/query";

import type { AuditLogQuery } from "../types/audit.dto";

/**
 * Query keys for audit logs.
 *
 * Filters are part of the list key because the server does the filtering: two
 * different filter sets are two different responses and must not share a cache
 * entry. Summary and timeline take the same filters and are keyed the same way,
 * so changing a date range invalidates all three together — which is what keeps
 * the tiles from describing a different slice than the table beneath them.
 */
const base = createQueryKeys("audit-logs");

export const auditKeys = {
  ...base,
  list: (query: AuditLogQuery) => ["audit-logs", "list", query] as const,
  summary: (query: AuditLogQuery) => ["audit-logs", "summary", query] as const,
  timeline: (query: AuditLogQuery) =>
    ["audit-logs", "timeline", query] as const,
} as const;
