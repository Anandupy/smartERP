import { CircleCheckBig, Power, type LucideIcon } from "@/assets/icons";
import type { StatusBadgeTone } from "@/shared/components/data-display";

import type { AdmissionMasterDto } from "./types/admission-master.dto";

/**
 * A record's status, derived from the one documented boolean.
 *
 * Unlike branch (`isActive`/`isDeleted` both optional, no documented response
 * body), the master schema documents `isActive` as always present — so there
 * is no "unknown" state here. There is also no "deleted" state to render:
 * `DELETE` is a soft delete that removes the record from every further list
 * read, so a deleted master is simply absent from the directory, not a row
 * with a status.
 */
export type AdmissionMasterState = "active" | "inactive";

export function admissionMasterState(
  master: AdmissionMasterDto,
): AdmissionMasterState {
  return master.isActive ? "active" : "inactive";
}

export const ADMISSION_MASTER_STATE_PRESENTATION: Record<
  AdmissionMasterState,
  { label: string; tone: StatusBadgeTone; icon: LucideIcon }
> = {
  active: { label: "Active", tone: "success", icon: CircleCheckBig },
  inactive: { label: "Inactive", tone: "neutral", icon: Power },
};

/** Filter value meaning "don't narrow on status". */
export const ANY_STATUS = "ANY";

export const STATUS_FILTER_OPTIONS = [
  { value: ANY_STATUS, label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

/** Rows per page in a master's directory. Client-side — the endpoint takes no paging params. */
export const DIRECTORY_PAGE_SIZE = 10;
