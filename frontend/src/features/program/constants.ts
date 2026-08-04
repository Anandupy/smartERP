import { Ban, CircleCheckBig, Power, type LucideIcon } from "@/assets/icons";
import type { StatusBadgeTone } from "@/shared/components/data-display";

import type { ProgramDto } from "./types/program.dto";

/**
 * A program's operating state, derived from the one documented flag.
 *
 * `unknown` is a real outcome, not a defensive afterthought: no response body
 * is documented, so `isActive` genuinely may be absent, and reading an absent
 * flag as `false` would show a running programme as suspended — and would also
 * make the status toggle unsafe, since it flips rather than sets.
 */
export type ProgramState = "active" | "inactive" | "unknown";

export function programState(program: ProgramDto): ProgramState {
  if (program.isActive === true) return "active";
  if (program.isActive === false) return "inactive";
  return "unknown";
}

export const PROGRAM_STATE_PRESENTATION: Record<
  ProgramState,
  { label: string; tone: StatusBadgeTone; icon: LucideIcon; description: string }
> = {
  active: {
    label: "Active",
    tone: "success",
    icon: CircleCheckBig,
    description: "Available for academic units, enrolment and curriculum.",
  },
  inactive: {
    label: "Inactive",
    tone: "neutral",
    icon: Power,
    description:
      "Suspended. The record is retained and the toggle restores it.",
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

/** Filter value meaning "don't narrow on level". */
export const ANY_LEVEL = "ANY";

/** Sentinel for "no parent", since a select cannot hold an empty value. */
export const NO_PARENT = "NONE";

/** Rows per page in the directory. Client-side — see the module docs. */
export const DIRECTORY_PAGE_SIZE = 10;

/**
 * The audit module records program events under this module name.
 *
 * The audit event map documents `ACADEMIC` for `academic_year.*` and
 * `academic_unit.*`. **No `program.*` event is documented at all**, so the
 * trail pinned here is the academic module's, and may contain nothing from this
 * one — which the screens say rather than implying an empty trail means no
 * activity.
 */
export const PROGRAM_AUDIT_MODULE = "ACADEMIC";
