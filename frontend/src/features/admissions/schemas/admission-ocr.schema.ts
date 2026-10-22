import { z } from "zod";

/**
 * What the admission-form OCR reads off a filled paper form.
 *
 * Shared by the `/api/admissions/ocr` route (as the model's structured-output
 * schema) and the uploader (as the response type). Every field is a plain
 * string — `""` when the form leaves it blank or the handwriting cannot be
 * read — so a misread never invents a value.
 *
 * Fields that the applicant form stores as admission-master ids (gender,
 * religion, …) come back as the printed/ticked *label*; the route composition
 * resolves labels to the branch's own master records, since only it may see
 * Admission Masters (AGENTS.md §28).
 */
export const admissionOcrSchema = z.object({
  student: z.object({
    firstName: z.string(),
    middleName: z.string(),
    lastName: z.string(),
    dob: z.string().describe("Date of birth as YYYY-MM-DD, or empty"),
    birthPlace: z.string(),
    aadhaarNo: z.string(),
    penNo: z.string(),
    apaarId: z.string(),
    disabilityStatus: z.boolean(),
    disabilityNotes: z.string(),
  }),
  contact: z.object({
    primaryMobile: z.string(),
    alternateMobile: z.string(),
    primaryEmail: z.string(),
  }),
  address: z.object({
    currentAddressLine1: z.string(),
    currentAddressLine2: z.string(),
    city: z.string(),
    district: z.string(),
    state: z.string(),
    country: z.string(),
    pincode: z.string(),
  }),
  previousEducation: z.object({
    previousSchoolName: z.string(),
    previousBoard: z.string(),
    previousClass: z.string(),
    previousPercentage: z.string(),
    tcNumber: z.string(),
  }),
  facilities: z.object({
    transportRequired: z.boolean(),
    hostelRequired: z.boolean(),
  }),
  /** Labels for the master-backed pickers — resolved to ids at the route. */
  masterLabels: z.object({
    gender: z.string(),
    religion: z.string(),
    caste: z.string(),
    category: z.string(),
    motherTongue: z.string(),
    bloodGroup: z.string(),
    disabilityType: z.string(),
    classAppliedFor: z.string(),
  }),
  /** Not part of the applicant form — shown so the clerk can add guardians next. */
  parents: z.object({
    fatherName: z.string(),
    fatherMobile: z.string(),
    motherName: z.string(),
    motherMobile: z.string(),
  }),
  /** Field names the model could not read with confidence. */
  uncertainFields: z.array(z.string()),
});

export type AdmissionOcrResult = z.infer<typeof admissionOcrSchema>;

export type AdmissionOcrMasterLabels = AdmissionOcrResult["masterLabels"];

export interface AdmissionOcrResponse {
  result: AdmissionOcrResult;
}
