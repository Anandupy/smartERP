import type { OrganizationDto } from "../types/organization.dto";
import { ORGANIZATION_STATUSES } from "../types/organization.dto";

/**
 * The organization lifecycle, as the backend actually documents it.
 *
 * The design asks for five stages — Draft, Active, Suspended, Expired,
 * Deleted. The contract documents a `status` field with **three** values
 * (`ACTIVE`, `INACTIVE`, `SUSPENDED`) and one transition (`DELETE` marks an
 * organization `INACTIVE`). So:
 *
 * | Design stage | Backend reality                                            |
 * | ------------ | ---------------------------------------------------------- |
 * | Draft        | Does not exist. No status, no endpoint, no field.          |
 * | Active       | `ACTIVE`. Reachable — a created organization starts there. |
 * | Suspended    | `SUSPENDED` exists as a value; **no endpoint sets it**.    |
 * | Expired      | Not a status. `masterExpiryDate` is a documented *date*.   |
 * | Deleted      | Not a status. `DELETE` produces `INACTIVE` (soft delete).  |
 *
 * This module models the documented three and reports the rest as unavailable,
 * rather than inventing a state machine the backend would then have to match.
 *
 * The expiry helpers below are the one place a date is read: whether
 * `masterExpiryDate` has passed is a **fact about a documented field**, not a
 * derived status, and the UI presents it that way — never as "Expired" sitting
 * where a status belongs.
 */

export interface LifecycleStage {
  /** The documented status this stage corresponds to, if any. */
  status: (typeof ORGANIZATION_STATUSES)[number] | null;
  label: string;
  description: string;
  /** How an organization gets here, in the user's terms. */
  transition: string;
  /** False when the contract documents no way to reach or leave this stage. */
  isSupported: boolean;
}

/**
 * Every stage the design names, each stated against the contract.
 *
 * Kept in design order so the lifecycle screen can render the requested
 * narrative while being honest about which parts of it exist.
 */
export const LIFECYCLE_STAGES: readonly LifecycleStage[] = Object.freeze([
  {
    status: null,
    label: "Draft",
    description:
      "An organization configured but not yet operating. The contract has no such state.",
    transition: "No status value and no endpoint.",
    isSupported: false,
  },
  {
    status: "ACTIVE",
    label: "Active",
    description: "Operating normally. Branches and users have full access.",
    transition: "Set when the organization is created.",
    isSupported: true,
  },
  {
    status: "SUSPENDED",
    label: "Suspended",
    description: "Access withheld while the organization is under review.",
    transition:
      "The status value is documented, but no endpoint sets it — status is absent from both request bodies.",
    isSupported: false,
  },
  {
    status: null,
    label: "Expired",
    description:
      "Past its master expiry date. The date is documented; a status derived from it is not.",
    transition:
      "No endpoint and no status value. The expiry date is shown as a date, never as a status.",
    isSupported: false,
  },
  {
    status: "INACTIVE",
    label: "Deactivated",
    description:
      "Soft-deleted. The record is preserved — the documentation is explicit that nothing is removed.",
    transition: "DELETE /organizations/:id.",
    isSupported: true,
  },
]);

/** Stages the frontend can actually drive, in the order they occur. */
export const SUPPORTED_STAGES = LIFECYCLE_STAGES.filter(
  (stage) => stage.isSupported,
);

/** Whether a stage is the organization's current one. */
export function isCurrentStage(
  stage: LifecycleStage,
  organization: OrganizationDto,
): boolean {
  return stage.status !== null && stage.status === organization.status;
}

export type ExpiryState = "expired" | "expiring" | "current" | "unknown";

/** Within this many days, an expiry date is worth flagging ahead of time. */
export const EXPIRY_WARNING_DAYS = 30;

/**
 * Read `masterExpiryDate` against today.
 *
 * A fact about a documented field, deliberately not called a status: an
 * organization past its expiry date still has whatever `status` the backend
 * says it has, and this app does not overrule that. `unknown` when the date is
 * missing or unparseable, so a bad value never silently reads as "current".
 */
export function expiryState(
  masterExpiryDate: string | null | undefined,
  now: Date = new Date(),
): ExpiryState {
  if (!masterExpiryDate) return "unknown";

  const expiry = new Date(masterExpiryDate);
  if (Number.isNaN(expiry.getTime())) return "unknown";

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil(
    (expiry.getTime() - now.getTime()) / msPerDay,
  );

  if (daysRemaining < 0) return "expired";
  if (daysRemaining <= EXPIRY_WARNING_DAYS) return "expiring";
  return "current";
}

/** Whole days until expiry; negative once past. `null` when unreadable. */
export function daysUntilExpiry(
  masterExpiryDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!masterExpiryDate) return null;

  const expiry = new Date(masterExpiryDate);
  if (Number.isNaN(expiry.getTime())) return null;

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((expiry.getTime() - now.getTime()) / msPerDay);
}
