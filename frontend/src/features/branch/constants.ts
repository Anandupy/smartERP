import {
  Ban,
  Blocks,
  Building2,
  CircleCheckBig,
  GraduationCap,
  Landmark,
  Power,
  School,
  Trash2,
  type LucideIcon,
} from "@/assets/icons";
import type { StatusBadgeTone } from "@/shared/components/data-display";

import type {
  AffiliationType,
  BranchDto,
  InstitutionType,
  StructureMode,
} from "./types/branch.dto";

/** How each documented institution type reads. */
export const INSTITUTION_TYPE_PRESENTATION: Record<
  InstitutionType,
  { label: string; icon: LucideIcon }
> = {
  SCHOOL: { label: "School", icon: School },
  JUNIOR_COLLEGE: { label: "Junior college", icon: GraduationCap },
  DEGREE_COLLEGE: { label: "Degree college", icon: GraduationCap },
  UNIVERSITY: { label: "University", icon: Landmark },
  ENGINEERING: { label: "Engineering", icon: Blocks },
  MEDICAL: { label: "Medical", icon: Building2 },
  OTHER: { label: "Other", icon: Building2 },
};

export const INSTITUTION_TYPE_OPTIONS = (
  Object.keys(INSTITUTION_TYPE_PRESENTATION) as InstitutionType[]
).map((value) => ({
  value,
  label: INSTITUTION_TYPE_PRESENTATION[value].label,
}));

/** How each documented affiliation type reads. */
export const AFFILIATION_TYPE_LABELS: Record<AffiliationType, string> = {
  BOARD: "Board",
  UNIVERSITY: "University",
  OTHER: "Other",
};

/** Documented structure modes, with the explanation each document gives. */
export const STRUCTURE_MODE_PRESENTATION: Record<
  StructureMode,
  { label: string; description: string }
> = {
  DEFAULT: {
    label: "Default",
    description: "The standard organizational structure provided by the ERP.",
  },
  CUSTOM: {
    label: "Custom",
    description:
      "Programs, batches and sections are defined manually by the Program module.",
  },
};

export const STRUCTURE_MODE_OPTIONS = (
  Object.keys(STRUCTURE_MODE_PRESENTATION) as StructureMode[]
).map((value) => ({
  value,
  label: STRUCTURE_MODE_PRESENTATION[value].label,
}));

/**
 * A branch's operating state, derived from the two documented booleans.
 *
 * `unknown` is a real outcome, not a defensive afterthought: no response body
 * is documented, so `isActive` genuinely may not be returned, and an absent
 * flag must never be read as `false` — that would show a working branch as
 * inactive.
 */
export type BranchState = "active" | "inactive" | "deleted" | "unknown";

export function branchState(branch: BranchDto): BranchState {
  if (branch.isDeleted === true) return "deleted";
  if (branch.isActive === true) return "active";
  if (branch.isActive === false) return "inactive";
  return "unknown";
}

export const BRANCH_STATE_PRESENTATION: Record<
  BranchState,
  {
    label: string;
    tone: StatusBadgeTone;
    icon: LucideIcon;
    description: string;
  }
> = {
  active: {
    label: "Active",
    tone: "success",
    icon: CircleCheckBig,
    description: "Operating normally and available for admissions and payroll.",
  },
  inactive: {
    label: "Inactive",
    tone: "neutral",
    icon: Power,
    description:
      "Temporarily suspended. The record is retained and can be reactivated.",
  },
  deleted: {
    label: "Deleted",
    tone: "danger",
    icon: Trash2,
    description:
      "Soft-deleted. The record is retained — the documentation is explicit that nothing is removed.",
  },
  unknown: {
    label: "Unknown",
    tone: "neutral",
    icon: Ban,
    description:
      "The backend did not report a status. No response body is documented for this endpoint.",
  },
};

/** Filter value meaning "don't narrow on state". */
export const ANY_STATE = "ANY";

export const STATE_FILTER_OPTIONS = [
  { value: ANY_STATE, label: "All states" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "deleted", label: "Deleted" },
] as const;

/** Filter value meaning "don't narrow on institution type". */
export const ANY_TYPE = "ANY";

/** Rows per page in the directory. Client-side — the endpoint takes no params. */
export const DIRECTORY_PAGE_SIZE = 10;

/**
 * The audit module records branch events under this module name — see the
 * audit documentation's event map (`branch.created`, `branch.updated`,
 * `branch.deleted` → module `ORGANIZATION`). Used to pin the activity trail on
 * the details screen and the settings audit history.
 */
export const BRANCH_AUDIT_MODULE = "ORGANIZATION";
