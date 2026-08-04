"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ROUTES } from "@/constants";
import { cn } from "@/lib/utils";
import { BackendPendingNote } from "@/shared/components/feedback";
import { formatDate } from "@/utils";

import { ACADEMIC_YEAR_STATE_PRESENTATION, academicYearState } from "../constants";
import type { AcademicYearDto } from "../types/academic-year.dto";
import { buildTimelineLayout } from "../utils/academic-year-timeline";
import { AcademicYearStatusBadge } from "./academic-year-status-badge";

/** Band fill per state, so the axis reads at a glance without a legend hunt. */
const BAND_TONE: Record<string, string> = {
  locked: "bg-muted-foreground/40",
  selected: "bg-chart-2",
  active: "bg-chart-3",
  inactive: "bg-muted-foreground/25",
  unknown: "bg-muted-foreground/20",
};

export interface AcademicYearTimelineProps {
  academicYears: readonly AcademicYearDto[];
  /** Renders each band as a link to its detail screen. */
  linkToDetail?: boolean;
  className?: string;
}

/**
 * Every academic year of a branch, plotted on one horizontal axis.
 *
 * The axis spans the earliest documented start to the latest documented end, so
 * the picture is of the branch's real history rather than of an arbitrary
 * window, and the "today" marker is placed only when it actually falls inside
 * that span.
 *
 * This is drawn entirely from `startDate` and `endDate`, which are real
 * documented fields present in both request bodies. Terms, semesters, holidays
 * and exam windows would sit on the same axis and have **no** field and no
 * endpoint anywhere in the contract, so they are declared rather than sketched
 * in — a fabricated exam window on an academic calendar is something people
 * plan around.
 *
 * Years whose dates cannot be parsed are listed beneath the axis instead of
 * being dropped. A year silently missing from a calendar is a far more
 * confusing bug than one named as unplaceable.
 */
export function AcademicYearTimeline({
  academicYears,
  linkToDetail = true,
  className,
}: AcademicYearTimelineProps) {
  const layout = useMemo(
    () => buildTimelineLayout(academicYears),
    [academicYears],
  );

  if (layout.bands.length === 0) {
    return (
      <div className={cn("space-y-3", className)}>
        <p className="text-muted-foreground text-sm">
          No academic year has a date range that can be placed on a timeline.
        </p>
        {layout.unplaceable.length > 0 ? (
          <ul className="text-muted-foreground space-y-1 text-sm">
            {layout.unplaceable.map((year) => (
              <li key={year.id}>
                {year.name} — start or end date missing or unreadable.
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="text-muted-foreground flex justify-between gap-2 text-xs">
        <span>{formatDate(layout.rangeStart ?? "")}</span>
        <span>{formatDate(layout.rangeEnd ?? "")}</span>
      </div>

      <ol className="space-y-3">
        {layout.bands.map((band) => {
          const year = band.year;
          const state = academicYearState(year);
          const presentation = ACADEMIC_YEAR_STATE_PRESENTATION[state];
          const label = `${year.name}, ${presentation.label}, ${formatDate(year.startDate)} to ${formatDate(year.endDate)}`;

          const track = (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground truncate text-sm font-medium">
                  {year.name}
                </span>
                <AcademicYearStatusBadge year={year} />
                <span className="text-muted-foreground ml-auto text-xs whitespace-nowrap">
                  {formatDate(year.startDate)} – {formatDate(year.endDate)}
                </span>
              </div>

              {/* The axis. `aria-hidden` because the band is decorative: the
                  same information is in the text above it, and a screen reader
                  gains nothing from a percentage-positioned rectangle. */}
              <div
                aria-hidden="true"
                className="bg-muted relative mt-2 h-2 w-full overflow-hidden rounded-full"
              >
                <span
                  className={cn(
                    "absolute inset-y-0 rounded-full",
                    BAND_TONE[state] ?? BAND_TONE.unknown,
                  )}
                  style={{
                    left: `${band.offsetPercent}%`,
                    width: `${band.widthPercent}%`,
                  }}
                />
                {layout.todayPercent !== null ? (
                  <span
                    className="bg-foreground absolute inset-y-0 w-0.5"
                    style={{ left: `${layout.todayPercent}%` }}
                  />
                ) : null}
              </div>
            </>
          );

          return (
            <li key={year.id}>
              {linkToDetail ? (
                <Link
                  href={ROUTES.app.academicYears.detail(year.id)}
                  aria-label={label}
                  className="hover:bg-muted/60 focus-visible:ring-ring -mx-2 block rounded-lg px-2 py-2 focus-visible:ring-3 focus-visible:outline-none"
                >
                  {track}
                </Link>
              ) : (
                <div className="px-2 py-2">{track}</div>
              )}
            </li>
          );
        })}
      </ol>

      {layout.todayPercent !== null ? (
        <p className="text-muted-foreground text-xs">
          The vertical marker on each band is today.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Today falls outside the range covered by these years, so no marker is
          shown.
        </p>
      )}

      {layout.unplaceable.length > 0 ? (
        <div className="space-y-1">
          <p className="text-foreground text-sm font-medium">
            Not placed on the timeline
          </p>
          <ul className="text-muted-foreground space-y-1 text-sm">
            {layout.unplaceable.map((year) => (
              <li key={year.id}>
                {year.name} — start or end date missing or unreadable.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <BackendPendingNote>
        terms, semesters, holidays and exam windows would sit on this axis, and
        no field or endpoint for any of them exists in the contract. Only the
        documented start and end dates are plotted.
      </BackendPendingNote>
    </div>
  );
}
