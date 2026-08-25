/**
 * Wire shapes for `/v1/numbering/configs`.
 *
 * Confirmed directly against `backend/postman/erp.postman_collection.json`'s
 * "Numbering / Config" folder (List, Provision, Edit, Preview — four
 * requests, no `GET /:id`, no `DELETE`) and
 * `backend/docs/planning/00-foundation/03-numbering.md` (design spec,
 * `Status: planned`; §12 is the R6 addendum that added `yearFormat` and is
 * implemented, not planned).
 *
 * One engine generates every human-facing business identifier in the ERP —
 * `studentCode`, `admissionNo` and others. It does not own primary keys
 * (those are UUIDs) and does not allocate on request: **there is no
 * "generate a number" endpoint** — allocation happens only inside a
 * business operation that is about to persist the result (`admit()` for
 * `STUDENT_CODE`/`ADMISSION_NO`). This module only configures the format and
 * previews it — see `docs/numbering-module.md`.
 */

/**
 * The purpose enum, transcribed from the design spec's §3.2 table — the
 * only place a complete list is documented. Only `STUDENT_CODE` and
 * `ADMISSION_NO` are independently confirmed as *live* (the admission
 * trace's final transaction consumes exactly these two); the rest are
 * documented but their live availability is unconfirmed
 * (`docs/backend-gaps.md`).
 */
export const NUMBERING_PURPOSES = [
  "STUDENT_CODE",
  "EMPLOYEE_CODE",
  "ADMISSION_NO",
  "ADMISSION_FORM",
  "APPLICATION",
  "RECEIPT",
  "INVOICE",
  "TC_NUMBER",
  "CERTIFICATE",
] as const;

export type NumberingPurpose = (typeof NUMBERING_PURPOSES)[number];

/** `scope` — server-derived from `purpose`, never submitted (design spec §2 D2). */
export type NumberingScope = "ORGANIZATION" | "BRANCH";

/** `allocationMode` — server-derived from `purpose` (design spec §2 D1). */
export type NumberingAllocationMode = "GAPLESS" | "MONOTONIC";

/** `resetStrategy` — server-derived from `purpose` (design spec §2 D5). */
export type NumberingResetStrategy = "NEVER" | "YEARLY";

/**
 * How `{year}` renders, when a format or `includeAcademicYear` uses one.
 * Added by the R6 refinement (design spec §12.2) — `NAME` is the pre-R6
 * default and behaves exactly as `{year}` always did (the raw
 * `AcademicYear.name`); the other four are computed from the academic
 * year's actual dates server-side, not derived here.
 */
export const NUMBERING_YEAR_FORMATS = [
  "NAME",
  "FULL_START",
  "SHORT_START",
  "FULL_RANGE",
  "SHORT_RANGE",
] as const;

export type NumberingYearFormat = (typeof NUMBERING_YEAR_FORMATS)[number];

/**
 * One sequence configuration. Confirmed field list via the "Provision a
 * Sequence" and "Edit a Sequence Format" response examples, plus
 * `yearFormat` (design spec §12.2, present on every response since the R6
 * migration — including a config created before R6, where it reads `NAME`).
 */
export interface NumberingConfigDto {
  id: string;
  organizationId: string;
  branchId: string | null;
  scope: NumberingScope;
  purpose: string;
  allocationMode: NumberingAllocationMode;
  prefix: string | null;
  suffix: string | null;
  includeBranchCode: boolean;
  includeAcademicYear: boolean;
  sequencePadding: number;
  format: string;
  yearFormat: NumberingYearFormat;
  resetStrategy: NumberingResetStrategy;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Body for `POST /numbering/configs`. `scope`, `allocationMode` and
 * `resetStrategy` are **not** create inputs — the Postman example's own
 * description states they "are derived from the purpose and cannot be
 * supplied." `isActive` is likewise absent from the captured example.
 * `yearFormat` is optional — the server defaults an omitted value to `NAME`.
 */
export interface CreateNumberingConfigRequest {
  purpose: string;
  prefix: string | null;
  suffix: string | null;
  includeBranchCode: boolean;
  includeAcademicYear: boolean;
  sequencePadding: number;
  format: string;
  yearFormat?: NumberingYearFormat;
}

/**
 * Body for `PATCH /numbering/configs/:id`. `purpose` is not editable — no
 * documented way to change what a sequence is for once created.
 */
export interface UpdateNumberingConfigRequest {
  prefix: string | null;
  suffix: string | null;
  includeBranchCode: boolean;
  includeAcademicYear: boolean;
  sequencePadding: number;
  format: string;
  yearFormat: NumberingYearFormat;
  isActive: boolean;
}

/** Body for `POST /numbering/configs/:id/preview`. Consumes no number. */
export interface PreviewNumberingRequest {
  sampleValue: number;
  academicYearId?: string;
}

/** Response of the preview endpoint — confirmed field list. */
export interface PreviewNumberingResponse {
  purpose: string;
  sampleValue: number;
  rendered: string;
}
