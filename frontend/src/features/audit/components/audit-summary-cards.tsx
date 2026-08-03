"use client";

import { Activity, Blocks, ScrollText, TriangleAlert } from "@/assets/icons";
import { StatCard } from "@/shared/components/data-display";
import { BackendPendingNote } from "@/shared/components/feedback";
import { formatNumber } from "@/utils";

import type { AuditSummary, DistributionEntry } from "../utils/analytics";

export interface AuditSummaryCardsProps {
  summary: AuditSummary | null;
  isLoading: boolean;
  /** Falls back to the list's own pagination total when the summary has none. */
  fallbackTotal?: number | null;
}

/** The largest entry in a distribution, or `null` when there is none. */
function leader(entries: DistributionEntry[]): DistributionEntry | null {
  if (entries.length === 0) return null;
  return entries.reduce((best, entry) =>
    entry.count > best.count ? entry : best,
  );
}

/**
 * Distribution tiles for the current filters.
 *
 * The summary endpoint's response is undocumented, so each tile shows a real
 * figure when the payload yielded one and an em dash when it did not — never a
 * zero, which on a compliance screen reads as "nothing happened" rather than
 * "nothing was returned".
 *
 * The total falls back to `meta.pagination.total` from the list request, which
 * *is* documented, so the one figure most likely to be looked at survives even
 * if the summary shape turns out to be something else entirely.
 */
export function AuditSummaryCards({
  summary,
  isLoading,
  fallbackTotal,
}: AuditSummaryCardsProps) {
  const total = summary?.total ?? fallbackTotal ?? null;
  const topModule = summary ? leader(summary.byModule) : null;
  const topAction = summary ? leader(summary.byAction) : null;
  const topSeverity = summary ? leader(summary.bySeverity) : null;

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ScrollText}
          label="Records"
          value={total === null ? "—" : formatNumber(total)}
          hint="Matching the current filters"
          isLoading={isLoading}
        />
        <StatCard
          icon={Blocks}
          label="Busiest module"
          value={topModule?.label ?? "—"}
          hint={
            topModule ? `${formatNumber(topModule.count)} records` : undefined
          }
          valueClassName="text-lg"
          isLoading={isLoading}
        />
        <StatCard
          icon={Activity}
          label="Most common action"
          value={topAction?.label ?? "—"}
          hint={
            topAction ? `${formatNumber(topAction.count)} records` : undefined
          }
          valueClassName="text-lg"
          isLoading={isLoading}
        />
        <StatCard
          icon={TriangleAlert}
          label="Top severity"
          value={topSeverity?.label ?? "—"}
          hint={
            topSeverity
              ? `${formatNumber(topSeverity.count)} records`
              : "Not reported"
          }
          valueClassName="text-lg"
          isLoading={isLoading}
        />
      </div>

      {summary?.isUnrecognized ? (
        <BackendPendingNote>
          the summary endpoint answered with a shape this app does not
          recognize. Its response body is not documented, so no distribution can
          be read from it — the record count above comes from the list
          endpoint&apos;s pagination instead.
        </BackendPendingNote>
      ) : null}
    </div>
  );
}
