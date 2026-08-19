import { z } from "zod";

import { nonEmptyString } from "@/schemas";

/**
 * Form schema for creating/editing a guardian — the 16 fields the Postman
 * collection documents, plus the transient `dob` R4.5 added specifically so
 * a guardian can resolve identity (`docs/admission-lifecycle-module.md`
 * §5.3). `dob` is collected but never displayed back from a loaded record
 * that lacks it (the DTO itself never stores it).
 *
 * Only `firstName`, `lastName` and `mobilePrimary` are required — nothing
 * else has a documented required/optional rule beyond the DTO's own
 * nullability, so no format is invented for a rule the backend never stated.
 */
export const guardianFormSchema = z.object({
  dob: z.string().trim(),
  firstName: nonEmptyString,
  middleName: z.string().trim(),
  lastName: nonEmptyString,
  mobilePrimary: nonEmptyString,
  mobileSecondary: z.string().trim(),
  email: z.string().trim(),
  occupation: z.string().trim(),
  income: z.string().trim(),
  aadhaarNo: z.string().trim(),
  addressLine1: z.string().trim(),
  addressLine2: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim(),
  country: z.string().trim(),
  pincode: z.string().trim(),
});

export type GuardianFormValues = z.infer<typeof guardianFormSchema>;

export function guardianFormDefaults(): GuardianFormValues {
  return {
    dob: "",
    firstName: "",
    middleName: "",
    lastName: "",
    mobilePrimary: "",
    mobileSecondary: "",
    email: "",
    occupation: "",
    income: "",
    aadhaarNo: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
  };
}

/**
 * The mapping form — every field `ApplicantGuardianMapping` documents
 * (module doc §5.4): relation type, primary/emergency/financial flags,
 * pickup permission and priority.
 */
export const guardianMappingFormSchema = z.object({
  relationTypeId: nonEmptyString,
  isPrimary: z.boolean(),
  isEmergencyContact: z.boolean(),
  isFinancialGuardian: z.boolean(),
  pickupAllowed: z.boolean(),
  priority: z.string().trim(),
});

export type GuardianMappingFormValues = z.infer<
  typeof guardianMappingFormSchema
>;

export function guardianMappingFormDefaults(): GuardianMappingFormValues {
  return {
    relationTypeId: "",
    isPrimary: false,
    isEmergencyContact: false,
    isFinancialGuardian: false,
    pickupAllowed: false,
    priority: "",
  };
}
