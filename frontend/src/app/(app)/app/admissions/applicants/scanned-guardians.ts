import type { AdmissionOcrResult } from "@/features/admissions";
import type { GuardianRequest, MapGuardianRequest } from "@/features/guardians";

/**
 * Turns the parents' table of a scanned admission form into guardian
 * records to create and link when the applicant is saved.
 *
 * Lives at the route because it is exactly where Admissions (the scan) and
 * Guardians (the records) meet (AGENTS.md §28) — neither feature imports the
 * other. Pure: no requests, so it is unit-tested on its own.
 */

export type ParentRole = "Father" | "Mother";

export interface ScannedGuardian {
  role: ParentRole;
  request: GuardianRequest;
  mapping: Omit<MapGuardianRequest, "guardianId" | "relationTypeId">;
}

export interface ScannedGuardiansPlan {
  guardians: ScannedGuardian[];
  /** Parents named on the form but not addable (e.g. no mobile number). */
  skipped: string[];
}

const titleCase = (text: string) =>
  text.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());

/** "Farooq Ismail Merchant" → first "Farooq", middle "Ismail", last "Merchant". */
export function splitName(fullName: string, fallbackLastName: string) {
  const parts = fullName
    // Titles are not names: "Dr. Shalini …", "Late Shri Ramesh …".
    .replace(/^((mr|mrs|ms|miss|shri|smt|late|dr|prof|adv|er|ca)\.?\s+)+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCase);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      middleName: null,
      lastName: titleCase(fallbackLastName) || parts[0],
    };
  }
  return {
    firstName: parts[0],
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : null,
    lastName: parts.at(-1)!,
  };
}

/**
 * The first rupee amount in a written income: "Rs. 18,50,000/- per annum"
 * → 1850000; "2.4 lakh" → 240000. Null when no amount is written.
 */
export function parseIncome(text: string): number | null {
  const lakh = /([\d.]+)\s*(lakh|lac|lakhs|lacs)\b/i.exec(text);
  if (lakh) return Math.round(Number(lakh[1]) * 100_000) || null;
  const amount = /(\d[\d,]*)(?:\.\d+)?/.exec(text.replace(/\s+/g, ""));
  if (!amount) return null;
  const value = Number(amount[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

export function planScannedGuardians(
  scan: AdmissionOcrResult,
): ScannedGuardiansPlan {
  const { parents, address, student } = scan;
  const income = parseIncome(parents.annualIncome);
  const candidates = [
    {
      role: "Father" as const,
      name: parents.fatherName,
      mobile: parents.fatherMobile,
      occupation: parents.fatherOccupation,
      aadhaar: parents.fatherAadhaar,
    },
    {
      role: "Mother" as const,
      name: parents.motherName,
      mobile: parents.motherMobile,
      occupation: parents.motherOccupation,
      aadhaar: parents.motherAadhaar,
    },
  ];

  const guardians: ScannedGuardian[] = [];
  const skipped: string[] = [];
  for (const parent of candidates) {
    const name = splitName(parent.name, student.lastName);
    if (!name) continue;
    if (!/^\d{10}$/.test(parent.mobile)) {
      skipped.push(
        `${parent.role} ${parent.name.trim()} (no mobile number on the form)`,
      );
      continue;
    }
    guardians.push({
      role: parent.role,
      request: {
        dob: null,
        ...name,
        mobilePrimary: parent.mobile,
        mobileSecondary: null,
        email: null,
        occupation: orNull(parent.occupation),
        // The form records one income for the family; it belongs to whoever
        // is the financial guardian, so only the first parent carries it.
        income: guardians.length === 0 ? income : null,
        aadhaarNo: /^\d{12}$/.test(parent.aadhaar) ? parent.aadhaar : null,
        // The form has one residential address — the family's.
        addressLine1: orNull(address.currentAddressLine1),
        addressLine2: orNull(address.currentAddressLine2),
        city: orNull(address.city),
        state: orNull(address.state),
        country: orNull(address.country),
        pincode: orNull(address.pincode),
      },
      mapping: {
        // The first parent listed (father, else mother) is primary and pays.
        isPrimary: guardians.length === 0,
        isFinancialGuardian: guardians.length === 0,
        isEmergencyContact: true,
        pickupAllowed: true,
        priority: guardians.length + 1,
      },
    });
  }
  return { guardians, skipped };
}
