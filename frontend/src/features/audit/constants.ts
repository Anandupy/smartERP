import type { StatusBadgeTone } from "@/shared/components/data-display";

import { AUDIT_ACTIONS, AUDIT_MODULES } from "./types/audit.dto";

/** Filter value meaning "don't narrow on this field". */
export const ANY = "ANY";

/**
 * Tone per documented action.
 *
 * Only the five documented actions are mapped. An action outside the list —
 * which the contract permits, since `action` is typed as a plain string —
 * falls back to neutral rather than being coloured by a guess.
 */
const ACTION_TONE: Record<string, StatusBadgeTone> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "danger",
  LOGIN: "brand",
  EXECUTE: "warning",
};

export function actionTone(action: string): StatusBadgeTone {
  return ACTION_TONE[action.toUpperCase()] ?? "neutral";
}

/** Options for the action filter, from the documented vocabulary. */
export const ACTION_OPTIONS = [
  { value: ANY, label: "All actions" },
  ...AUDIT_ACTIONS.map((action) => ({ value: action, label: action })),
];

/** Options for the module filter, from the documented vocabulary. */
export const MODULE_OPTIONS = [
  { value: ANY, label: "All modules" },
  ...AUDIT_MODULES.map((module) => ({
    value: module,
    label: module.charAt(0) + module.slice(1).toLowerCase(),
  })),
];

/** Sort options, using the documented `sortBy` values. */
export const SORT_OPTIONS = [
  { value: "timestamp", label: "Time" },
  { value: "module", label: "Module" },
  { value: "severity", label: "Severity" },
  { value: "executionTime", label: "Duration" },
] as const;

/**
 * Preset ranges for the date filter.
 *
 * Offsets are computed from "now" at selection time and sent as the documented
 * ISO `startDate`/`endDate`. `null` days means no bound at all — not a very
 * large window, which would quietly exclude anything older.
 */
export const DATE_PRESETS = [
  { value: "ALL", label: "All time", days: null },
  { value: "24H", label: "Last 24 hours", days: 1 },
  { value: "7D", label: "Last 7 days", days: 7 },
  { value: "30D", label: "Last 30 days", days: 30 },
  { value: "90D", label: "Last 90 days", days: 90 },
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number]["value"];
