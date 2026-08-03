import {
  Ban,
  CircleCheckBig,
  Power,
  ShieldAlert,
  type LucideIcon,
} from "@/assets/icons";
import type { StatusBadgeTone } from "@/shared/components/data-display";

import type { OrganizationStatus } from "./types/organization.dto";

/** How each documented status reads, and how it is coloured. */
export const STATUS_PRESENTATION: Record<
  OrganizationStatus,
  {
    label: string;
    tone: StatusBadgeTone;
    icon: LucideIcon;
    description: string;
  }
> = {
  ACTIVE: {
    label: "Active",
    tone: "success",
    icon: CircleCheckBig,
    description: "Operating normally. Branches and users have full access.",
  },
  INACTIVE: {
    label: "Inactive",
    tone: "neutral",
    icon: Power,
    description:
      "Deactivated. The record is preserved — deactivation is a soft delete, not a removal.",
  },
  SUSPENDED: {
    label: "Suspended",
    tone: "warning",
    icon: ShieldAlert,
    description: "Access is withheld while the organization is under review.",
  },
};

/** Fallback for a status the backend adds later, so an unknown never crashes. */
export const UNKNOWN_STATUS = {
  label: "Unknown",
  tone: "neutral" as StatusBadgeTone,
  icon: Ban,
  description: "The backend reported a status this app does not recognize.",
};

export function statusPresentation(status: string | null | undefined) {
  if (!status) return UNKNOWN_STATUS;
  return (
    STATUS_PRESENTATION[status as OrganizationStatus] ?? {
      ...UNKNOWN_STATUS,
      label: status,
    }
  );
}

/** Filter value meaning "don't narrow on status". */
export const ANY_STATUS = "ANY";

export const STATUS_FILTER_OPTIONS = [
  { value: ANY_STATUS, label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
] as const;

/** Rows per page in the directory. Client-side — the endpoint takes no params. */
export const DIRECTORY_PAGE_SIZE = 10;

/**
 * The audit module records organization events under this module name — see
 * the audit documentation's event map (`organization.created`,
 * `organization.updated`, `organization.deleted` → module `ORGANIZATION`).
 * Used to pin the activity trail on the dashboard and the details screen.
 */
export const ORGANIZATION_AUDIT_MODULE = "ORGANIZATION";
