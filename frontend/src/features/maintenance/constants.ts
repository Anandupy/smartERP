import {
  Blocks,
  Building2,
  Globe,
  MapPin,
  Puzzle,
  type LucideIcon,
} from "@/assets/icons";
import type { StatusBadgeTone } from "@/shared/components/data-display";

import type { MaintenanceScopeType } from "./types/maintenance.dto";

/**
 * How each documented scope reads.
 *
 * `precedence` mirrors the documented resolution order (GLOBAL → ORGANIZATION →
 * BRANCH → MODULE → FEATURE, highest match wins) so the list can be sorted the
 * way the guard actually evaluates rules — which is the order an operator needs
 * to see them in to understand why one rule is overriding another.
 */
export const SCOPE_PRESENTATION: Record<
  MaintenanceScopeType,
  {
    label: string;
    icon: LucideIcon;
    precedence: number;
    /** What `scopeId` means at this level, in the user's terms. */
    target: string | null;
  }
> = {
  GLOBAL: {
    label: "Global",
    icon: Globe,
    precedence: 0,
    target: null,
  },
  ORGANIZATION: {
    label: "Organization",
    icon: Building2,
    precedence: 1,
    target: "Organization",
  },
  BRANCH: {
    label: "Campus",
    icon: MapPin,
    precedence: 2,
    target: "Campus",
  },
  MODULE: {
    label: "Module",
    icon: Blocks,
    precedence: 3,
    target: "Module name",
  },
  FEATURE: {
    label: "Feature",
    icon: Puzzle,
    precedence: 4,
    target: "Feature name",
  },
};

/** Options for the scope select, in documented precedence order. */
export const SCOPE_OPTIONS = (
  Object.keys(SCOPE_PRESENTATION) as MaintenanceScopeType[]
)
  .sort(
    (a, b) =>
      SCOPE_PRESENTATION[a].precedence - SCOPE_PRESENTATION[b].precedence,
  )
  .map((value) => ({ value, label: SCOPE_PRESENTATION[value].label }));

/** Documented: 0 is Sunday, 6 is Saturday. */
export const DAY_OF_WEEK_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

/** Filter value meaning "don't filter", since an empty select value is invalid. */
export const ALL_SCOPES = "ALL";

/** Status filter options for the rules list. Derived from `isActive`. */
export const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
] as const;

export type MaintenanceStatusFilter =
  (typeof STATUS_FILTER_OPTIONS)[number]["value"];

/** Tone for a rule's headline state. */
export function statusTone(isActive: boolean): StatusBadgeTone {
  return isActive ? "warning" : "neutral";
}
