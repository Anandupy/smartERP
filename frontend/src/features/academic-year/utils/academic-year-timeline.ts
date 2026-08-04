import type { AcademicYearDto } from "../types/academic-year.dto";

/**
 * The academic calendar, derived from the two fields the backend actually
 * documents.
 *
 * `startDate` and `endDate` are real, documented, and present in both request
 * bodies — so a duration, an elapsed fraction and a "where are we now" marker
 * are **computed from data**, not invented. That makes this the one part of the
 * design's calendar screen that can be wired honestly.
 *
 * Everything else the design asks for — terms, semesters, holidays, exam
 * windows, "important milestones" — has no field and no endpoint anywhere in
 * the module documentation or the Postman collection. Those are marked with the
 * shared Backend Pending components rather than filled with plausible-looking
 * dates. A fabricated exam window on an academic calendar is not a cosmetic
 * error; somebody plans around it.
 */

/** Where a year sits relative to a moment in time. */
export type TimelinePhase = "upcoming" | "inProgress" | "completed" | "unknown";

export interface AcademicYearProgress {
  phase: TimelinePhase;
  /** Whole days from start to end, inclusive of both. `null` when unparseable. */
  totalDays: number | null;
  /** Whole days elapsed, clamped to `[0, totalDays]`. `null` when unparseable. */
  elapsedDays: number | null;
  /** Whole days remaining, clamped to `[0, totalDays]`. */
  remainingDays: number | null;
  /** Elapsed fraction as a percentage, `0`–`100`. `null` when unparseable. */
  percentComplete: number | null;
  startDate: Date | null;
  endDate: Date | null;
}

const MS_PER_DAY = 86_400_000;

/**
 * Parse a documented date.
 *
 * The recorded samples are bare `YYYY-MM-DD`, which `Date` parses as **UTC
 * midnight**. That is deliberate rather than incidental: parsing as local time
 * would make an academic year start a day earlier or later depending on where
 * the operator is sitting, and a whole-day count is the only thing this module
 * needs. A full ISO timestamp is accepted too. Anything unparseable is `null`,
 * never a silently wrong date.
 */
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** UTC midnight of a date, so day arithmetic is not shifted by a time of day. */
function startOfUtcDay(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

/**
 * How far through its span an academic year is at `now`.
 *
 * Returns an `unknown` phase with null figures when either bound is missing or
 * unparseable, so a caller can render "not reported" rather than a progress bar
 * sitting at a meaningless zero. `now` is a parameter rather than a call to
 * `Date.now()` inside, which is what makes this testable without freezing the
 * clock.
 */
export function academicYearProgress(
  year: Pick<AcademicYearDto, "startDate" | "endDate">,
  now: Date = new Date(),
): AcademicYearProgress {
  const startDate = parseDate(year.startDate);
  const endDate = parseDate(year.endDate);

  const empty: AcademicYearProgress = {
    phase: "unknown",
    totalDays: null,
    elapsedDays: null,
    remainingDays: null,
    percentComplete: null,
    startDate,
    endDate,
  };

  if (!startDate || !endDate) return empty;

  const start = startOfUtcDay(startDate);
  const end = startOfUtcDay(endDate);

  // A range that ends before it starts violates documented rule 1. Rather than
  // render a negative duration, it is reported as unknown — the data is wrong,
  // and saying so is more useful than drawing it.
  if (end < start) return empty;

  const today = startOfUtcDay(now);

  // Inclusive of both endpoints: a year running 1 Apr to 1 Apr is one day long,
  // because the documentation describes a year by its first and last day.
  const totalDays = Math.round((end - start) / MS_PER_DAY) + 1;
  const rawElapsed = Math.round((today - start) / MS_PER_DAY);
  const elapsedDays = Math.min(Math.max(rawElapsed, 0), totalDays);

  const phase: TimelinePhase =
    today < start ? "upcoming" : today > end ? "completed" : "inProgress";

  return {
    phase,
    totalDays,
    elapsedDays,
    remainingDays: totalDays - elapsedDays,
    percentComplete: Math.round((elapsedDays / totalDays) * 100),
    startDate,
    endDate,
  };
}

/** One year's placement on a shared, multi-year timeline. */
export interface TimelineBand {
  year: AcademicYearDto;
  /** Left edge as a percentage of the whole span. */
  offsetPercent: number;
  /** Width as a percentage of the whole span. Never below 1, so it stays visible. */
  widthPercent: number;
  progress: AcademicYearProgress;
}

export interface TimelineLayout {
  bands: readonly TimelineBand[];
  /** Earliest start across every placeable year. */
  rangeStart: Date | null;
  /** Latest end across every placeable year. */
  rangeEnd: Date | null;
  /** "Today" as a percentage of the span, or `null` when it falls outside it. */
  todayPercent: number | null;
  /** Years dropped because a date was missing or unparseable. */
  unplaceable: readonly AcademicYearDto[];
}

/**
 * Lay several academic years out on one horizontal axis.
 *
 * The axis spans the earliest start to the latest end across the years that
 * could be placed, so the picture is of the branch's real history rather than
 * of an arbitrary window. Years whose dates cannot be parsed are **returned
 * separately** rather than dropped silently — a year missing from a calendar is
 * a far more confusing bug than one listed as unplaceable.
 */
export function buildTimelineLayout(
  years: readonly AcademicYearDto[],
  now: Date = new Date(),
): TimelineLayout {
  const placeable: { year: AcademicYearDto; start: number; end: number }[] = [];
  const unplaceable: AcademicYearDto[] = [];

  for (const year of years) {
    const start = parseDate(year.startDate);
    const end = parseDate(year.endDate);
    if (!start || !end || startOfUtcDay(end) < startOfUtcDay(start)) {
      unplaceable.push(year);
      continue;
    }
    placeable.push({
      year,
      start: startOfUtcDay(start),
      end: startOfUtcDay(end),
    });
  }

  if (placeable.length === 0) {
    return {
      bands: [],
      rangeStart: null,
      rangeEnd: null,
      todayPercent: null,
      unplaceable,
    };
  }

  const rangeStart = Math.min(...placeable.map((entry) => entry.start));
  const rangeEnd = Math.max(...placeable.map((entry) => entry.end));
  // Guard the single-day-span case, which would otherwise divide by zero.
  const span = Math.max(rangeEnd - rangeStart, MS_PER_DAY);

  const bands = placeable
    .slice()
    .sort((a, b) => a.start - b.start)
    .map<TimelineBand>((entry) => ({
      year: entry.year,
      offsetPercent: ((entry.start - rangeStart) / span) * 100,
      widthPercent: Math.max(((entry.end - entry.start) / span) * 100, 1),
      progress: academicYearProgress(entry.year, now),
    }));

  const today = startOfUtcDay(now);
  const todayPercent =
    today >= rangeStart && today <= rangeEnd
      ? ((today - rangeStart) / span) * 100
      : null;

  return {
    bands,
    rangeStart: new Date(rangeStart),
    rangeEnd: new Date(rangeEnd),
    todayPercent,
    unplaceable,
  };
}
