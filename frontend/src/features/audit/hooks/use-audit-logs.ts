"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { PaginationMeta } from "@/types/api";

import { auditKeys } from "../api/audit.keys";
import { auditService } from "../api/audit.service";
import type { AuditLogQuery } from "../types/audit.dto";
import { readSummary, readTimeline } from "../utils/analytics";

/**
 * A page of audit records.
 *
 * Server-paginated, unlike the maintenance rules list — here the endpoint
 * documents `page`, `limit`, `sortBy`, `sortOrder` and fifteen filters, so
 * every one of them is sent and nothing is narrowed in the browser.
 *
 * `placeholderData` keeps the previous page on screen while the next loads, so
 * paging does not blank the table and bounce the scroll position.
 *
 * The endpoint returns its page as `{ items, meta }` inside `data`, and names
 * the page size `limit`. Both are translated here, once, into the shape the
 * rest of the platform's list UI reads (`PaginationMeta`), so the explorer and
 * the pager stay identical to every other list in the app.
 */
export function useAuditLogs(query: AuditLogQuery) {
  const result = useQuery({
    queryKey: auditKeys.list(query),
    queryFn: () => auditService.list(query),
    meta: { skipErrorToast: true },
    placeholderData: (previous) => previous,
  });

  const page = result.data;
  const meta = page?.meta;

  // Left to the React Compiler rather than a manual `useMemo`: the inferred
  // dependency is the whole page, and pinning it to `page.meta` by hand made
  // the compiler skip the hook entirely.
  const pagination: PaginationMeta | null = meta
    ? {
        page: meta.page,
        pageSize: meta.limit,
        total: meta.total,
        totalPages: meta.totalPages,
      }
    : null;

  return {
    ...result,
    logs: page?.items ?? [],
    pagination,
  };
}

/** One audit record, with `metadata` and `changes`. */
export function useAuditLog(id: string | null) {
  return useQuery({
    queryKey: auditKeys.detail(id ?? ""),
    queryFn: () => auditService.get(id ?? ""),
    enabled: Boolean(id),
    meta: { skipErrorToast: true },
  });
}

/**
 * Distribution metrics for the current filters.
 *
 * The response shape is undocumented, so the payload goes through
 * `readSummary`, which reports `isUnrecognized` rather than returning zeros —
 * see `utils/analytics.ts`.
 */
export function useAuditSummary(query: AuditLogQuery) {
  const result = useQuery({
    queryKey: auditKeys.summary(query),
    queryFn: () => auditService.summary(query),
    meta: { skipErrorToast: true },
    retry: false,
  });

  const summary = useMemo(
    () => (result.data === undefined ? null : readSummary(result.data)),
    [result.data],
  );

  return { ...result, summary };
}

/** Daily activity counts for the current filters. Shape undocumented. */
export function useAuditTimeline(query: AuditLogQuery) {
  const result = useQuery({
    queryKey: auditKeys.timeline(query),
    queryFn: () => auditService.timeline(query),
    meta: { skipErrorToast: true },
    retry: false,
  });

  const timeline = useMemo(
    () => (result.data === undefined ? null : readTimeline(result.data)),
    [result.data],
  );

  return { ...result, timeline };
}
