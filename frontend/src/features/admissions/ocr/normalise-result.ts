import type { AdmissionOcrResult } from "../schemas/admission-ocr.schema";

/**
 * Normalises the shapes the backend validates — Aadhaar, mobiles, PIN, date
 * of birth — for whichever engine read the form. A value that does not have
 * the right shape is blanked and listed in `uncertainFields`, so a misread
 * digit becomes an empty field the clerk notices, not a value the save then
 * rejects.
 */

const digits = (value: string) => value.replace(/\D/g, "");

/** Keeps a value only if it matches the expected digit shape; otherwise blank. */
export function cleanDigits(value: string, length: number): string {
  let d = digits(value);
  if (length === 10 && d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (length === 10 && d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === length ? d : "";
}

export function cleanDob(value: string, today = new Date()): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "";
  const date = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date > today) return "";
  return date.toISOString().slice(0, 10) === trimmed ? trimmed : "";
}

const COMMON_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "rediffmail.com",
  "icloud.com",
];

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Repairs the usual OCR slips in an email ("x.yegmail.com", "x@qmail.com",
 * trailing ".") and returns "" unless the result is a well-formed address.
 * `guessed` is true when the "@" itself had to be inferred — the character
 * before the domain may have been part of the name, so the clerk must check.
 */
export function cleanEmail(value: string): { email: string; guessed: boolean } {
  let email = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,;]+$/, "")
    .replace(/,/g, ".");
  let guessed = false;
  for (const domain of COMMON_DOMAINS) {
    const [name, ...rest] = domain.split(".");
    const first = name[0] === "g" ? "[gq]" : name[0];
    const tail = `${escapeRegExp(name.slice(1))}\\.${rest.map(escapeRegExp).join("\\.")}$`;
    const withAt = new RegExp(`@${first}${tail}`);
    const withoutAt = new RegExp(`[ec]?${first}${tail}`);
    if (withAt.test(email)) {
      email = email.replace(withAt, `@${domain}`);
      break;
    }
    if (!email.includes("@") && withoutAt.test(email)) {
      email = email.replace(withoutAt, `@${domain}`);
      guessed = true;
      break;
    }
  }
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)
    ? { email, guessed }
    : { email: "", guessed: false };
}

export function normaliseOcrResult(
  result: AdmissionOcrResult,
): AdmissionOcrResult {
  const uncertain = new Set(result.uncertainFields);
  const check = (field: string, raw: string, cleaned: string) => {
    if (raw.trim() && !cleaned) uncertain.add(field);
    return cleaned;
  };
  const email = cleanEmail(result.contact.primaryEmail);
  if (email.guessed) uncertain.add("primaryEmail");

  return {
    ...result,
    student: {
      ...result.student,
      dob: check("dob", result.student.dob, cleanDob(result.student.dob)),
      aadhaarNo: check(
        "aadhaarNo",
        result.student.aadhaarNo,
        cleanDigits(result.student.aadhaarNo, 12),
      ),
    },
    contact: {
      ...result.contact,
      primaryMobile: check(
        "primaryMobile",
        result.contact.primaryMobile,
        cleanDigits(result.contact.primaryMobile, 10),
      ),
      alternateMobile: check(
        "alternateMobile",
        result.contact.alternateMobile,
        cleanDigits(result.contact.alternateMobile, 10),
      ),
      primaryEmail: check(
        "primaryEmail",
        result.contact.primaryEmail,
        email.email,
      ),
    },
    address: {
      ...result.address,
      pincode: check(
        "pincode",
        result.address.pincode,
        cleanDigits(result.address.pincode, 6),
      ),
    },
    parents: {
      ...result.parents,
      fatherMobile: cleanDigits(result.parents.fatherMobile, 10),
      motherMobile: cleanDigits(result.parents.motherMobile, 10),
    },
    uncertainFields: [...uncertain],
  };
}
