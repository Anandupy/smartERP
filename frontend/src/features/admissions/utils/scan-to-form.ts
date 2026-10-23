import type {
  AdmissionOcrMasterLabels,
  AdmissionOcrResult,
} from "../schemas/admission-ocr.schema";
import {
  applicantFormDefaults,
  applicantFormSchema,
  type ApplicantFormValues,
} from "../schemas/applicant.schema";

/**
 * Resolves the labels read off the paper form ("Female", "Hindu", "Std 1")
 * to this branch's admission-master and program ids. Supplied by the route
 * composition — Admissions cannot see Admission Masters or Program itself
 * (AGENTS.md §28). `unmatched` lists the labels no record matched.
 */
export type ResolveOcrMasters = (labels: AdmissionOcrMasterLabels) => {
  values: Partial<ApplicantFormValues>;
  unmatched: string[];
  /** Fields filled with a fallback default because the label matched nothing. */
  defaulted?: string[];
};

/**
 * The applicant-form fields a scan actually read: blanks and `false` are left
 * out, so applying the patch never clears what a clerk already typed.
 */
export function scanFormPatch(
  result: AdmissionOcrResult,
  resolveMasters?: ResolveOcrMasters,
): {
  patch: Partial<ApplicantFormValues>;
  unmatched: string[];
  defaulted: string[];
} {
  const resolved = resolveMasters?.(result.masterLabels) ?? {
    values: {},
    unmatched: [],
  };
  const all: Partial<ApplicantFormValues> = {
    ...result.student,
    ...result.contact,
    ...result.address,
    ...result.previousEducation,
    ...result.facilities,
    ...resolved.values,
  };
  const patch = Object.fromEntries(
    Object.entries(all).filter(
      ([, value]) => value !== "" && value !== false && value !== undefined,
    ),
  ) as Partial<ApplicantFormValues>;
  return {
    patch,
    unmatched: resolved.unmatched,
    defaulted: resolved.defaulted ?? [],
  };
}

/** Human names of the required applicant fields, for "missing: …" messages. */
const REQUIRED_LABELS: Partial<Record<keyof ApplicantFormValues, string>> = {
  firstName: "First name",
  lastName: "Last name",
  dob: "Date of birth",
  primaryMobile: "Primary mobile",
  currentAddressLine1: "Address",
  city: "City",
  state: "State",
  country: "Country",
  pincode: "PIN code",
  programId: "Programme",
  aadhaarNo: "Aadhaar",
};

/**
 * A complete applicant built from one scanned form, plus what still stops it
 * being saved as-is: required fields that are empty or invalid (`missing`),
 * and master fields filled with a default the clerk should confirm
 * (`defaulted`).
 */
export function applicantFromScan(
  result: AdmissionOcrResult,
  resolveMasters?: ResolveOcrMasters,
): {
  values: ApplicantFormValues;
  unmatched: string[];
  defaulted: string[];
  missing: string[];
} {
  const { patch, unmatched, defaulted } = scanFormPatch(result, resolveMasters);
  const values = { ...applicantFormDefaults(), ...patch };
  const parsed = applicantFormSchema.safeParse(values);
  const missing = parsed.success
    ? []
    : [
        ...new Set(
          parsed.error.issues.map((issue) => {
            const field = String(issue.path[0]) as keyof ApplicantFormValues;
            return REQUIRED_LABELS[field] ?? field;
          }),
        ),
      ];
  return { values, unmatched, defaulted, missing };
}
