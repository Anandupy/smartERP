"use client";

import { useMemo, useState } from "react";

import { Download, RefreshCw, ScrollText } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks";
import {
  DataTablePagination,
  DataTableToolbar,
} from "@/shared/components/data";
import { EmptyState } from "@/shared/components/feedback";
import { AUDIT_PAGE_SIZE_MAX } from "../types/audit.dto";

import {
  useAuditLogs,
  useAuditSummary,
  useAuditTimeline,
} from "../hooks/use-audit-logs";
import {
  auditFilterDefaults,
  countActiveFilters,
  toAuditQuery,
  type AuditFilters,
} from "../utils/query";
import type { AuditLogDto } from "../types/audit.dto";
import { AuditDetailDrawer } from "./audit-detail-drawer";
import { AuditExportDialog } from "./audit-export-dialog";
import { AuditFiltersControls } from "./audit-filters";
import { AuditLogTable } from "./audit-log-table";
import { AuditSummaryCards } from "./audit-summary-cards";
import { AuditTimelineChart } from "./audit-timeline";

export interface AuditExplorerProps {
  /**
   * Filters the surrounding screen pins. Settings History pins
   * `module: "SYSTEM"`; the audit page pins nothing.
   */
  fixedFilters?: Partial<AuditFilters>;
  /** Which pinned filters to hide controls for. */
  lockedFilters?: ReadonlyArray<keyof AuditFilters>;
  /** Hides the summary tiles and the daily chart for a narrower embedding. */
  showAnalytics?: boolean;
  searchPlaceholder?: string;
  /** Copy for the "no records at all" state, which differs per embedding. */
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * The audit trail, filters, analytics and detail view as one composable unit.
 *
 * Written as a component rather than a screen because two very different pages
 * need the same thing scoped differently: the Audit Logs module shows
 * everything, and System Settings' History shows the same explorer pinned to
 * the `SYSTEM` module. Pinning is a prop, so the second page is a composition
 * rather than a copy — and neither feature imports the other, since the route
 * does the joining.
 *
 * All three queries share one filter state and therefore one set of parameters,
 * which is what stops the tiles above the table from describing a different
 * slice than the table itself.
 */
export function AuditExplorer({
  fixedFilters,
  lockedFilters = [],
  showAnalytics = true,
  searchPlaceholder = "Search events, entities, users…",
  emptyTitle = "No audit records",
  emptyDescription = "Nothing has been recorded within your access boundary yet.",
}: AuditExplorerProps) {
  const [filters, setFilters] = useState<AuditFilters>({
    ...auditFilterDefaults,
    ...fixedFilters,
  });
  const [selected, setSelected] = useState<AuditLogDto | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Debounced so typing does not fire a request per keystroke; every other
  // control changes discretely and applies at once.
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const query = useMemo(
    () =>
      toAuditQuery({ ...filters, search: debouncedSearch, ...fixedFilters }),
    [filters, debouncedSearch, fixedFilters],
  );

  const { logs, pagination, isPending, isFetching, error, refetch } =
    useAuditLogs(query);
  const { summary, isPending: isSummaryPending } = useAuditSummary(query);
  const { timeline, isPending: isTimelinePending } = useAuditTimeline(query);

  const update = (next: Partial<AuditFilters>) =>
    setFilters((current) => ({ ...current, ...next }));

  const activeFilterCount = countActiveFilters({
    ...filters,
    search: debouncedSearch,
  });

  const reset = () =>
    setFilters({
      ...auditFilterDefaults,
      ...fixedFilters,
      limit: filters.limit,
    });

  return (
    <div className="space-y-4">
      {showAnalytics ? (
        <>
          <AuditSummaryCards
            summary={summary}
            isLoading={isSummaryPending}
            fallbackTotal={pagination?.total ?? null}
          />
          <AuditTimelineChart
            timeline={timeline}
            isLoading={isTimelinePending}
          />
        </>
      ) : null}

      <DataTableToolbar
        search={filters.search}
        onSearchChange={(search) => update({ search, page: 1 })}
        searchPlaceholder={searchPlaceholder}
        searchLabel="Search audit records"
        activeFilterCount={activeFilterCount}
        onClearFilters={reset}
        filters={
          <AuditFiltersControls
            filters={filters}
            onChange={update}
            locked={lockedFilters}
          />
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Refresh"
              disabled={isFetching}
              onClick={() => refetch()}
            >
              <RefreshCw />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsExportOpen(true)}
            >
              <Download />
              Export
            </Button>
          </>
        }
      />

      <AuditLogTable
        logs={logs}
        isLoading={isPending}
        error={error}
        onRetry={() => refetch()}
        onSelect={setSelected}
        emptyState={
          activeFilterCount > 0 ? (
            <EmptyState
              title="No records match those filters"
              description="Try a wider date range, or a different module or action."
              action={
                <Button type="button" variant="outline" onClick={reset}>
                  Reset filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ScrollText}
              title={emptyTitle}
              description={emptyDescription}
            />
          )
        }
      />

      {pagination ? (
        <DataTablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          isLoading={isFetching}
          onPageChange={(page) => update({ page })}
          onPageSizeChange={(limit) => update({ limit, page: 1 })}
          pageSizeOptions={[10, 25, 50, AUDIT_PAGE_SIZE_MAX]}
        />
      ) : null}

      <AuditDetailDrawer
        log={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />

      <AuditExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        query={query}
        total={pagination?.total ?? null}
      />
    </div>
  );
}
