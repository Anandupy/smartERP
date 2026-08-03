import type { OrganizationFormValues } from "../schemas/organization.schema";
import { resolveLocalTimezone } from "@/utils";

import { organizationFormDefaults } from "../schemas/organization.schema";
import type {
  CreateOrganizationRequest,
  OrganizationDto,
} from "../types/organization.dto";

/**
 * The only translation between the organization form and the wire.
 *
 * Two conventions, both the same ones System Settings and Maintenance follow:
 *
 * - **Empty means `null`, not `""`.** The two optional fields (`logoUrl`,
 *   `addressLine2`) are sent as `null` when blank, so clearing one clears it
 *   rather than storing an empty string.
 * - **The body is always complete.** The Postman update request sends every
 *   field and the documentation states no partial-update rule, so an edit
 *   resends the whole record.
 *
 * `status` is never sent. It is a documented field of the entity and *not* a
 * documented field of either request body, which makes it server-managed.
 */

/** `""` → `null` for the documented optional fields. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalize whatever the backend returns for `masterExpiryDate` to the
 * `YYYY-MM-DD` a `date` input accepts.
 *
 * The documentation types the field `DateTime` while the Postman sample sends
 * `"2030-12-31"`, so a full ISO timestamp coming back is entirely possible.
 * Taking the first ten characters of an ISO string handles both, and anything
 * unparseable degrades to an empty field rather than to `"Invalid Date"`.
 */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";

  const direct = /^\d{4}-\d{2}-\d{2}/.exec(value);
  if (direct) return direct[0];

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

/** Seed the form from a loaded organization. */
export function toOrganizationFormValues(
  organization: OrganizationDto,
): OrganizationFormValues {
  return {
    ...organizationFormDefaults(),
    name: organization.name,
    code: organization.code,
    logoUrl: organization.logoUrl ?? "",
    contactEmail: organization.contactEmail,
    contactPhone: organization.contactPhone,
    masterExpiryDate: toDateInput(organization.masterExpiryDate),
    addressLine1: organization.addressLine1,
    addressLine2: organization.addressLine2 ?? "",
    city: organization.city,
    state: organization.state,
    country: organization.country,
    pincode: organization.pincode,
    timezone: organization.timezone || resolveLocalTimezone(),
    currency: organization.currency,
  };
}

/**
 * Form values → the complete documented request body.
 *
 * Used for both create and update: Postman defines the two bodies identically.
 * The `masterExpiryDate` is sent exactly as the date input produced it, which
 * is the shape the recorded sample uses.
 */
export function toOrganizationRequest(
  values: OrganizationFormValues,
): CreateOrganizationRequest {
  return {
    name: values.name,
    code: values.code,
    logoUrl: optional(values.logoUrl),
    contactEmail: values.contactEmail,
    contactPhone: values.contactPhone,
    masterExpiryDate: values.masterExpiryDate,
    addressLine1: values.addressLine1,
    addressLine2: optional(values.addressLine2),
    city: values.city,
    state: values.state,
    country: values.country,
    pincode: values.pincode,
    timezone: values.timezone,
    currency: values.currency,
  };
}

/** The address, as one readable block. Skips the lines that are not set. */
export function formatAddress(organization: OrganizationDto): string {
  return [
    organization.addressLine1,
    organization.addressLine2,
    organization.city,
    organization.state,
    organization.country,
    organization.pincode,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}
