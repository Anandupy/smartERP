/**
 * Defensive readers for the two audit endpoints with no documented response.
 *
 * `GET /audit-logs/summary` and `GET /audit-logs/timeline` are documented by
 * *purpose* — "total counts and distribution metrics grouped by module, action,
 * severity and status", "daily log activity counts … plus the list of recent
 * simplified chronological timeline events" — and by nothing else. A grouped
 * count could be `{ADMISSIONS: 12}`, `[{module: "ADMISSIONS", count: 12}]`, or
 * either of those nested under `byModule`, and picking one would be inventing
 * contract.
 *
 * So these readers accept every one of those shapes, normalize what they
 * recognize, and report `isUnrecognized` when they recognize nothing. The
 * screens render real data when it fits and a `Backend Pending` marker when it
 * does not — never a zero that looks like a measurement.
 */

/** A `{label, count}` pair, however the backend chose to express it. */
export interface DistributionEntry {
  label: string;
  count: number;
}

export interface AuditSummary {
  /** Total matching records, when the payload states one. */
  total: number | null;
  byModule: DistributionEntry[];
  byAction: DistributionEntry[];
  bySeverity: DistributionEntry[];
  byStatus: DistributionEntry[];
  /** True when nothing in the payload could be read. */
  isUnrecognized: boolean;
}

export interface TimelinePoint {
  /** ISO date (day granularity), as supplied. */
  date: string;
  count: number;
}

export interface AuditTimeline {
  points: TimelinePoint[];
  isUnrecognized: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return null;
}

/** Candidate key names for the label and the count inside a grouped entry. */
const LABEL_KEYS = [
  "label",
  "name",
  "key",
  "module",
  "action",
  "severity",
  "status",
  "value",
];
const COUNT_KEYS = ["count", "total", "value", "_count"];

/**
 * Read one distribution, accepting either a map of label → count or an array of
 * objects carrying a label and a count under any of the usual names.
 */
export function readDistribution(value: unknown): DistributionEntry[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const entry = asRecord(item);
        if (!entry) return null;

        const labelKey = LABEL_KEYS.find(
          (key) => typeof entry[key] === "string" && entry[key] !== "",
        );
        const countKey = COUNT_KEYS.find((key) => asCount(entry[key]) !== null);
        if (!labelKey || !countKey) return null;

        return {
          label: String(entry[labelKey]),
          count: asCount(entry[countKey]) ?? 0,
        };
      })
      .filter((entry): entry is DistributionEntry => entry !== null);
  }

  const map = asRecord(value);
  if (!map) return [];

  return Object.entries(map)
    .map(([label, count]) => {
      const parsed = asCount(count);
      return parsed === null ? null : { label, count: parsed };
    })
    .filter((entry): entry is DistributionEntry => entry !== null);
}

/** First present key from a set of plausible names. */
function firstOf(
  source: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    if (source[key] !== undefined) return source[key];
  }
  return undefined;
}

/** Normalize `GET /audit-logs/summary`. */
export function readSummary(payload: unknown): AuditSummary {
  const empty: AuditSummary = {
    total: null,
    byModule: [],
    byAction: [],
    bySeverity: [],
    byStatus: [],
    isUnrecognized: false,
  };

  if (payload === null || payload === undefined) return empty;

  const source = asRecord(payload);
  if (!source) return { ...empty, isUnrecognized: true };

  const byModule = readDistribution(
    firstOf(source, ["byModule", "modules", "module"]),
  );
  const byAction = readDistribution(
    firstOf(source, ["byAction", "actions", "action"]),
  );
  const bySeverity = readDistribution(
    firstOf(source, ["bySeverity", "severities", "severity"]),
  );
  const byStatus = readDistribution(
    firstOf(source, ["byStatus", "statuses", "status"]),
  );
  const total = asCount(firstOf(source, ["total", "totalCount", "count"]));

  const recognizedAnything =
    total !== null ||
    byModule.length > 0 ||
    byAction.length > 0 ||
    bySeverity.length > 0 ||
    byStatus.length > 0;

  return {
    total,
    byModule,
    byAction,
    bySeverity,
    byStatus,
    isUnrecognized: !recognizedAnything && Object.keys(source).length > 0,
  };
}

/** Candidate key names for the date and count in a timeline point. */
const DATE_KEYS = ["date", "day", "timestamp", "bucket", "label"];

/** Normalize `GET /audit-logs/timeline` down to its daily counts. */
export function readTimeline(payload: unknown): AuditTimeline {
  const empty: AuditTimeline = { points: [], isUnrecognized: false };

  if (payload === null || payload === undefined) return empty;

  const source = asRecord(payload);
  // The daily series may be the whole payload or one property of it.
  const series = Array.isArray(payload)
    ? payload
    : source
      ? firstOf(source, [
          // What the endpoint actually returns. The rest stay accepted: they
          // cost nothing and the reader's whole purpose is to survive a shape
          // it was not told about.
          "dailyActivity",
          "daily",
          "dailyCounts",
          "trends",
          "points",
          "timeline",
        ])
      : undefined;

  if (!Array.isArray(series)) {
    return {
      points: [],
      isUnrecognized: Boolean(source) && Object.keys(source ?? {}).length > 0,
    };
  }

  const points = series
    .map((item) => {
      const entry = asRecord(item);
      if (!entry) return null;

      const dateKey = DATE_KEYS.find(
        (key) => typeof entry[key] === "string" && entry[key] !== "",
      );
      const countKey = COUNT_KEYS.find((key) => asCount(entry[key]) !== null);
      if (!dateKey || !countKey) return null;

      return {
        date: String(entry[dateKey]),
        count: asCount(entry[countKey]) ?? 0,
      };
    })
    .filter((point): point is TimelinePoint => point !== null);

  return { points, isUnrecognized: points.length === 0 && series.length > 0 };
}
