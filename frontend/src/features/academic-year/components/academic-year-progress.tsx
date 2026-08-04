"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/utils";

import type {
  AcademicYearProgress,
  TimelinePhase,
} from "../utils/academic-year-timeline";

/** How each phase reads, and what the figure beside it means. */
const PHASE_LABEL: Record<TimelinePhase, string> = {
  upcoming: "Not started",
  inProgress: "In progress",
  completed: "Completed",
  unknown: "Dates not reported",
};

export interface AcademicYearProgressBarProps {
  progress: AcademicYearProgress;
  /** Renders the start/end captions beneath the bar. */
  withDates?: boolean;
  className?: string;
}

/**
 * How far through its span an academic year is.
 *
 * This is one of the few figures in the module that is genuinely **computed
 * from documented data** rather than declared pending: `startDate` and
 * `endDate` are real fields in both request bodies, so elapsed days, remaining
 * days and a percentage all follow from them without a single assumption.
 *
 * When either date is missing or unparseable the bar is not rendered at all,
 * and the phase reads "Dates not reported". A progress bar sitting at zero
 * would be indistinguishable from a year that has not started, which is a
 * different claim entirely.
 */
export function AcademicYearProgressBar({
  progress,
  withDates = false,
  className,
}: AcademicYearProgressBarProps) {
  const { phase, percentComplete, elapsedDays, remainingDays, totalDays } =
    progress;

  if (percentComplete === null || totalDays === null) {
    return (
      <p className={cn("text-muted-foreground text-sm", className)}>
        {PHASE_LABEL.unknown}
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-foreground text-sm font-medium">
          {PHASE_LABEL[phase]}
        </span>
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatNumber(percentComplete)}%
        </span>
      </div>

      <Progress
        value={percentComplete}
        aria-label={`${formatNumber(percentComplete)} percent of the academic year elapsed`}
      />

      <p className="text-muted-foreground text-xs">
        {phase === "upcoming"
          ? `${formatNumber(totalDays)} days long, starting ${formatDate(progress.startDate ?? "")}.`
          : phase === "completed"
            ? `${formatNumber(totalDays)} days long, ended ${formatDate(progress.endDate ?? "")}.`
            : `Day ${formatNumber(elapsedDays ?? 0)} of ${formatNumber(totalDays)} · ${formatNumber(remainingDays ?? 0)} remaining.`}
      </p>

      {withDates && progress.startDate && progress.endDate ? (
        <div className="text-muted-foreground flex justify-between gap-2 text-xs">
          <span>{formatDate(progress.startDate)}</span>
          <span>{formatDate(progress.endDate)}</span>
        </div>
      ) : null}
    </div>
  );
}
