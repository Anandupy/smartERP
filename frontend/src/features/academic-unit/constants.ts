import { Ban, CircleCheckBig, Power, type LucideIcon } from "@/assets/icons";
import type { StatusBadgeTone } from "@/shared/components/data-display";

import {
  ACADEMIC_UNIT_TYPES,
  type AcademicUnitDto,
} from "./types/academic-unit.dto";

/**
 * An academic unit's operating state, derived from the one documented flag.
 *
 * `unknown` is a real outcome: no response body is documented, so `isActive`
 * genuinely may be absent. It matters more here than elsewhere, because the
 * doc's delete rule turns on whether a *child* is active — reading an absent
 * flag as `false` would let the UI offer a delete the server is going to
 * refuse, and reading it as `true` would block a delete that would have worked.
 * Neither guess is made; `unknown` is carried through to the UI.
 */
export type AcademicUnitState = "active" | "inactive" | "unknown";

export function academicUnitState(unit: AcademicUnitDto): AcademicUnitState {
  if (unit.isActive === true) return "active";
  if (unit.isActive === false) return "inactive";
  return "unknown";
}

export const UNIT_STATE_PRESENTATION: Record<
  AcademicUnitState,
  { label: string; tone: StatusBadgeTone; icon: LucideIcon; description: string }
> = {
  active: {
    label: "Active",
    tone: "success",
    icon: CircleCheckBig,
    description: "In use for this academic year.",
  },
  inactive: {
    label: "Inactive",
    tone: "neutral",
    icon: Power,
    description:
      "Not in use. The record is retained and the toggle restores it.",
  },
  unknown: {
    label: "Unknown",
    tone: "neutral",
    icon: Ban,
    description:
      "The backend did not report a status. No response body is documented for these endpoints.",
  },
};

/** Filter value meaning "don't narrow on state". */
export const ANY_STATE = "ANY";

export const STATE_FILTER_OPTIONS = [
  { value: ANY_STATE, label: "All states" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "unknown", label: "Unknown" },
] as const;

/** Filter value meaning "don't narrow on unit type". */
export const ANY_TYPE = "ANY";

/**
 * The unit-type choices, in the order the backend declares them.
 *
 * The label is title case for reading; the value is the enum constant and is
 * what the request body carries, unchanged. The constant is repeated as the
 * option's hint so the picker still shows the value that will be sent — the
 * detail screens, the table and the directory filter all display the raw
 * constant, and a user should be able to connect the two.
 */
export const ACADEMIC_UNIT_TYPE_OPTIONS = ACADEMIC_UNIT_TYPES.map((value) => ({
  value,
  label: value.charAt(0) + value.slice(1).toLowerCase(),
  hint: value,
}));

/** Filter value meaning "don't narrow on program". */
export const ANY_PROGRAM = "ANY";

/** Sentinel for "no parent", since a select cannot hold an empty value. */
export const NO_PARENT = "NONE";

/** Rows per page in the directory. Client-side — see the module docs. */
export const DIRECTORY_PAGE_SIZE = 15;

/**
 * The audit module records academic-unit events under this module name.
 *
 * From the audit documentation's event map: `academic_unit.created`,
 * `academic_unit.updated` and `academic_unit.deleted` all map to module
 * `ACADEMIC`.
 *
 * The map documents **no event for the move or status endpoints**, so
 * re-parenting or deactivating a unit will not appear in the trail.
 */
export const ACADEMIC_UNIT_AUDIT_MODULE = "ACADEMIC";
