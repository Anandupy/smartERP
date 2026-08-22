import type {
  NumberingAllocationMode,
  NumberingResetStrategy,
  NumberingScope,
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
