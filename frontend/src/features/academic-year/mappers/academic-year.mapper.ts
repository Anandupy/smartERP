import { formatDate } from "@/utils";

import {
  academicYearFormDefaults,
  type AcademicYearFormValues,
} from "../schemas/academic-year.schema";
import type {
  AcademicYearDto,
  CreateAcademicYearRequest,
} from "../types/academic-year.dto";

/**
 * The only translation between the academic-year form and the wire.
 *
 * Two conventions, both shared with the other contract-driven modules:
 *
 * - **The body is always complete.** The Postman update request sends all four
 *   fields and no partial-update rule is documented, so an edit resends the
 *   whole record.
 * - **The three state flags are never sent.** `isActive`, `isSelected` and
 *   `isLocked` are documented fields of the entity and of neither request body.
 *   They are set by the backend's auto-selection rule on a branch's first year,
 *   and thereafter only by the three dedicated lifecycle endpoints.
 */

/**
 * A wire date, as the `YYYY-MM-DD` a date input needs.
 *
 * The recorded samples are already `YYYY-MM-DD`, so the common path is a
 * pass-through. A full ISO timestamp is tolerated on **read** — the field is
 * typed `DateTime` nowhere in the documentation, but neither is it typed at
 * all, and truncating `2025-04-01T00:00:00.000Z` costs nothing while failing to
 * would leave the field empty. Anything else is passed through untouched rather
 * than coerced, so an unexpected format is visible instead of silently blanked.
 */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const [datePart] = value.split("T");
  return datePart ?? "";
}

/** Seed the form from a loaded academic year. */
export function toAcademicYearFormValues(
  year: AcademicYearDto,
): AcademicYearFormValues {
  return {
    ...academicYearFormDefaults(year.branchId),
    name: year.name,
    startDate: toDateInputValue(year.startDate),
    endDate: toDateInputValue(year.endDate),
  };
}

/**
 * Form values → the complete documented request body.
 *
 * Used for both create and update: Postman defines the two bodies identically.
 */
export function toAcademicYearRequest(
  values: AcademicYearFormValues,
): CreateAcademicYearRequest {
  return {
    name: values.name.trim(),
    startDate: values.startDate,
    endDate: values.endDate,
    branchId: values.branchId,
  };
}

/**
 * The year's span, as one readable line.
 *
 * Returns `null` rather than a half-formed range when either bound is missing
 * or unparseable — "1 Apr 2025 – Invalid Date" is worse than no caption at all.
 */
export function formatAcademicYearRange(
  year: Pick<AcademicYearDto, "startDate" | "endDate">,
): string | null {
  const start = formatDate(year.startDate);
  const end = formatDate(year.endDate);
  if (!start || !end) return null;
  return `${start} – ${end}`;
}
