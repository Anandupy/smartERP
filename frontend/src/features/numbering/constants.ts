import type {
  NumberingAllocationMode,
  NumberingResetStrategy,
  NumberingScope,
  NumberingYearFormat,
} from "./types/numbering.dto";

/**
 * Human labels for the documented purpose enum (design spec §3.2). Any
 * `purpose` value the backend returns that is not in this map still
 * renders — as itself — rather than being hidden, since a config existing
 * for an undocumented purpose is a fact to show, not to suppress.
 */
export const PURPOSE_LABEL: Record<string, string> = {
  STUDENT_CODE: "Student Code",
  EMPLOYEE_CODE: "Employee Code",
  ADMISSION_NO: "Admission Number",
  ADMISSION_FORM: "Admission Form Number",
  APPLICATION: "Application Number",
  RECEIPT: "Receipt Number",
  INVOICE: "Invoice Number",
  TC_NUMBER: "Transfer Certificate Number",
  CERTIFICATE: "Certificate Number",
};

export function purposeLabel(purpose: string): string {
  return PURPOSE_LABEL[purpose] ?? purpose;
}

export const SCOPE_LABEL: Record<NumberingScope, string> = {
  ORGANIZATION: "Organization-wide",
  BRANCH: "This branch",
};

export const ALLOCATION_MODE_LABEL: Record<NumberingAllocationMode, string> = {
  GAPLESS: "Gapless — no number is ever skipped",
  MONOTONIC: "Monotonic — increasing, gaps permitted",
};

export const RESET_STRATEGY_LABEL: Record<NumberingResetStrategy, string> = {
  NEVER: "Never resets",
  YEARLY: "Resets every academic year",
};

/**
 * Human labels for `yearFormat` (design spec §12.2). Illustrative examples
 * only, not a claim about any current academic year — the actual rendered
 * value always comes from the Preview endpoint against a real academic year,
 * never computed here.
 */
export const YEAR_FORMAT_LABEL: Record<NumberingYearFormat, string> = {
  NAME: "Academic year name, as entered",
  FULL_START: "Start year, 4 digits",
  SHORT_START: "Start year, 2 digits",
  FULL_RANGE: "Both years, 8 digits",
  SHORT_RANGE: "Both years, 4 digits",
};

/** A short worked example for each mode — shown as helper text, not a claimed current year. */
export const YEAR_FORMAT_EXAMPLE: Record<NumberingYearFormat, string> = {
  NAME: '"2026-27" (whatever the academic year is named)',
  FULL_START: '"2026"',
  SHORT_START: '"26"',
  FULL_RANGE: '"20262027"',
  SHORT_RANGE: '"2627"',
};

/**
 * The format layer's closed placeholder vocabulary (design spec §12.5,
 * `KNOWN_PLACEHOLDERS`). Single source of truth for validation
 * (`schemas/numbering.schema.ts`), the format-field helper chips, and the
 * "how this format works" explanation — one list, so a placeholder can never
 * be offered in the UI without also being accepted by validation, or
 * explained without being offered.
 */
export interface FormatPlaceholder {
  token: string;
  label: string;
  description: string;
}

export const FORMAT_PLACEHOLDERS: FormatPlaceholder[] = [
  { token: "{prefix}", label: "Prefix", description: "The sequence's configured prefix" },
  { token: "{suffix}", label: "Suffix", description: "The sequence's configured suffix" },
  { token: "{branchCode}", label: "Branch Code", description: "The current branch's code" },
  {
    token: "{year}",
    label: "Year",
    description: "The academic year, rendered per the selected year format",
  },
  {
    token: "{sequence}",
    label: "Sequence",
    description: "The generated, zero-padded sequence number",
  },
];

export const FORMAT_PLACEHOLDER_TOKENS = FORMAT_PLACEHOLDERS.map((p) => p.token);

/** Rows per page — client-side, since the list endpoint takes no paging params. */
export const DIRECTORY_PAGE_SIZE = 10;

export function filterNumberingConfigs<T extends { purpose: string; isActive: boolean }>(
  configs: readonly T[],
  filters: { search: string; status: string },
): T[] {
  const needle = filters.search.trim().toLowerCase();

  return configs.filter((config) => {
    if (filters.status === "active" && !config.isActive) return false;
    if (filters.status === "inactive" && config.isActive) return false;
    if (needle.length === 0) return true;
    return [config.purpose, purposeLabel(config.purpose)].some((field) =>
      field.toLowerCase().includes(needle),
    );
  });
}
