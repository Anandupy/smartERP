import { z } from "zod";

import { emailSchema, nonEmptyString } from "@/schemas";

import {
  AFFILIATION_TYPES,
  INSTITUTION_TYPES,
  STRUCTURE_MODES,
} from "../types/branch.dto";

/**
 * Form schema for creating and editing a branch.
 *
 * The backend documents three enums and exactly two format rules: `code` is
 * "unique slug-safe lowercase", and `registrationNumber` is "unique across the
 * system if provided". Both uniqueness rules are **server** concerns — they
 * need the whole table, and the list endpoint returns active branches only, so
 * a client check would pass for a code already held by an inactive one.
 *
 * Nothing else is asserted. No lengths, no phone or pincode patterns, no
 * affiliation vocabulary — the documents state none, and the first legitimate
 * value an invented rule rejected would be a bug with no backend to blame.
 *
 * Optionality follows the documents where they are explicit (`logoUrl` is
 * "Optional"; `registrationNumber` is qualified "if provided") and follows the
 * softer wording where they are not: affiliation is described as something
 * branches "can be" — so it is optional, and `affiliationName` is required only
 * once a type has been chosen, since a name without a type describes nothing.
 */

/** The documented format rule for `code`. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Sentinel for "no affiliation", since a select cannot hold an empty value. */
export const NO_AFFILIATION = "NONE";

export const branchFormSchema = z
  .object({
    organizationId: nonEmptyString,
    name: nonEmptyString,
    code: z
      .string()
      .trim()
      .min(1, "Required")
      .regex(SLUG, "Lowercase letters, numbers and single hyphens only"),
    /** Documented optional, and unique when set. */
    registrationNumber: z.string().trim(),
    institutionType: z.enum(INSTITUTION_TYPES),
    /** `NONE` means the branch declares no affiliation. */
    affiliationType: z.union([
      z.enum(AFFILIATION_TYPES),
      z.literal(NO_AFFILIATION),
    ]),
    affiliationName: z.string().trim(),
    logoUrl: z.string().trim(),
    contactEmail: emailSchema,
    contactPhone: nonEmptyString,
    addressLine1: nonEmptyString,
    addressLine2: z.string().trim(),
    city: nonEmptyString,
    state: nonEmptyString,
    country: nonEmptyString,
    pincode: nonEmptyString,
    structureMode: z.enum(STRUCTURE_MODES),
  })
  .superRefine((values, ctx) => {
    if (
      values.affiliationType !== NO_AFFILIATION &&
      values.affiliationName.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["affiliationName"],
        message: "Name the affiliating body",
      });
    }
  });

export type BranchFormValues = z.infer<typeof branchFormSchema>;

/**
 * A blank branch.
 *
 * `structureMode` starts at `DEFAULT`, which the documentation describes as the
 * ERP's standard structure — the backend's own default rather than a
 * preference invented here. `organizationId` is seeded by the caller from the
 * active workspace; nothing else is pre-filled, since seeding `country` from
 * the Postman sample would put "India" into a real institution's record.
 */
export function branchFormDefaults(organizationId = ""): BranchFormValues {
  return {
    organizationId,
    name: "",
    code: "",
    registrationNumber: "",
    institutionType: "SCHOOL",
    affiliationType: NO_AFFILIATION,
    affiliationName: "",
    logoUrl: "",
    contactEmail: "",
    contactPhone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
    structureMode: "DEFAULT",
  };
}
