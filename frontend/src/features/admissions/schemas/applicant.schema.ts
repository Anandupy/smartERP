import { z } from "zod";

import { nonEmptyString, optionalAadhaarSchema } from "@/schemas";

/**
 * Form schema for the Applicant Information step ("New Admission").
 *
 * Fields are exactly the 43 the Postman collection documents for
 * `POST /admissions/applicants` — no more (`docs/admission-lifecycle-module.md`
 * §3.2). The design brief's "previous education" section is deliberately
 * limited to the documented fields (`previousSchoolName`, `previousBoard`,
 * `previousClass`, `previousPercentage`, `tcNumber`) — no `rank` or
 * `transferCertificate` field exists in the contract.
 *
 * Required-ness follows the DTO: fields typed non-nullable on `ApplicantDto`
 * (`firstName`, `lastName`, `dob`, `primaryMobile`, the address line/city/
 * state/country/pincode, `programId`) are required here; everything else is
 * optional, since no field-level validation beyond presence is documented
 * anywhere in this module (matching the branch/academic-year precedent: no
 * length, format or pattern is invented for a rule the backend has not
 * stated).
 *
 * `disabilityStatus`, `transportRequired` and `hostelRequired` are real
 * booleans on the wire but collected here as checkboxes, not the "" → null
 * string sentinel the rest of the form uses.
 */
export const applicantFormSchema = z.object({
  // Basic information
  firstName: nonEmptyString,
  middleName: z.string().trim(),
  lastName: nonEmptyString,
  dob: nonEmptyString,
  genderId: z.string(),
  birthPlace: z.string().trim(),
  religionId: z.string(),
  casteId: z.string(),
  categoryId: z.string(),
  motherTongueId: z.string(),
  bloodGroupId: z.string(),
  disabilityStatus: z.boolean(),
  disabilityTypeId: z.string(),
  disabilityNotes: z.string().trim(),
  aadhaarNo: optionalAadhaarSchema,
  penNo: z.string().trim(),
  apaarId: z.string().trim(),

  // Contact
  primaryMobile: nonEmptyString,
  alternateMobile: z.string().trim(),
  primaryEmail: z.string().trim(),

  // Address — the applicant's own declared, frozen snapshot.
  currentAddressLine1: nonEmptyString,
  currentAddressLine2: z.string().trim(),
  city: nonEmptyString,
  district: z.string().trim(),
  state: nonEmptyString,
  country: nonEmptyString,
  pincode: nonEmptyString,

  // Previous education
  previousSchoolName: z.string().trim(),
  previousBoard: z.string().trim(),
  previousClass: z.string().trim(),
  previousPercentage: z.string().trim(),
  tcNumber: z.string().trim(),

  // Application context
  admissionSourceId: z.string(),
  quotaId: z.string(),
  programId: nonEmptyString,

  // Operational
  internalRemarks: z.string().trim(),
  counsellorRemarks: z.string().trim(),
  transportRequired: z.boolean(),
  hostelRequired: z.boolean(),
});

export type ApplicantFormValues = z.infer<typeof applicantFormSchema>;

/** A blank applicant. */
export function applicantFormDefaults(
  programId = "",
): ApplicantFormValues {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    dob: "",
    genderId: "",
    birthPlace: "",
    religionId: "",
    casteId: "",
    categoryId: "",
    motherTongueId: "",
    bloodGroupId: "",
    disabilityStatus: false,
    disabilityTypeId: "",
    disabilityNotes: "",
    aadhaarNo: "",
    penNo: "",
    apaarId: "",
    primaryMobile: "",
    alternateMobile: "",
    primaryEmail: "",
    currentAddressLine1: "",
    currentAddressLine2: "",
    city: "",
    district: "",
    state: "",
    country: "",
    pincode: "",
    previousSchoolName: "",
    previousBoard: "",
    previousClass: "",
    previousPercentage: "",
    tcNumber: "",
    admissionSourceId: "",
    quotaId: "",
    programId,
    internalRemarks: "",
    counsellorRemarks: "",
    transportRequired: false,
    hostelRequired: false,
  };
}
