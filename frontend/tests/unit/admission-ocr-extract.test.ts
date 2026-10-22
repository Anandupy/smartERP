import { describe, expect, it } from "vitest";

import { parseDateInWords } from "@/features/admissions/ocr/date-words";
import {
  extractAdmissionForm,
  fixDigitRuns,
} from "@/features/admissions/ocr/extract-form";
import {
  cleanDigits,
  cleanDob,
  cleanEmail,
  normaliseOcrResult,
} from "@/features/admissions/ocr/normalise-result";
import type { Box, FormPage, Token } from "@/features/admissions/ocr/types";

/** A token `height` units tall whose top-left corner is at (x, y). */
function tok(
  text: string,
  x: number,
  y: number,
  score = 1,
  height = 10,
): Token {
  return { text, x0: x, y0: y, x1: x + text.length * 6, y1: y + height, score };
}

/** Page 1 of the form as a digital PDF text layer would present it. */
function textLayerPage(): FormPage {
  return {
    width: 600,
    height: 850,
    source: "text-layer",
    tokens: [
      tok("Class Applied For:", 300, 20),
      tok("Class 2 - Div A", 410, 20),
      tok("Date:", 520, 20),
      tok("FIRST NAME *", 20, 60),
      tok("Anaya", 20, 78),
      tok("MIDDLE / FATHER'S NAME", 200, 60),
      tok("Farooq", 200, 78),
      tok("LAST NAME / SURNAME *", 400, 60),
      tok("Merchant", 400, 78),
      tok("DATE OF BIRTH (DD-MM-YYYY) *", 20, 110),
      ...["0", "5", "1", "1", "2", "0", "1", "9"].map((d, i) =>
        tok(d, 22 + i * 12, 128),
      ),
      tok("DATE OF BIRTH (IN WORDS)", 160, 110),
      tok("Fifth November Two Thousand Nineteen", 160, 128),
      tok("GENDER *", 440, 110),
      tok("Male", 455, 128),
      tok("✓", 482, 128),
      tok("Female", 492, 128),
      tok("Other", 540, 128),
      tok("PLACE OF BIRTH (CITY/STATE)", 20, 160),
      tok("Mumbai, Maharashtra", 20, 178),
      tok("RELIGION *", 200, 160),
      tok("Muslim", 200, 178),
      tok("CATEGORY *", 440, 160),
      tok("General", 440, 178),
      tok("AADHAAR CARD NUMBER (12 DIGITS) *", 200, 210),
      tok("6201", 200, 228),
      tok("7845", 250, 228),
      tok("9632", 300, 228),
      tok("APAAR ID / PRN (IF ALLOCATED)", 440, 210),
      tok("APAAR-2026-9903", 440, 228),
      tok("PRIMARY MOBILE NUMBER (SCHOOL ALERTS) *", 20, 260),
      tok("+91 9892123456", 20, 278),
      tok("PINCODE *", 500, 310),
      tok("400027", 500, 328),
      tok("STATE *", 400, 310),
      tok("Maharashtra", 400, 328),
      tok("3. PARENTS & GUARDIAN DETAILS", 20, 360),
    ],
  };
}

describe("extractAdmissionForm — digital PDF text layer", () => {
  it("reads every field from beneath its printed label", async () => {
    const { result, labelsFound } = await extractAdmissionForm([
      textLayerPage(),
    ]);

    expect(labelsFound).toBeGreaterThanOrEqual(12);
    expect(result.student).toMatchObject({
      firstName: "Anaya",
      middleName: "Farooq",
      lastName: "Merchant",
      dob: "2019-11-05",
      birthPlace: "Mumbai, Maharashtra",
      aadhaarNo: "620178459632",
      apaarId: "APAAR-2026-9903",
    });
    expect(result.contact.primaryMobile).toBe("919892123456");
    expect(result.address).toMatchObject({
      state: "Maharashtra",
      country: "India",
      pincode: "400027",
    });
    expect(result.masterLabels).toMatchObject({
      gender: "Female",
      religion: "Muslim",
      category: "General",
      classAppliedFor: "Class 2",
    });
    expect(result.uncertainFields).toEqual([]);
  });

  it("never takes a neighbouring column's value or a section heading", async () => {
    const { result } = await extractAdmissionForm([textLayerPage()]);

    // "Farooq" sits under the next label on the same row, not under FIRST NAME.
    expect(result.student.firstName).toBe("Anaya");
    expect(result.address.currentAddressLine2).toBe("");
  });

  it("leaves a field empty rather than guessing when its label is missing", async () => {
    const page = textLayerPage();
    page.tokens = page.tokens.filter((t) => t.text !== "RELIGION *");

    const { result } = await extractAdmissionForm([page]);

    expect(result.masterLabels.religion).toBe("");
  });
});

describe("extractAdmissionForm — OCR'd photo", () => {
  function ocrPage(tickedWord: string): FormPage {
    const page = textLayerPage();
    return {
      ...page,
      source: "ocr",
      tokens: page.tokens.filter((t) => t.text !== "✓"),
      // Only the ticked option's checkbox holds ink.
      checkboxInk: (word: Box) => {
        const token = page.tokens.find(
          (t) => t.x0 === word.x0 && t.y0 === word.y0,
        );
        return token?.text === tickedWord ? 0.4 : 0;
      },
    };
  }

  it("finds the ticked option by the ink in its checkbox", async () => {
    const { result } = await extractAdmissionForm([ocrPage("Male")]);
    expect(result.masterLabels.gender).toBe("Male");
  });

  it("flags low-confidence readings for the clerk", async () => {
    const page = ocrPage("Female");
    page.tokens = page.tokens.map((t) =>
      t.text === "Muslim" ? { ...t, score: 0.4 } : t,
    );

    const { result } = await extractAdmissionForm([page]);

    expect(result.masterLabels.religion).toBe("Muslim");
    expect(result.uncertainFields).toContain("religion");
  });

  it("uses the digit-box reader for boxed digits and keeps only valid shapes", async () => {
    const readDigits = async (
      _page: FormPage,
      _region: Box,
      isValid: (d: string) => boolean,
    ) => {
      const digits = "620178459632";
      return isValid(digits) ? { digits, score: 0.95 } : null;
    };

    const { result } = await extractAdmissionForm(
      [ocrPage("Female")],
      readDigits,
    );

    expect(result.student.aadhaarNo).toBe("620178459632");
  });
});

describe("parseDateInWords", () => {
  it.each([
    ["Fifth November Two Thousand Nineteen", "2019-11-05"],
    ["Twenty First March Two Thousand Twenty", "2020-03-21"],
    ["Fifth Movember Two Thousand Mineteen", "2019-11-05"],
    ["Thirtieth June Two Thousand Twenty One", "2021-06-30"],
    ["Fifteenth May Two Thousand 18", "2018-05-15"],
  ])("reads %s", (words, iso) => {
    expect(parseDateInWords(words)).toBe(iso);
  });

  it.each([
    "",
    "Thirty First February Two Thousand Twenty",
    "Banana Split",
    // Cut short: "Two Thousand" alone is not trusted as the year 2000.
    "Fifteenth March Two Thousand",
  ])("rejects %j", (words) => {
    expect(parseDateInWords(words)).toBeNull();
  });
});

describe("OCR repairs", () => {
  it.each([
    ["kabir.shaikh@qmail.com", "kabir.shaikh@gmail.com", false],
    ["merchant.farooq@gmail.com.", "merchant.farooq@gmail.com", false],
    ["aditi,patil@qmail.com", "aditi.patil@gmail.com", false],
    ["aarav.sharmaegmail.com", "aarav.sharma@gmail.com", true],
    ["not an email", "", false],
  ])("repairs email %s", (raw, email, guessed) => {
    expect(cleanEmail(raw)).toEqual({ email, guessed });
  });

  it.each([
    ["PRN-202G003", "PRN-2026003"],
    ["TC-202b/104", "TC-2026/104"],
    ["APAAR-2026-9903", "APAAR-2026-9903"],
    ["Sr. KG / Prep", "Sr. KG / Prep"],
  ])("fixes digit lookalikes in %s", (raw, fixed) => {
    expect(fixDigitRuns(raw)).toBe(fixed);
  });
});

describe("normaliseOcrResult", () => {
  it("keeps digits only when they have the right shape", () => {
    expect(cleanDigits("+91 98921 23456", 10)).toBe("9892123456");
    expect(cleanDigits("09892123456", 10)).toBe("9892123456");
    expect(cleanDigits("6201-7845-963", 12)).toBe("");
    expect(cleanDob("2019-11-05")).toBe("2019-11-05");
    expect(cleanDob("2019-02-30")).toBe("");
    expect(cleanDob("2099-01-01", new Date("2026-10-23"))).toBe("");
  });

  it("blanks and flags a misread instead of passing it to the backend", async () => {
    const { result } = await extractAdmissionForm([textLayerPage()]);
    const misread = {
      ...result,
      student: { ...result.student, aadhaarNo: "62017845963" },
    };

    const normalised = normaliseOcrResult(misread);

    expect(normalised.student.aadhaarNo).toBe("");
    expect(normalised.uncertainFields).toContain("aadhaarNo");
    expect(normalised.contact.primaryMobile).toBe("9892123456");
  });
});
