import { describe, expect, it } from "vitest";

import { pageKind } from "@/features/admissions/ocr/page-kind";
import type { AdmissionOcrResult } from "@/features/admissions";
import { applicantFromScan } from "@/features/admissions/utils/scan-to-form";

const page = (...texts: string[]) => ({
  tokens: texts.map((text) => ({ text })),
});

describe("pageKind", () => {
  it("recognises page 1 and page 2 of the form by their printed labels", () => {
    expect(
      pageKind(
        page("FIRST NAME *", "DATE OF BIRTH (DD-MM-YYYY) *", "MOTHER TONGUE *"),
      ),
    ).toBe("first");
    expect(
      pageKind(
        page(
          "NAME OF PREVIOUS SCHOOL / PRE-SCHOOL",
          "PROGRAMME APPLIED FOR *",
          "LEAVING TC NO.",
        ),
      ),
    ).toBe("second");
  });

  it("tolerates OCR that drops the spaces between words", () => {
    expect(pageKind(page("FIRSTNAME*", "DATEOFBIRTH(DD-MM-YYYY)*"))).toBe(
      "first",
    );
  });

  it("ignores pages that are not part of the form", () => {
    expect(
      pageKind(
        page("Birth Certificate", "Municipal Corporation of Greater Mumbai"),
      ),
    ).toBeNull();
    expect(pageKind(page())).toBeNull();
  });
});

function scan(
  overrides: Partial<AdmissionOcrResult["student"]> = {},
  uncertain: string[] = [],
): AdmissionOcrResult {
  return {
    student: {
      firstName: "Zoya",
      middleName: "Kabir",
      lastName: "Khan",
      dob: "2020-06-18",
      birthPlace: "Mumbai",
      aadhaarNo: "",
      penNo: "",
      apaarId: "",
      disabilityStatus: false,
      disabilityNotes: "",
      ...overrides,
    },
    contact: {
      primaryMobile: "9820124578",
      alternateMobile: "",
      primaryEmail: "",
    },
    address: {
      currentAddressLine1: "Flat 1102, Silver Sands",
      currentAddressLine2: "",
      city: "Mumbai",
      district: "",
      state: "Maharashtra",
      country: "India",
      pincode: "400050",
    },
    previousEducation: {
      previousSchoolName: "",
      previousBoard: "",
      previousClass: "",
      previousPercentage: "",
      tcNumber: "",
    },
    facilities: { transportRequired: false, hostelRequired: false },
    masterLabels: {
      gender: "Female",
      religion: "",
      caste: "",
      category: "",
      motherTongue: "",
      bloodGroup: "",
      disabilityType: "",
      classAppliedFor: "Class 1",
      admissionSource: "Walk-in",
    },
    parents: {
      fatherName: "",
      fatherMobile: "",
      fatherOccupation: "",
      fatherAadhaar: "",
      motherName: "",
      motherMobile: "",
      motherOccupation: "",
      motherAadhaar: "",
      annualIncome: "",
    },
    uncertainFields: uncertain,
  };
}

const resolveProgramme = () => ({
  values: { programId: "prog-1", genderId: "g-f" },
  unmatched: [],
});

describe("applicantFromScan", () => {
  it("builds a complete applicant when every required field was read", () => {
    const { values, missing, unmatched } = applicantFromScan(
      scan(),
      resolveProgramme,
    );

    expect(missing).toEqual([]);
    expect(unmatched).toEqual([]);
    expect(values).toMatchObject({
      firstName: "Zoya",
      lastName: "Khan",
      programId: "prog-1",
      genderId: "g-f",
      pincode: "400050",
    });
  });

  it("reports master fields that were filled with a default", () => {
    const resolveWithDefault = () => ({
      values: { programId: "prog-ssc" },
      unmatched: [],
      defaulted: [
        'Programme ("Class 1" not found) — set to Secondary School Certificate',
      ],
    });

    const { missing, defaulted } = applicantFromScan(
      scan(),
      resolveWithDefault,
    );

    expect(missing).toEqual([]);
    expect(defaulted).toEqual([
      'Programme ("Class 1" not found) — set to Secondary School Certificate',
    ]);
  });

  it("lists the required fields that are still empty", () => {
    const { missing } = applicantFromScan(scan({ dob: "" }));

    // No resolver: the programme cannot be chosen from the scan alone.
    expect(missing).toEqual(
      expect.arrayContaining(["Date of birth", "Programme"]),
    );
  });
});
