import { describe, expect, it } from "vitest";

import {
  academicYearProgress,
  buildTimelineLayout,
} from "@/features/academic-year";

import {
  academicYearDto,
  lockedAcademicYearDto,
  upcomingAcademicYearDto,
} from "@tests/fixtures/academic-year";

/** A fixed "now" so nothing here depends on when the suite runs. */
const MID_YEAR = new Date("2025-10-01T00:00:00.000Z");

describe("academicYearProgress", () => {
  it("counts days inclusively of both endpoints", () => {
    // The documentation describes a year by its first and last day, so a year
    // running 1 Apr to 1 Apr is one day long, not zero.
    const { totalDays } = academicYearProgress(
      { startDate: "2025-04-01", endDate: "2025-04-01" },
      MID_YEAR,
    );

    expect(totalDays).toBe(1);
  });

  it("computes the span of the documented sample", () => {
    // 1 Apr 2025 to 31 Mar 2026 inclusive.
    const { totalDays } = academicYearProgress(academicYearDto(), MID_YEAR);
    expect(totalDays).toBe(365);
  });

  it("reports a year in progress with elapsed and remaining days", () => {
    const progress = academicYearProgress(academicYearDto(), MID_YEAR);

    expect(progress.phase).toBe("inProgress");
    expect(progress.elapsedDays).toBe(183);
    expect(progress.remainingDays).toBe(182);
    expect(progress.percentComplete).toBe(50);
  });

  it("reports a future year as upcoming with nothing elapsed", () => {
    const progress = academicYearProgress(
      upcomingAcademicYearDto(),
      MID_YEAR,
    );

    expect(progress.phase).toBe("upcoming");
    expect(progress.elapsedDays).toBe(0);
    expect(progress.percentComplete).toBe(0);
  });

  it("reports a past year as completed and clamps elapsed to the total", () => {
    const progress = academicYearProgress(lockedAcademicYearDto(), MID_YEAR);

    expect(progress.phase).toBe("completed");
    expect(progress.elapsedDays).toBe(progress.totalDays);
    expect(progress.percentComplete).toBe(100);
  });

  it("does not shift with the operator's time zone", () => {
    // Bare `YYYY-MM-DD` is parsed as UTC midnight deliberately: parsing as
    // local time would make a year start a day earlier or later depending on
    // where the person looking at it is sitting.
    const early = academicYearProgress(
      academicYearDto(),
      new Date("2025-04-01T00:30:00.000Z"),
    );
    const late = academicYearProgress(
      academicYearDto(),
      new Date("2025-04-01T23:30:00.000Z"),
    );

    expect(early.elapsedDays).toBe(0);
    expect(late.elapsedDays).toBe(0);
  });

  it("reports unknown rather than guessing when a date is unreadable", () => {
    const progress = academicYearProgress(
      { startDate: "not-a-date", endDate: "2026-03-31" },
      MID_YEAR,
    );

    expect(progress.phase).toBe("unknown");
    expect(progress.totalDays).toBeNull();
    expect(progress.percentComplete).toBeNull();
  });

  it("refuses to draw a range that ends before it starts", () => {
    // That violates documented rule 1. Saying the data is wrong is more useful
    // than rendering a negative duration.
    const progress = academicYearProgress(
      { startDate: "2026-03-31", endDate: "2025-04-01" },
      MID_YEAR,
    );

    expect(progress.phase).toBe("unknown");
    expect(progress.totalDays).toBeNull();
  });
});

describe("buildTimelineLayout", () => {
  const years = [
    academicYearDto(),
    lockedAcademicYearDto(),
    upcomingAcademicYearDto(),
  ];

  it("spans the earliest start to the latest end", () => {
    const layout = buildTimelineLayout(years, MID_YEAR);

    expect(layout.rangeStart?.toISOString()).toContain("2024-04-01");
    expect(layout.rangeEnd?.toISOString()).toContain("2027-03-31");
  });

  it("orders bands chronologically regardless of input order", () => {
    const layout = buildTimelineLayout(years, MID_YEAR);

    expect(layout.bands.map((band) => band.year.id)).toEqual([
      "ay-2",
      "ay-1",
      "ay-3",
    ]);
  });

  it("starts the earliest band at the left edge", () => {
    const layout = buildTimelineLayout(years, MID_YEAR);
    expect(layout.bands[0]?.offsetPercent).toBe(0);
  });

  it("keeps every band within the axis", () => {
    const layout = buildTimelineLayout(years, MID_YEAR);

    for (const band of layout.bands) {
      expect(band.offsetPercent).toBeGreaterThanOrEqual(0);
      expect(band.offsetPercent + band.widthPercent).toBeLessThanOrEqual(100.5);
    }
  });

  it("places today when it falls inside the span", () => {
    const layout = buildTimelineLayout(years, MID_YEAR);

    expect(layout.todayPercent).not.toBeNull();
    expect(layout.todayPercent).toBeGreaterThan(0);
    expect(layout.todayPercent).toBeLessThan(100);
  });

  it("omits the today marker when today falls outside the span", () => {
    const layout = buildTimelineLayout(years, new Date("2030-01-01T00:00:00Z"));
    expect(layout.todayPercent).toBeNull();
  });

  it("reports unplaceable years separately instead of dropping them", () => {
    // A year silently missing from a calendar is a far more confusing bug than
    // one named as unplaceable.
    const layout = buildTimelineLayout(
      [academicYearDto(), academicYearDto({ id: "ay-x", startDate: "" })],
      MID_YEAR,
    );

    expect(layout.bands).toHaveLength(1);
    expect(layout.unplaceable.map((year) => year.id)).toEqual(["ay-x"]);
  });

  it("returns an empty layout when nothing can be placed", () => {
    const layout = buildTimelineLayout(
      [academicYearDto({ startDate: "", endDate: "" })],
      MID_YEAR,
    );

    expect(layout.bands).toHaveLength(0);
    expect(layout.rangeStart).toBeNull();
    expect(layout.unplaceable).toHaveLength(1);
  });

  it("gives a single-day year a visible width", () => {
    const layout = buildTimelineLayout(
      [academicYearDto({ startDate: "2025-04-01", endDate: "2025-04-01" })],
      MID_YEAR,
    );

    expect(layout.bands[0]?.widthPercent).toBeGreaterThanOrEqual(1);
  });
});
