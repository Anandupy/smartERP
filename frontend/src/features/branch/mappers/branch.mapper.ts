import type { BranchFormValues } from "../schemas/branch.schema";
import { NO_AFFILIATION, branchFormDefaults } from "../schemas/branch.schema";
import type {
  AffiliationType,
  BranchDto,
  CreateBranchRequest,
} from "../types/branch.dto";

/**
 * The only translation between the branch form and the wire.
 *
 * The same two conventions the other modules follow:
 *
 * - **Empty means `null`, not `""`.** Every documented optional the form leaves
 *   blank is sent as `null`, so clearing a field clears it rather than storing
 *   an empty string.
 * - **The body is always complete.** The Postman update request sends all
 *   seventeen fields and no partial-update rule is documented, so an edit
 *   resends the whole record.
 *
 * `isActive` and `isDeleted` are never sent. Both are documented fields of the
 * entity and of neither request body: the first changes only through the status
 * toggle, the second only through the soft delete.
 */

/** `""` → `null` for the documented optional strings. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Seed the form from a loaded branch. */
export function toBranchFormValues(branch: BranchDto): BranchFormValues {
  return {
    ...branchFormDefaults(branch.organizationId),
    name: branch.name,
    code: branch.code,
    registrationNumber: branch.registrationNumber ?? "",
    institutionType: branch.institutionType ?? "SCHOOL",
    affiliationType: branch.affiliationType ?? NO_AFFILIATION,
    affiliationName: branch.affiliationName ?? "",
    logoUrl: branch.logoUrl ?? "",
    contactEmail: branch.contactEmail,
    contactPhone: branch.contactPhone,
    addressLine1: branch.addressLine1,
    addressLine2: branch.addressLine2 ?? "",
    city: branch.city,
    state: branch.state,
    country: branch.country,
    pincode: branch.pincode,
    structureMode: branch.structureMode ?? "DEFAULT",
  };
}

/**
 * Form values → the complete documented request body.
 *
 * Used for both create and update: Postman defines the two bodies identically.
 * Choosing "no affiliation" sends `null` for **both** affiliation fields — a
 * name without a type describes nothing, so the pair is cleared together.
 */
export function toBranchRequest(values: BranchFormValues): CreateBranchRequest {
  const hasAffiliation = values.affiliationType !== NO_AFFILIATION;

  return {
    organizationId: values.organizationId,
    name: values.name,
    code: values.code,
    registrationNumber: optional(values.registrationNumber),
    institutionType: values.institutionType,
    affiliationType: hasAffiliation
      ? (values.affiliationType as AffiliationType)
      : null,
    affiliationName: hasAffiliation ? optional(values.affiliationName) : null,
    logoUrl: optional(values.logoUrl),
    contactEmail: values.contactEmail,
    contactPhone: values.contactPhone,
    addressLine1: values.addressLine1,
    addressLine2: optional(values.addressLine2),
    city: values.city,
    state: values.state,
    country: values.country,
    pincode: values.pincode,
    structureMode: values.structureMode,
  };
}

/** The address, as one readable block. Skips the lines that are not set. */
export function formatBranchAddress(branch: BranchDto): string {
  return [
    branch.addressLine1,
    branch.addressLine2,
    branch.city,
    branch.state,
    branch.country,
    branch.pincode,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

/** The affiliation, as one line, or `null` when the branch declares none. */
export function formatAffiliation(branch: BranchDto): string | null {
  if (!branch.affiliationType && !branch.affiliationName) return null;

  return [branch.affiliationName, branch.affiliationType]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
