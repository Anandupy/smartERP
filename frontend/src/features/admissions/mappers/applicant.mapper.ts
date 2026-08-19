import type { ApplicantFormValues } from "../schemas/applicant.schema";
import { applicantFormDefaults } from "../schemas/applicant.schema";
import type { ApplicantDto, ApplicantRequest } from "../types/applicant.dto";

/**
 * The only translation between the applicant form and the wire.
 *
 * Same convention as branch/academic-year/organization: **empty means
 * `null`, not `""`**, and the body is always the complete documented record
 * — no partial-update rule is documented for `PATCH /admissions/applicants/:id`.
 */

/** `""` → `null` for the documented optional strings. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** `""` → `null`, otherwise a finite number, for `previousPercentage`. */
function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Seed the form from a loaded applicant. */
export function toApplicantFormValues(
  applicant: ApplicantDto,
): ApplicantFormValues {
  return {
    ...applicantFormDefaults(applicant.programId),
    firstName: applicant.firstName,
    middleName: applicant.middleName ?? "",
    lastName: applicant.lastName,
    dob: applicant.dob.slice(0, 10),
    genderId: applicant.genderId ?? "",
    birthPlace: applicant.birthPlace ?? "",
    religionId: applicant.religionId ?? "",
    casteId: applicant.casteId ?? "",
    categoryId: applicant.categoryId ?? "",
    motherTongueId: applicant.motherTongueId ?? "",
    bloodGroupId: applicant.bloodGroupId ?? "",
    disabilityStatus: applicant.disabilityStatus ?? false,
    disabilityTypeId: applicant.disabilityTypeId ?? "",
    disabilityNotes: applicant.disabilityNotes ?? "",
    aadhaarNo: applicant.aadhaarNo ?? "",
    penNo: applicant.penNo ?? "",
    apaarId: applicant.apaarId ?? "",
    primaryMobile: applicant.primaryMobile,
    alternateMobile: applicant.alternateMobile ?? "",
    primaryEmail: applicant.primaryEmail ?? "",
    currentAddressLine1: applicant.currentAddressLine1,
    currentAddressLine2: applicant.currentAddressLine2 ?? "",
    city: applicant.city,
    district: applicant.district ?? "",
    state: applicant.state,
    country: applicant.country,
    pincode: applicant.pincode,
    previousSchoolName: applicant.previousSchoolName ?? "",
    previousBoard: applicant.previousBoard ?? "",
    previousClass: applicant.previousClass ?? "",
    previousPercentage:
      applicant.previousPercentage !== null
        ? String(applicant.previousPercentage)
        : "",
    tcNumber: applicant.tcNumber ?? "",
    admissionSourceId: applicant.admissionSourceId ?? "",
    quotaId: applicant.quotaId ?? "",
    programId: applicant.programId,
    internalRemarks: applicant.internalRemarks ?? "",
    counsellorRemarks: applicant.counsellorRemarks ?? "",
    transportRequired: applicant.transportRequired ?? false,
    hostelRequired: applicant.hostelRequired ?? false,
  };
}

/**
 * Form values → the complete documented request body, used for both create
 * and update.
 *
 * `photoFileId`, `assignedCounsellorId`, `customFieldData`, `checklistStatus`,
 * `tags` and `formTemplateVersion` are documented request fields with no
 * corresponding form control yet (no upload flow, no counsellor picker, no
 * tag input) — sent as `null` rather than guessed at.
 */
export function toApplicantRequest(
  values: ApplicantFormValues,
): ApplicantRequest {
  return {
    firstName: values.firstName,
    middleName: optional(values.middleName),
    lastName: values.lastName,
    dob: values.dob,
    genderId: optional(values.genderId),
    birthPlace: optional(values.birthPlace),
    photoFileId: null,
    religionId: optional(values.religionId),
    casteId: optional(values.casteId),
    categoryId: optional(values.categoryId),
    motherTongueId: optional(values.motherTongueId),
    bloodGroupId: optional(values.bloodGroupId),
    disabilityStatus: values.disabilityStatus,
    disabilityTypeId: values.disabilityStatus
      ? optional(values.disabilityTypeId)
      : null,
    disabilityNotes: values.disabilityStatus
      ? optional(values.disabilityNotes)
      : null,
    aadhaarNo: optional(values.aadhaarNo),
    penNo: optional(values.penNo),
    apaarId: optional(values.apaarId),
    primaryMobile: values.primaryMobile,
    alternateMobile: optional(values.alternateMobile),
    primaryEmail: optional(values.primaryEmail),
    currentAddressLine1: values.currentAddressLine1,
    currentAddressLine2: optional(values.currentAddressLine2),
    city: values.city,
    district: optional(values.district),
    state: values.state,
    country: values.country,
    pincode: values.pincode,
    previousSchoolName: optional(values.previousSchoolName),
    previousBoard: optional(values.previousBoard),
    previousClass: optional(values.previousClass),
    previousPercentage: optionalNumber(values.previousPercentage),
    tcNumber: optional(values.tcNumber),
    admissionSourceId: optional(values.admissionSourceId),
    quotaId: optional(values.quotaId),
    programId: values.programId,
    internalRemarks: optional(values.internalRemarks),
    counsellorRemarks: optional(values.counsellorRemarks),
    assignedCounsellorId: null,
    transportRequired: values.transportRequired,
    hostelRequired: values.hostelRequired,
    customFieldData: null,
    checklistStatus: null,
    tags: null,
    formTemplateVersion: null,
  };
}

/** The declared address, as one readable block. */
export function formatApplicantAddress(applicant: ApplicantDto): string {
  return [
    applicant.currentAddressLine1,
    applicant.currentAddressLine2,
    applicant.city,
    applicant.district,
    applicant.state,
    applicant.country,
    applicant.pincode,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}
