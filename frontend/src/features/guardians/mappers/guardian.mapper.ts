import type {
  GuardianFormValues,
  GuardianMappingFormValues,
} from "../schemas/guardian.schema";
import {
  guardianFormDefaults,
  guardianMappingFormDefaults,
} from "../schemas/guardian.schema";
import type {
  ApplicantGuardianMappingDto,
  GuardianDto,
  GuardianRequest,
  MapGuardianRequest,
} from "../types/guardian.dto";

/** `""` → `null` for the documented optional strings. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Seed the form from a loaded guardian. `dob` is never known once saved. */
export function toGuardianFormValues(guardian: GuardianDto): GuardianFormValues {
  return {
    ...guardianFormDefaults(),
    firstName: guardian.firstName,
    middleName: guardian.middleName ?? "",
    lastName: guardian.lastName,
    mobilePrimary: guardian.mobilePrimary,
    mobileSecondary: guardian.mobileSecondary ?? "",
    email: guardian.email ?? "",
    occupation: guardian.occupation ?? "",
    income: guardian.income !== null ? String(guardian.income) : "",
    aadhaarNo: guardian.aadhaarNo ?? "",
    addressLine1: guardian.addressLine1 ?? "",
    addressLine2: guardian.addressLine2 ?? "",
    city: guardian.city ?? "",
    state: guardian.state ?? "",
    country: guardian.country ?? "",
    pincode: guardian.pincode ?? "",
  };
}

export function toGuardianRequest(values: GuardianFormValues): GuardianRequest {
  return {
    dob: optional(values.dob),
    firstName: values.firstName,
    middleName: optional(values.middleName),
    lastName: values.lastName,
    mobilePrimary: values.mobilePrimary,
    mobileSecondary: optional(values.mobileSecondary),
    email: optional(values.email),
    occupation: optional(values.occupation),
    income: optionalNumber(values.income),
    aadhaarNo: optional(values.aadhaarNo),
    addressLine1: optional(values.addressLine1),
    addressLine2: optional(values.addressLine2),
    city: optional(values.city),
    state: optional(values.state),
    country: optional(values.country),
    pincode: optional(values.pincode),
  };
}

export function toGuardianMappingFormValues(
  mapping: ApplicantGuardianMappingDto,
): GuardianMappingFormValues {
  return {
    ...guardianMappingFormDefaults(),
    relationTypeId: mapping.relationTypeId,
    isPrimary: mapping.isPrimary,
    isEmergencyContact: mapping.isEmergencyContact,
    isFinancialGuardian: mapping.isFinancialGuardian,
    pickupAllowed: mapping.pickupAllowed,
    priority: mapping.priority !== null ? String(mapping.priority) : "",
  };
}

export function toMapGuardianRequest(
  guardianId: string,
  values: GuardianMappingFormValues,
): MapGuardianRequest {
  return {
    guardianId,
    relationTypeId: values.relationTypeId,
    isPrimary: values.isPrimary,
    isEmergencyContact: values.isEmergencyContact,
    isFinancialGuardian: values.isFinancialGuardian,
    pickupAllowed: values.pickupAllowed,
    priority: optionalNumber(values.priority),
  };
}

/** A guardian's full name, for display. */
export function formatGuardianName(guardian: GuardianDto): string {
  return [guardian.firstName, guardian.middleName, guardian.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
}
