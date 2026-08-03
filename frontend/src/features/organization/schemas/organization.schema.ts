import { z } from "zod";

import { emailSchema, nonEmptyString } from "@/schemas";
import { resolveLocalTimezone } from "@/utils";

/**
 * Form schema for creating and editing an organization.
 *
 * The backend documents field **types**, one enum it does not accept from
 * clients (`status`), and exactly one format rule: `code` is a "unique
 * slug-safe lowercase" string. That rule is asserted here because it is
 * documented. Nothing else is: no lengths, no phone or pincode patterns, no
 * currency or timezone vocabulary — so nothing else is asserted, and the first
 * legitimate value an invented rule rejected would be a bug with no backend to
 * blame.
 *
 * Server-side rules still reach the user: a rejected write returns an
 * `ApiError` with `fieldErrors`, which `applyServerFieldErrors` binds to the
 * offending field.
 *
 * Uniqueness of `code` is a server concern — it needs the whole table, and the
 * list endpoint only returns active organizations, so a client-side check
 * would pass for a code already taken by an inactive one.
 */

/** The one documented format rule: lowercase, slug-safe. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const organizationFormSchema = z.object({
  name: nonEmptyString,
  code: z
    .string()
    .trim()
    .min(1, "Required")
    .regex(SLUG, "Lowercase letters, numbers and single hyphens only"),
  /** Documented optional. No format is documented, so none is asserted. */
  logoUrl: z.string().trim(),
  contactEmail: emailSchema,
  contactPhone: nonEmptyString,
  /**
   * A `date` input value (`YYYY-MM-DD`), which is the shape the Postman sample
   * sends. The documentation types the field `DateTime`; see the mapper for
   * why the sample wins.
   */
  masterExpiryDate: z.string().trim().min(1, "Required"),
  addressLine1: nonEmptyString,
  /** The address table lists Line2 without marking it required. */
  addressLine2: z.string().trim(),
  city: nonEmptyString,
  state: nonEmptyString,
  country: nonEmptyString,
  pincode: nonEmptyString,
  timezone: nonEmptyString,
  currency: nonEmptyString,
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

/**
 * A blank organization.
 *
 * `timezone` defaults to the operator's own zone rather than a hard-coded one.
 * Nothing else is pre-filled: seeding `currency` or `country` with the Postman
 * sample would put "INR" and "India" into a real institution's record by
 * default.
 */
export function organizationFormDefaults(): OrganizationFormValues {
  return {
    name: "",
    code: "",
    logoUrl: "",
    contactEmail: "",
    contactPhone: "",
    masterExpiryDate: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
    timezone: resolveLocalTimezone(),
    currency: "",
  };
}
