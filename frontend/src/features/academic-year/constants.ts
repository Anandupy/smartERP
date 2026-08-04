import {
  Ban,
  CalendarCheck,
  CircleCheckBig,
  Lock,
  Power,
  type LucideIcon,
} from "@/assets/icons";
import type { StatusBadgeTone } from "@/shared/components/data-display";

import type { AcademicYearDto } from "./types/academic-year.dto";

/**
 * How the three documented flags become one label, and how each is read on its
 * own.
 *
 * The backend documents `isActive`, `isSelected` and `isLocked` as three
 * independent booleans under "States" — not as one status enum. A year can be
 * selected *and* locked at the same time, which is the normal end state of a
 * finished year that is still the branch's working year.
 */

/**
 * A single flag's value, honestly.
 *
 * `unknown` is a real outcome and not a defensive afterthought: no response
 * body is documented for any of the eight endpoints, so a flag genuinely may be
 * absent. Reading an absent flag as `false` would report a locked year as
 * editable — which is exactly the mistake that loses an audited year's data.
 */
export type FlagState = "yes" | "no" | "unknown";

export function readFlag(value: boolean | null | undefined): FlagState {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}

/**
 * The one label a year leads with.
 *
 * Precedence is by operational consequence, not by importance: **locked**
 * outranks everything because it is the flag that stops writes; **selected**
 * next, because it is the year the rest of the system is writing into; then
 * plain active/inactive.
 */
export type AcademicYearState =
  | "locked"
  | "selected"
  | "active"
  | "inactive"
  | "unknown";

export function academicYearState(year: AcademicYearDto): AcademicYearState {
  if (year.isLocked === true) return "locked";
  if (year.isSelected === true) return "selected";
  if (year.isActive === true) return "active";
  if (year.isActive === false) return "inactive";
  return "unknown";
}

export const ACADEMIC_YEAR_STATE_PRESENTATION: Record<
  AcademicYearState,
  { label: string; tone: StatusBadgeTone; icon: LucideIcon; description: string }
> = {
  locked: {
    label: "Locked",
    tone: "neutral",
    icon: Lock,
    description:
      "Finished and audited. The documentation is explicit that a locked year cannot be modified or deleted, and no endpoint unlocks one.",
  },
  selected: {
    label: "Current",
    tone: "success",
    icon: CalendarCheck,
    description:
      "The branch's current working year. Only one can be selected per branch, and it cannot be deleted while it holds that position.",
  },
  active: {
    label: "Active",
    tone: "info",
    icon: CircleCheckBig,
    description: "Valid and available for data entry.",
  },
  inactive: {
    label: "Inactive",
    tone: "neutral",
    icon: Power,
    description:
      "Not available for data entry. No documented endpoint returns a year to this state once it has been activated.",
  },
  unknown: {
    label: "Unknown",
    tone: "neutral",
    icon: Ban,
    description:
      "The backend did not report a status. No response body is documented for these endpoints.",
  },
};

/** How each individual flag reads on the detail screen. */
export const FLAG_PRESENTATION: Record<
  FlagState,
  { label: string; tone: StatusBadgeTone }
> = {
  yes: { label: "Yes", tone: "success" },
  no: { label: "No", tone: "neutral" },
  unknown: { label: "Not reported", tone: "warning" },
};

/** Filter value meaning "don't narrow on state". */
export const ANY_STATE = "ANY";

export const STATE_FILTER_OPTIONS = [
  { value: ANY_STATE, label: "All states" },
  { value: "selected", label: "Current" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "locked", label: "Locked" },
  { value: "unknown", label: "Unknown" },
] as const;

/** Rows per page in the directory. Client-side — see the module docs. */
export const DIRECTORY_PAGE_SIZE = 10;

/**
 * The audit module records academic-year events under this module name.
 *
 * From the audit documentation's event map: `academic_year.created`,
 * `academic_year.updated` and `academic_year.deleted` all map to module
 * `ACADEMIC`. Used to pin the activity trail on the dashboard and the details
 * screen.
 *
 * Note that the map documents **no event** for the three lifecycle
 * transitions — activating, selecting or locking a year produces no recorded
 * event name, so those actions will not appear in the trail.
 */
export const ACADEMIC_YEAR_AUDIT_MODULE = "ACADEMIC";
