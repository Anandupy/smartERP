import { describe, expect, it } from "vitest";

import {
  parseIncome,
  planScannedGuardians,
  splitName,
} from "@/app/(app)/app/admissions/applicants/scanned-guardians";
import type { AdmissionOcrResult } from "@/features/admissions";

function scan(
  parents: Partial<AdmissionOcrResult["parents"]> = {},
): AdmissionOcrResult {
  return {
    student: {
      firstName: "Anaya",
      middleName: "Farooq",
      lastName: "Merchant",
      dob: "2019-11-05",
      birthPlace: "",
      aadhaarNo: "",
      penNo: "",
      apaarId: "",
      disabilityStatus: false,
      disabilityNotes: "",
    },
    contact: {
      primaryMobile: "9892123456",
      alternateMobile: "",
      primaryEmail: "",
    },
    address: {
      currentAddressLine1: "14/B, Al-Madina Mansion",
      currentAddressLine2: "",
      city: "Mumbai",
      district: "",
      state: "Maharashtra",
      country: "India",
      pincode: "400027",
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
      gender: "",
      religion: "",
      caste: "",
      category: "",
      motherTongue: "",
      bloodGroup: "",
      disabilityType: "",
      classAppliedFor: "",
      admissionSource: "",
    },
    parents: {
      fatherName: "Farooq Ismail Merchant",
      fatherMobile: "9892123456",
      fatherOccupation: "Textiles Merchant",
      fatherAadhaar: "621098451090",
      motherName: "Yasmin Farooq Merchant",
      motherMobile: "9819876543",
      motherOccupation: "Homemaker",
      motherAadhaar: "84123652206",
      annualIncome: "Rs. 18,50,000/- per annum",
      ...parents,
    },
    uncertainFields: [],
  };
}

describe("planScannedGuardians", () => {
  it("plans father and mother with the family address", () => {
    const { guardians, skipped } = planScannedGuardians(scan());

    expect(skipped).toEqual([]);
    expect(guardians.map((g) => g.role)).toEqual(["Father", "Mother"]);
    expect(guardians[0].request).toMatchObject({
      firstName: "Farooq",
      middleName: "Ismail",
      lastName: "Merchant",
      mobilePrimary: "9892123456",
      occupation: "Textiles Merchant",
      aadhaarNo: "621098451090",
      income: 1850000,
      city: "Mumbai",
      pincode: "400027",
    });
  });

  it("makes the first parent primary and financial, both emergency contacts", () => {
    const [father, mother] = planScannedGuardians(scan()).guardians;

    expect(father.mapping).toMatchObject({
      isPrimary: true,
      isFinancialGuardian: true,
      isEmergencyContact: true,
      priority: 1,
    });
    expect(mother.mapping).toMatchObject({
      isPrimary: false,
      isFinancialGuardian: false,
      isEmergencyContact: true,
      priority: 2,
    });
    expect(mother.request.income).toBeNull();
  });

  it("drops an Aadhaar without 12 digits instead of sending it", () => {
    const [, mother] = planScannedGuardians(scan()).guardians;
    expect(mother.request.aadhaarNo).toBeNull();
  });

  it("skips a parent with no mobile and promotes the other to primary", () => {
    const { guardians, skipped } = planScannedGuardians(
      scan({ fatherMobile: "" }),
    );

    expect(skipped).toEqual([
      "Father Farooq Ismail Merchant (no mobile number on the form)",
    ]);
    expect(guardians).toHaveLength(1);
    expect(guardians[0]).toMatchObject({
      role: "Mother",
      mapping: { isPrimary: true },
    });
  });

  it("ignores a blank parent", () => {
    expect(
      planScannedGuardians(scan({ motherName: "" })).guardians,
    ).toHaveLength(1);
  });
});

describe("splitName", () => {
  it.each([
    [
      "Farooq Ismail Merchant",
      { firstName: "Farooq", middleName: "Ismail", lastName: "Merchant" },
    ],
    [
      "RAJESH SHARMA",
      { firstName: "Rajesh", middleName: null, lastName: "Sharma" },
    ],
    [
      "Mr. Vikram Surendra Singhania",
      { firstName: "Vikram", middleName: "Surendra", lastName: "Singhania" },
    ],
    ["Rekha", { firstName: "Rekha", middleName: null, lastName: "Merchant" }],
    [
      "Dr. Shalini Devendra Mehra",
      { firstName: "Shalini", middleName: "Devendra", lastName: "Mehra" },
    ],
    [
      "Late Shri Ramesh Patil",
      { firstName: "Ramesh", middleName: null, lastName: "Patil" },
    ],
  ])("splits %s", (name, parts) => {
    expect(splitName(name, "merchant")).toEqual(parts);
  });
});

describe("parseIncome", () => {
  it.each([
    ["Rs. 18,50,000/- per annum", 1850000],
    ["2.4 lakh", 240000],
    ["Rs. 3,60,000 [ ] Higher Income Group", 360000],
    ["", null],
  ])("reads %j", (text, value) => {
    expect(parseIncome(text)).toBe(value);
  });
});
