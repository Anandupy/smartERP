import { describe, expect, it } from "vitest";

// Imported from the modules under test rather than the feature barrel: these
// are pure functions, and pulling the barrel would drag the module's entire
// component tree — tables, drawers, dialogs — into a worker that needs none of
// it. Application code still imports through the barrel (AGENTS.md §7).
import { ANY } from "@/features/audit/constants";
import {
  readDistribution,
  readSummary,
  readTimeline,
} from "@/features/audit/utils/analytics";
import {
  auditFilterDefaults,
  countActiveFilters,
  toAuditQuery,
} from "@/features/audit/utils/query";

/**
 * The summary and timeline endpoints document a purpose and no response body.
 * These cases pin the readers against every shape the backend plausibly
 * returns, so whichever it turns out to be, the screens already work — and any
 * other shape degrades to a visible `Backend Pending` marker rather than to a
 * zero that reads as a measurement.
 */
describe("readDistribution", () => {
  it("reads a map of label to count", () => {
    expect(readDistribution({ SYSTEM: 4, AUTH: 2 })).toEqual([
      { label: "SYSTEM", count: 4 },
      { label: "AUTH", count: 2 },
    ]);
  });

  it("reads an array of objects keyed by the grouped field", () => {
    expect(
      readDistribution([
        { module: "SYSTEM", count: 4 },
        { module: "AUTH", count: 2 },
      ]),
    ).toEqual([
      { label: "SYSTEM", count: 4 },
      { label: "AUTH", count: 2 },
    ]);
  });

  it("reads a Prisma-style groupBy result", () => {
    expect(readDistribution([{ action: "UPDATE", _count: 7 }])).toEqual([
      { label: "UPDATE", count: 7 },
    ]);
  });

  it("accepts counts that arrive as numeric strings", () => {
    expect(readDistribution({ SYSTEM: "4" })).toEqual([
      { label: "SYSTEM", count: 4 },
    ]);
  });

  it("drops entries it cannot read instead of inventing a zero", () => {
    expect(readDistribution([{ nothing: "useful" }])).toEqual([]);
    expect(readDistribution("not a distribution")).toEqual([]);
  });
});

describe("readSummary", () => {
  it("reads a fully-formed summary", () => {
    const summary = readSummary({
      total: 12,
      byModule: { SYSTEM: 8, AUTH: 4 },
      byAction: [{ action: "UPDATE", count: 12 }],
    });

    expect(summary.total).toBe(12);
    expect(summary.byModule).toHaveLength(2);
    expect(summary.byAction).toEqual([{ label: "UPDATE", count: 12 }]);
    expect(summary.isUnrecognized).toBe(false);
  });

  it("accepts the alternative key names a backend might use", () => {
    const summary = readSummary({
      totalCount: 3,
      modules: [{ name: "SYSTEM", total: 3 }],
    });

    expect(summary.total).toBe(3);
    expect(summary.byModule).toEqual([{ label: "SYSTEM", count: 3 }]);
  });

  it("reports a payload it cannot read at all", () => {
    const summary = readSummary({ unexpected: { deeply: "nested" } });

    expect(summary.total).toBeNull();
    expect(summary.isUnrecognized).toBe(true);
  });

  it("treats no payload as empty rather than unreadable", () => {
    expect(readSummary(null).isUnrecognized).toBe(false);
    expect(readSummary({}).isUnrecognized).toBe(false);
  });
});

describe("readTimeline", () => {
  it("reads a series nested under a wrapper key", () => {
    const timeline = readTimeline({
      daily: [
        { date: "2026-08-01", count: 3 },
        { date: "2026-08-02", count: 5 },
      ],
    });

    expect(timeline.points).toHaveLength(2);
    expect(timeline.points[0]).toEqual({ date: "2026-08-01", count: 3 });
  });

  it("reads a bare array", () => {
    const timeline = readTimeline([{ day: "2026-08-01", total: 9 }]);

    expect(timeline.points).toEqual([{ date: "2026-08-01", count: 9 }]);
  });

  it("reports a series whose entries it cannot read", () => {
    const timeline = readTimeline({ daily: [{ nothing: "useful" }] });

    expect(timeline.points).toEqual([]);
    expect(timeline.isUnrecognized).toBe(true);
  });

  it("treats an empty series as no activity, not as unreadable", () => {
    expect(readTimeline({ daily: [] })).toEqual({
      points: [],
      isUnrecognized: false,
    });
  });
});

describe("toAuditQuery", () => {
  it("omits filters left at their defaults so nothing is narrowed", () => {
    const query = toAuditQuery(auditFilterDefaults);

    expect(query.module).toBeUndefined();
    expect(query.action).toBeUndefined();
    expect(query.search).toBeUndefined();
    expect(query.startDate).toBeUndefined();
  });

  it("sends the documented pagination and sort parameters", () => {
    const query = toAuditQuery(auditFilterDefaults);

    expect(query.page).toBe(1);
    expect(query.limit).toBe(50);
    expect(query.sortBy).toBe("timestamp");
    expect(query.sortOrder).toBe("desc");
  });

  it("omits a search box holding only whitespace", () => {
    expect(
      toAuditQuery({ ...auditFilterDefaults, search: "   " }).search,
    ).toBeUndefined();
  });

  it("resolves a date preset to an ISO start bound", () => {
    const query = toAuditQuery({ ...auditFilterDefaults, datePreset: "7D" });

    expect(query.startDate).toBeDefined();
    expect(Date.parse(query.startDate!)).toBeLessThan(Date.now());
  });

  it("passes explicit filter choices through", () => {
    const query = toAuditQuery({
      ...auditFilterDefaults,
      module: "SYSTEM",
      action: "UPDATE",
      search: " settings ",
    });

    expect(query).toMatchObject({
      module: "SYSTEM",
      action: "UPDATE",
      search: "settings",
    });
  });
});

describe("countActiveFilters", () => {
  it("counts nothing when every filter is at its default", () => {
    expect(countActiveFilters(auditFilterDefaults)).toBe(0);
  });

  it("counts each narrowed filter once", () => {
    expect(
      countActiveFilters({
        ...auditFilterDefaults,
        search: "settings",
        module: "SYSTEM",
        action: ANY,
        datePreset: "30D",
      }),
    ).toBe(3);
  });
});
