import type {
  AdmissionPolicyDto,
  ApplicantChecklistDto,
  ApplicantDto,
  WorkflowActionAvailability,
  WorkflowActionsDto,
} from "@/features/admissions";

/**
 * Builder for an applicant record.
 *
 * Carries the server-owned fields plus the request fields a screen actually
 * reads. Not the full 43+21 field set `docs/admission-lifecycle-module.md`
 * documents — only what the admissions screens under test consume; extend as
 * more of the module gets test coverage.
 */
export function applicantDto(
  overrides: Partial<ApplicantDto> = {},
): ApplicantDto {
  return {
    id: "applicant-1",
    organizationId: "org-1",
    branchId: "branch-1",
    academicYearId: "ay-2026",
    personId: "person-1",
    firstName: "Riya",
    middleName: null,
    lastName: "Sharma",
    dob: "2015-04-12",
    genderId: "gender-1",
    birthPlace: null,
    photoFileId: null,
    religionId: null,
    casteId: null,
    categoryId: null,
    motherTongueId: null,
    bloodGroupId: null,
    disabilityStatus: false,
    disabilityTypeId: null,
    disabilityNotes: null,
    aadhaarNo: null,
    penNo: null,
    apaarId: null,
    primaryMobile: "9876543210",
    alternateMobile: null,
    primaryEmail: null,
    currentAddressLine1: "12 MG Road",
    currentAddressLine2: null,
    city: "Mumbai",
    district: null,
    state: "MH",
    country: "IN",
    pincode: "400001",
    previousSchoolName: null,
    previousBoard: null,
    previousClass: null,
    previousPercentage: null,
    tcNumber: null,
    admissionSourceId: null,
    quotaId: null,
    programId: "program-1",
    internalRemarks: null,
    counsellorRemarks: null,
    assignedCounsellorId: null,
    transportRequired: null,
    hostelRequired: null,
    customFieldData: null,
    checklistStatus: null,
    tags: null,
    formTemplateVersion: null,
    admissionFormNo: "ADM-2026-0001",
    applicationNo: "APP-2026-0001",
    displayName: "Riya Sharma",
    admissionStatus: "SEAT_CONFIRMED",
    submittedAt: "2026-01-10T00:00:00.000Z",
    approvedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    createdBy: null,
    updatedBy: null,
    approvedBy: null,
    rejectedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-10T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

/** `GET /admissions/workflow/policy` — the STANDARD default unless overridden. */
export function admissionPolicyDto(
  overrides: Partial<AdmissionPolicyDto> = {},
): AdmissionPolicyDto {
  return {
    workflowProfile: "STANDARD_ADMISSION",
    offerValidityDays: 15,
    allowDeferment: false,
    waitlistEnabled: true,
    feeStepEnabled: true,
    documentRequestEnabled: true,
    sources: {
      workflowProfile: "DEFAULT",
      offerValidityDays: "DEFAULT",
      allowDeferment: "DEFAULT",
      waitlistEnabled: "DEFAULT",
      feeStepEnabled: "DEFAULT",
      documentRequestEnabled: "DEFAULT",
    },
    asOf: "2026-10-17T00:00:00.000Z",
    ...overrides,
  };
}

/** One action as `GET .../workflow/actions` reports it: permitted and unblocked by default. */
export function workflowActionDto(
  action: WorkflowActionAvailability["action"],
  overrides: Partial<WorkflowActionAvailability> = {},
): WorkflowActionAvailability {
  return {
    action,
    to: "UNDER_REVIEW",
    remarks: "OPTIONAL",
    permitted: true,
    blockedBy: [],
    available: true,
    via: action === "admit" ? "ADMIT" : "TRANSITION",
    ...overrides,
  };
}

/** `GET .../workflow/actions`. */
export function workflowActionsDto(
  overrides: Partial<WorkflowActionsDto> = {},
): WorkflowActionsDto {
  return {
    applicantId: "applicant-1",
    status: "SEAT_CONFIRMED",
    profile: "STANDARD_ADMISSION",
    policyAsOf: "2026-01-10T00:00:00.000Z",
    actions: [],
    directAdmission: {
      offered: false,
      fromCurrentState: false,
      permitted: true,
      available: false,
    },
    ...overrides,
  };
}

/** `GET .../checklist`. */
export function applicantChecklistDto(
  overrides: Partial<ApplicantChecklistDto> = {},
): ApplicantChecklistDto {
  return {
    applicantId: "applicant-1",
    status: "DRAFT",
    items: [],
    outstandingMandatory: 0,
    ...overrides,
  };
}
