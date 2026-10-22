import type { AdmissionOcrResult } from "../schemas/admission-ocr.schema";
import { parseDateInWords } from "./date-words";
import {
  LABELS,
  OPTIONS,
  PRINTED_WORDS,
  type LabelDef,
  type LabelId,
} from "./ssv-form-template";
import {
  boxHeight,
  centerX,
  centerY,
  type Box,
  type FormPage,
  type Token,
} from "./types";

/**
 * Turns positioned text from the pages of a Shree Siddhi Vinayagar admission
 * form into the same `AdmissionOcrResult` the Claude reader returns.
 *
 * Every value is located relative to its printed label (see
 * `ssv-form-template.ts`), so the same code reads a digital PDF's text layer
 * and an OCR'd photo. Nothing is guessed: a field whose label or value is not
 * found stays empty, and anything read with low confidence is listed in
 * `uncertainFields` for the clerk to check.
 */

/** Reads a row of boxed digits at `region` of `page`. OCR pages only. */
export type DigitBoxReader = (
  page: FormPage,
  region: Box,
  isValid: (digits: string) => boolean,
) => Promise<{ digits: string; score: number } | null>;

const LOW_CONFIDENCE = 0.8;

export const normaliseKey = (text: string) =>
  text.toUpperCase().replace(/[^A-Z0-9]/g, "");

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let previous = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return dp[b.length];
}

/** Joins tokens left-to-right, adding a space only where there is a visible gap. */
function joinRow(tokens: Token[]): string {
  const sorted = [...tokens].sort((a, b) => a.x0 - b.x0);
  let text = "";
  sorted.forEach((token, i) => {
    const gap = i === 0 ? 0 : token.x0 - sorted[i - 1].x1;
    const h = Math.max(boxHeight(token), boxHeight(sorted[i - 1] ?? token));
    text += (i > 0 && gap > h * 0.2 ? " " : "") + token.text;
  });
  return text.replace(/\s+/g, " ").trim();
}

/** Groups tokens into visual rows (top to bottom). */
function rows(tokens: Token[]): Token[][] {
  const sorted = [...tokens].sort((a, b) => centerY(a) - centerY(b));
  const result: Token[][] = [];
  for (const token of sorted) {
    const row = result.find((r) => {
      const ref = r[0];
      return (
        Math.abs(centerY(ref) - centerY(token)) <
        Math.min(boxHeight(ref), boxHeight(token)) * 0.6
      );
    });
    if (row) row.push(token);
    else result.push([token]);
  }
  return result.map((row) => row.sort((a, b) => a.x0 - b.x0));
}

/**
 * Merges tokens of a row that sit close together into phrases, so a label the
 * OCR split in two ("DATE OF BIRTH" + "(DD-MM-YYYY) *") matches as one.
 */
function phrases(tokens: Token[]): Token[] {
  const merged: Token[] = [];
  for (const row of rows(tokens)) {
    let current: Token[] = [];
    const flush = () => {
      if (current.length === 0) return;
      merged.push({
        text: joinRow(current),
        x0: Math.min(...current.map((t) => t.x0)),
        y0: Math.min(...current.map((t) => t.y0)),
        x1: Math.max(...current.map((t) => t.x1)),
        y1: Math.max(...current.map((t) => t.y1)),
        score: Math.min(...current.map((t) => t.score)),
      });
      current = [];
    };
    for (const token of row) {
      const last = current.at(-1);
      const h = Math.max(boxHeight(token), last ? boxHeight(last) : 0);
      if (last && token.x0 - last.x1 > h * 0.9) flush();
      current.push(token);
    }
    flush();
  }
  return merged;
}

interface FoundLabel {
  page: FormPage;
  token: Token;
  /** Text after the label inside the same token (inline values). */
  rest: string;
}

/** How well `text` matches a label: null for no match, else a distance (lower is better). */
function labelDistance(text: string, def: LabelDef): number | null {
  const key = def.key;
  const norm = normaliseKey(text);
  const tolerance = Math.floor(key.length / 8);
  if (norm.length < key.length - tolerance) return null;
  if (norm.length - key.length > (def.maxExtra ?? 2) + tolerance) return null;
  const distance = levenshtein(key, norm.slice(0, key.length));
  return distance <= tolerance ? distance : null;
}

function findLabels(pages: FormPage[]): Map<LabelId, FoundLabel> {
  const found = new Map<LabelId, FoundLabel & { distance: number }>();
  for (const page of pages) {
    for (const token of [...phrases(page.tokens), ...page.tokens]) {
      for (const [id, def] of Object.entries(LABELS) as [LabelId, LabelDef][]) {
        const distance = labelDistance(token.text, def);
        if (distance === null) continue;
        const existing = found.get(id);
        if (existing && existing.distance <= distance) continue;
        const colon = token.text.indexOf(":");
        found.set(id, {
          page,
          token,
          rest: colon >= 0 ? token.text.slice(colon + 1).trim() : "",
          distance,
        });
      }
    }
  }
  return found;
}

/** True when two boxes share more than half of the smaller one's area. */
function overlaps(a: Box, b: Box): boolean {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (w <= 0 || h <= 0) return false;
  const smaller = Math.min(
    (a.x1 - a.x0) * (a.y1 - a.y0),
    (b.x1 - b.x0) * (b.y1 - b.y0),
  );
  return w * h > smaller * 0.5;
}

/** Numbered section headings ("3. PARENTS & GUARDIAN DETAILS") are never values. */
const isSectionHeading = (text: string) =>
  /^\s*\d+\s*[.)]\s*[A-Z][A-Za-z &'/()-]{6,}$/.test(text) &&
  text === text.toUpperCase();

const insideCenter = (token: Box, region: Box) =>
  centerX(token) >= region.x0 &&
  centerX(token) <= region.x1 &&
  centerY(token) >= region.y0 &&
  centerY(token) <= region.y1;

const isTick = (text: string) => /[✓✔☑✅]/.test(text);

export interface ExtractionContext {
  pages: FormPage[];
  labels: Map<LabelId, FoundLabel>;
  readDigits?: DigitBoxReader;
}

/** The nearest found label on the same row, to the right of `label`. */
function rightNeighbour(
  ctx: ExtractionContext,
  label: FoundLabel,
): number | null {
  const h = boxHeight(label.token);
  let best: number | null = null;
  for (const other of ctx.labels.values()) {
    if (other.page !== label.page || other.token === label.token) continue;
    if (Math.abs(centerY(other.token) - centerY(label.token)) > h * 0.8)
      continue;
    if (other.token.x0 <= label.token.x1) continue;
    if (best === null || other.token.x0 < best) best = other.token.x0;
  }
  return best;
}

function isLabelToken(
  ctx: ExtractionContext,
  page: FormPage,
  token: Token,
): boolean {
  for (const label of ctx.labels.values()) {
    if (
      label.page === page &&
      (label.token === token || overlaps(label.token, token))
    ) {
      // A merged label+value token (e.g. "Class Applied For: Class 2") is still a label.
      return true;
    }
  }
  return false;
}

/** Value area below a label: from the label down ~3 label-heights, up to the next label. */
function belowRegion(
  ctx: ExtractionContext,
  label: FoundLabel,
  depth = 2.6,
  widthFraction = 0.32,
): Box {
  const h = boxHeight(label.token);
  const neighbour = rightNeighbour(ctx, label);
  return {
    x0: label.token.x0 - h * 0.4,
    y0: label.token.y1 - h * 0.3,
    x1:
      neighbour !== null
        ? neighbour - h * 0.3
        : label.token.x0 + label.page.width * widthFraction,
    y1: label.token.y1 + h * depth,
  };
}

interface ReadValue {
  text: string;
  score: number;
  tokens: Token[];
}

function valueIn(
  ctx: ExtractionContext,
  page: FormPage,
  region: Box,
): ReadValue {
  const tokens = page.tokens.filter(
    (token) =>
      insideCenter(token, region) &&
      !isLabelToken(ctx, page, token) &&
      !isTick(token.text) &&
      !isSectionHeading(token.text) &&
      !PRINTED_WORDS.has(normaliseKey(token.text)),
  );
  const text = rows(tokens)
    .map((row) => joinRow(row))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const score = tokens.length ? Math.min(...tokens.map((t) => t.score)) : 1;
  return { text, score, tokens };
}

function below(
  ctx: ExtractionContext,
  id: LabelId,
  depth?: number,
  widthFraction?: number,
): ReadValue | null {
  const label = ctx.labels.get(id);
  if (!label) return null;
  return valueIn(
    ctx,
    label.page,
    belowRegion(ctx, label, depth, widthFraction),
  );
}

/** Value to the right of a label on the same row ("Class Applied For: …"). */
function inline(ctx: ExtractionContext, id: LabelId): ReadValue | null {
  const label = ctx.labels.get(id);
  if (!label) return null;
  const h = boxHeight(label.token);
  const neighbour = rightNeighbour(ctx, label);
  const region: Box = {
    x0: label.token.x1 - h * 0.2,
    y0: label.token.y0 - h * 0.4,
    x1: neighbour ?? label.page.width,
    y1: label.token.y1 + h * 0.4,
  };
  const tokens = label.page.tokens.filter(
    (token) =>
      token !== label.token &&
      insideCenter(token, region) &&
      !isLabelToken(ctx, label.page, token),
  );
  const stopAt = tokens.findIndex((token) =>
    normaliseKey(token.text).startsWith("DATE"),
  );
  const kept = stopAt >= 0 ? tokens.slice(0, stopAt) : tokens;
  const text = [label.rest, joinRow(kept)].filter(Boolean).join(" ").trim();
  const score = Math.min(label.token.score, ...kept.map((t) => t.score));
  return { text, score, tokens: kept };
}

/** A cell of the parents' table: row label × column header. */
function cell(
  ctx: ExtractionContext,
  rowId: LabelId,
  columnId: LabelId,
  nextColumnId?: LabelId,
): ReadValue | null {
  const row = ctx.labels.get(rowId);
  const column = ctx.labels.get(columnId);
  if (!row || !column || row.page !== column.page) return null;
  const next = nextColumnId ? ctx.labels.get(nextColumnId) : undefined;
  const h = Math.max(boxHeight(row.token), boxHeight(column.token));
  const region: Box = {
    x0: column.token.x0 - h * 0.5,
    y0: row.token.y0 - h * 0.7,
    x1:
      next && next.page === column.page
        ? next.token.x0 - h * 0.5
        : column.page.width,
    y1: row.token.y1 + h * 0.7,
  };
  return valueIn(ctx, row.page, region);
}

/** A column of the previous-school table: the cell just under the header. */
function column(ctx: ExtractionContext, id: LabelId): ReadValue | null {
  const label = ctx.labels.get(id);
  if (!label) return null;
  return valueIn(ctx, label.page, belowRegion(ctx, label, 3.2, 0.3));
}

/** Splits a token into word boxes, estimating positions from character offsets. */
function words(token: Token): Token[] {
  const parts = [...token.text.matchAll(/\S+/g)];
  if (parts.length <= 1) return [token];
  const perChar = (token.x1 - token.x0) / Math.max(1, token.text.length);
  return parts.map((part) => ({
    ...token,
    text: part[0],
    x0: token.x0 + (part.index ?? 0) * perChar,
    x1: token.x0 + ((part.index ?? 0) + part[0].length) * perChar,
  }));
}

interface OptionPick {
  value: string | null;
  uncertain: boolean;
}

/**
 * Which printed option is ticked. Digital PDFs carry the tick as a ✓ glyph
 * just left of the option; on a photo the inside of each option's checkbox
 * is compared for ink, and the clearly darkest one wins.
 */
function tickedOption(
  ctx: ExtractionContext,
  id: LabelId,
  options: readonly { word: string; value: string }[],
  depth: number,
): OptionPick | null {
  const label = ctx.labels.get(id);
  if (!label) return null;
  const page = label.page;
  const region = belowRegion(ctx, label, depth, 0.45);
  const regionTokens = page.tokens.filter(
    (t) => insideCenter(t, region) && !isLabelToken(ctx, page, t),
  );

  const optionWords = new Map<string, Token>();
  for (const token of regionTokens) {
    for (const word of words(token)) {
      const norm = normaliseKey(word.text);
      const option = options.find(
        (o) =>
          norm === o.word ||
          (norm.length === o.word.length + 1 && norm.endsWith(o.word)),
      );
      if (option && !optionWords.has(option.value))
        optionWords.set(option.value, word);
    }
  }

  if (page.source === "text-layer") {
    for (const tick of page.tokens.filter(
      (t) => isTick(t.text) && insideCenter(t, region),
    )) {
      const h = boxHeight(tick);
      for (const [value, word] of optionWords) {
        const dx = word.x0 - tick.x1;
        if (
          dx >= -h * 0.2 &&
          dx <= h * 2.5 &&
          Math.abs(centerY(word) - centerY(tick)) < h
        ) {
          return { value, uncertain: false };
        }
      }
    }
    // Tick drawn inside the word's own text ("✓Female").
    for (const token of regionTokens) {
      if (!isTick(token.text)) continue;
      const after = normaliseKey(token.text.replace(/^.*?[✓✔☑✅]/, ""));
      const option = options.find((o) => after.startsWith(o.word));
      if (option) return { value: option.value, uncertain: false };
    }
    return { value: null, uncertain: false };
  }

  if (!page.checkboxInk) return null;
  const checkboxInk = page.checkboxInk;
  const scored = [...optionWords]
    .map(([value, word]) => ({ value, ink: checkboxInk(word) }))
    .filter((s): s is { value: string; ink: number } => s.ink !== null);
  scored.sort((a, b) => b.ink - a.ink);
  const [first, second] = scored;
  const clearWinner = second
    ? first.ink >= 0.06 && first.ink >= second.ink * 2
    : first?.ink >= 0.15;
  if (first && clearWinner) {
    return { value: first.value, uncertain: first.ink < 0.12 };
  }
  // The OCR often loses the word right next to a tick: if every option it did
  // find is empty and exactly one is missing, that one is probably ticked.
  const missing = options.filter((o) => !optionWords.has(o.value));
  if (missing.length === 1 && scored.every((s) => s.ink < 0.04)) {
    return { value: missing[0].value, uncertain: true };
  }
  return { value: null, uncertain: scored.length > 0 };
}

/** Digits in boxes: exact from a text layer, the digit-box reader on a photo. */
async function boxedDigits(
  ctx: ExtractionContext,
  id: LabelId,
  isValid: (digits: string) => boolean,
): Promise<ReadValue | null> {
  const label = ctx.labels.get(id);
  if (!label) return null;
  const region = belowRegion(ctx, label, 2.8, 0.45);
  const plain = valueIn(ctx, label.page, region);
  const plainDigits = plain.text.replace(/[oO]/g, "0").replace(/\D/g, "");
  if (label.page.source === "text-layer" || !ctx.readDigits) {
    return { ...plain, text: plainDigits };
  }
  const boxed = await ctx.readDigits(label.page, region, isValid);
  if (boxed && (isValid(boxed.digits) || !isValid(plainDigits))) {
    return { text: boxed.digits, score: boxed.score, tokens: [] };
  }
  return { ...plain, text: plainDigits };
}

const titleCase = (text: string) =>
  text.toLowerCase().replace(/\b([a-z])/g, (char) => char.toUpperCase());

/** Removes the division from "Class 2 - Div A" — programmes are per class. */
const stripDivision = (text: string) =>
  text
    .replace(/[\s,-]*\b(div|division|di[nuv])\b\.?\s*[a-z0-9]?\s*$/i, "")
    .trim();

/** Letters commonly read in place of a digit. */
const DIGIT_FOR: Record<string, string> = {
  O: "0",
  o: "0",
  D: "0",
  l: "1",
  I: "1",
  i: "1",
  z: "2",
  Z: "2",
  S: "5",
  s: "5",
  G: "6",
  b: "6",
  B: "8",
  g: "9",
  q: "9",
};

/**
 * Fixes letters misread inside runs of digits in an ID ("PRN-202G003" →
 * "PRN-2026003"): a run of 4+ characters that is mostly digits has its
 * digit-lookalike letters mapped back. Pure-letter parts ("PRN") are kept.
 */
export function fixDigitRuns(text: string): string {
  return text.replace(/[0-9A-Za-z]{4,}/g, (run) => {
    const chars = [...run];
    const digitCount = chars.filter((c) => /[0-9]/.test(c)).length;
    const fixable = chars.filter((c) => DIGIT_FOR[c]).length;
    if (digitCount < run.length / 2 || digitCount + fixable !== run.length)
      return run;
    return chars.map((c) => DIGIT_FOR[c] ?? c).join("");
  });
}

export async function extractAdmissionForm(
  pages: FormPage[],
  readDigits?: DigitBoxReader,
): Promise<{ result: AdmissionOcrResult; labelsFound: number }> {
  const ctx: ExtractionContext = {
    pages,
    labels: findLabels(pages),
    readDigits,
  };
  const uncertain = new Set<string>();

  const text = (field: string, value: ReadValue | null) => {
    if (!value || !value.text) return "";
    if (value.score < LOW_CONFIDENCE) uncertain.add(field);
    return value.text;
  };

  // Text fields.
  const firstName = text("firstName", below(ctx, "firstName"));
  const middleName = text("middleName", below(ctx, "middleName"));
  const lastName = text("lastName", below(ctx, "lastName"));
  const birthPlace = text("birthPlace", below(ctx, "birthPlace"));
  const religion = text("religion", below(ctx, "religion"));
  const caste = text("caste", below(ctx, "caste"));
  const motherTongue = text("motherTongue", below(ctx, "motherTongue"));
  const bloodGroup = text("bloodGroup", below(ctx, "bloodGroup"))
    .replace(/\s+/g, "")
    .toUpperCase();
  const apaarId = fixDigitRuns(text("apaarId", below(ctx, "apaarId")));
  const alternateMobile = text(
    "alternateMobile",
    below(ctx, "alternateMobile"),
  );
  const primaryEmail = text("primaryEmail", below(ctx, "primaryEmail")).replace(
    /\s+/g,
    "",
  );
  const addressLine1 = text(
    "currentAddressLine1",
    below(ctx, "addressLine1", 3, 0.9),
  );
  const addressLine2 = text("currentAddressLine2", below(ctx, "addressLine2"));
  const city = text("city", below(ctx, "city"));
  const state = text("state", below(ctx, "state"));
  const classAppliedFor = stripDivision(
    text("classAppliedFor", inline(ctx, "classAppliedFor")),
  );

  // Date of birth: boxed digits, cross-checked against the date in words.
  const dobDigits = await boxedDigits(ctx, "dob", (d) => d.length === 8);
  const dobWordsText = text("dob", below(ctx, "dobWords", 3, 0.5));
  const fromWords = parseDateInWords(dobWordsText);
  let dob = "";
  if (dobDigits && /^\d{8}$/.test(dobDigits.text)) {
    const d = dobDigits.text;
    dob = `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
    if (dobDigits.score < LOW_CONFIDENCE) uncertain.add("dob");
  }
  if (fromWords) {
    if (!dob) {
      dob = fromWords;
      if (pages.some((p) => p.source === "ocr")) uncertain.add("dob");
    } else if (dob !== fromWords) {
      // Two readings disagree: keep the boxed digits when they were read
      // confidently (the words may be cut short), and always ask the clerk.
      uncertain.add("dob");
      if ((dobDigits?.score ?? 0) < 0.9) dob = fromWords;
    }
  }

  const aadhaar = await boxedDigits(ctx, "aadhaarNo", (d) => d.length === 12);
  const mobile = await boxedDigits(
    ctx,
    "primaryMobile",
    (d) => d.length === 10 || (d.length === 12 && d.startsWith("91")),
  );
  const pincode = await boxedDigits(ctx, "pincode", (d) => d.length === 6);
  for (const [field, value] of [
    ["aadhaarNo", aadhaar],
    ["primaryMobile", mobile],
    ["pincode", pincode],
  ] as const) {
    if (value?.text && value.score < LOW_CONFIDENCE) uncertain.add(field);
    // A boxed field we could not read on a photo: ask the clerk to type it.
    if (value && !value.text && pages.some((p) => p.source === "ocr"))
      uncertain.add(field);
  }

  // Tick boxes. Category may also be written in by hand ("General").
  const gender = tickedOption(ctx, "gender", OPTIONS.gender, 2.4);
  if (gender?.uncertain) uncertain.add("gender");
  const categoryWritten = below(ctx, "category", 2.4, 0.45);
  const categoryTick = tickedOption(ctx, "category", OPTIONS.category, 4.6);
  const category = categoryTick?.value ?? text("category", categoryWritten);
  if (categoryTick?.uncertain && !categoryTick.value) uncertain.add("category");
  const disability = tickedOption(ctx, "disability", OPTIONS.yesNo, 2.4);
  const transport = tickedOption(ctx, "transport", OPTIONS.yesNo, 2.4);

  // Parents' table and the previous-school table (page 2).
  const fatherName = text(
    "fatherName",
    cell(ctx, "fullNameRow", "fatherColumn", "motherColumn"),
  );
  const motherName = text(
    "motherName",
    cell(ctx, "fullNameRow", "motherColumn"),
  );
  const fatherMobile =
    cell(ctx, "mobileRow", "fatherColumn", "motherColumn")?.text ?? "";
  const motherMobile = cell(ctx, "mobileRow", "motherColumn")?.text ?? "";

  const previousSchoolName = text(
    "previousSchoolName",
    column(ctx, "previousSchool"),
  );
  const previousBoard = text("previousBoard", column(ctx, "previousBoard"));
  const previousClass = text("previousClass", column(ctx, "previousClass"));
  // "(" is often read as "C" before a number: "A+ C88.5%)" → "A+ (88.5%)".
  const previousPercentage = text(
    "previousPercentage",
    column(ctx, "previousPercentage"),
  ).replace(/\bC(?=\d[\d.]*%?\))/g, "(");
  const tcNumber = fixDigitRuns(text("tcNumber", column(ctx, "tcNumber")));

  const result: AdmissionOcrResult = {
    student: {
      firstName: titleCase(firstName),
      middleName: titleCase(middleName),
      lastName: titleCase(lastName),
      dob,
      birthPlace,
      aadhaarNo: aadhaar?.text ?? "",
      penNo: "",
      apaarId,
      disabilityStatus: disability?.value === "Yes",
      disabilityNotes: "",
    },
    contact: {
      primaryMobile: mobile?.text ?? "",
      alternateMobile,
      primaryEmail,
    },
    address: {
      currentAddressLine1: addressLine1,
      currentAddressLine2: addressLine2,
      city,
      district: "",
      state,
      // The form is for a school in India and has no country field.
      country: state ? "India" : "",
      pincode: pincode?.text ?? "",
    },
    previousEducation: {
      previousSchoolName,
      previousBoard,
      previousClass,
      previousPercentage,
      tcNumber,
    },
    facilities: {
      transportRequired: transport?.value === "Yes",
      hostelRequired: false,
    },
    masterLabels: {
      gender: gender?.value ?? "",
      religion,
      caste,
      category,
      motherTongue,
      bloodGroup,
      disabilityType: "",
      classAppliedFor,
    },
    parents: { fatherName, fatherMobile, motherName, motherMobile },
    uncertainFields: [...uncertain],
  };

  return { result, labelsFound: ctx.labels.size };
}
