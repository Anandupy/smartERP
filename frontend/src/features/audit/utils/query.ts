import { ANY, DATE_PRESETS, type DatePreset } from "../constants";
import type { AuditLogQuery, AuditSortField } from "../types/audit.dto";
import { AUDIT_PAGE_SIZE_DEFAULT } from "../types/audit.dto";

/**
 * Turning the screen's filter state into the documented query parameters.
 *
 * Kept out of the hooks module because none of it needs React: it is a pure
 * translation, it is where the contract's parameter names are actually decided,
 * and it is the part most worth testing directly.
 */

/** The filter state the screen owns, before it becomes a query. */
export interface AuditFilters {
  search: string;
  module: string;
  action: string;
  datePreset: DatePreset;
  sortBy: AuditSortField;
  sortOrder: "asc" | "desc";
  page: number;
  limit: number;
}

export const auditFilterDefaults: AuditFilters = {
  search: "",
  module: ANY,
  action: ANY,
  datePreset: "ALL",
  sortBy: "timestamp",
  sortOrder: "desc",
  page: 1,
  limit: AUDIT_PAGE_SIZE_DEFAULT,
};

/**
 * Filter state → the documented query parameters.
 *
 * The one place `ANY` and `""` are translated to *absence*: `compact` in the
 * service strips `undefined`, but an empty `search=` would still be sent as a
 * parameter, and a filter the user cleared must not narrow anything.
 *
 * Date presets are resolved to ISO instants here rather than stored that way,
 * so "last 7 days" stays relative to when the query runs instead of freezing at
 * whatever moment the preset was clicked.
 */
export function toAuditQuery(filters: AuditFilters): AuditLogQuery {
  const preset = DATE_PRESETS.find(
    (entry) => entry.value === filters.datePreset,
  );
  const startDate =
    preset && preset.days !== null
      ? new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

  return {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    search: filters.search.trim() || undefined,
    module: filters.module === ANY ? undefined : filters.module,
    action: filters.action === ANY ? undefined : filters.action,
    startDate,
  };
}

/** How many filters are currently narrowing the list. Drives the reset control. */
export function countActiveFilters(filters: AuditFilters): number {
  return (
    (filters.search.trim() ? 1 : 0) +
    (filters.module !== ANY ? 1 : 0) +
    (filters.action !== ANY ? 1 : 0) +
    (filters.datePreset !== "ALL" ? 1 : 0)
  );
}
