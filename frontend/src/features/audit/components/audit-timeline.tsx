"use client";

import { TrendingUp } from "@/assets/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BackendPendingNote } from "@/shared/components/feedback";
import { formatDate, formatNumber } from "@/utils";

import type { AuditTimeline } from "../utils/analytics";

export interface AuditTimelineChartProps {
  timeline: AuditTimeline | null;
  isLoading: boolean;
}

/**
 * Daily activity for the current filters.
 *
 * Drawn as a bar-per-day list rather than a plotted chart, for two reasons: the
 * series is a count per day and needs no interpolation, and every bar carries
 * its own accessible label, so the whole trend is readable by a screen reader
 * without a parallel data table.
 *
 * Bars are scaled against the busiest day in the range, so the shape of the
 * period is visible whether the peak is 4 events or 40,000.
 */
export function AuditTimelineChart({
  timeline,
  isLoading,
}: AuditTimelineChartProps) {
  const points = timeline?.points ?? [];
  const peak = points.reduce((max, point) => Math.max(max, point.count), 0);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp aria-hidden="true" className="size-4" />
          Activity over time
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 pt-4">
        {isLoading ? <Skeleton className="h-32 w-full rounded-xl" /> : null}

        {!isLoading && points.length > 0 ? (
          <ol className="flex h-32 items-end gap-1" aria-label="Daily activity">
            {points.map((point) => {
              const height = peak > 0 ? (point.count / peak) * 100 : 0;

              return (
                <li
                  key={point.date}
                  className="flex h-full flex-1 flex-col justify-end"
                  title={`${formatDate(point.date)}: ${formatNumber(point.count)}`}
                >
                  <span
                    className="bg-primary/70 hover:bg-primary block w-full rounded-t-sm transition-colors"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  <span className="sr-only">
                    {formatDate(point.date)}: {formatNumber(point.count)}{" "}
                    records
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}

        {!isLoading && points.length === 0 && !timeline?.isUnrecognized ? (
          <p className="text-muted-foreground text-sm">
            No activity in the selected range.
          </p>
        ) : null}

        {timeline?.isUnrecognized ? (
          <BackendPendingNote>
            the timeline endpoint answered with a shape this app does not
            recognize. Its response body is not documented, so no daily series
            can be read from it.
          </BackendPendingNote>
        ) : null}
      </CardContent>
    </Card>
  );
}
