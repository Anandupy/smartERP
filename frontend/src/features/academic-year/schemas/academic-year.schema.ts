import { z } from "zod";

import { nonEmptyString } from "@/schemas";

/**
 * Form schema for creating and editing an academic year.
 *
 * The backend documents **five** validation rules, and this schema asserts the
 * one that a browser can decide on its own:
 *
 * | # | Rule                                             | Where it is enforced                          |
 * | - | ------------------------------------------------ | --------------------------------------------- |
 * | 1 | `startDate` must be before `endDate`             | **Here** — the form knows both values.        |
 * | 2 | No overlapping ranges within the same branch     | Here *and* the server (see below).            |
 * | 3 | Only one `isSelected` year per branch            | Server. There is no client equivalent.        |
 * | 4 | Locked years cannot be modified or deleted       | The UI withholds the action; server enforces. |
 * | 5 | The selected year cannot be deleted              | The UI withholds the action; server enforces. |
 *
 * Rule 2 is checked here as a **courtesy**, not as an authority: the overlap
 * check runs against the years the list endpoint returned, which is not
 * necessarily every year that exists — the documentation does not say whether
 * soft-deleted years are excluded, and there is no `isDeleted` field to test.
 * So the client check catches the common mistake early, and the server remains
 * the one that decides. It is a separate refinement (`withoutOverlap`) rather
 * than part of the base schema, so the base can be used where the list is not
 * loaded.
 *
 * Nothing else is asserted. `name` has no documented format — the only recorded
 * sample is `"2025-26"` — so no pattern is imposed. Inventing one would reject
 * `"Academic Year 2025 (Spring Intake)"` with no backend to blame.
 */

/** The documented wire format: the recorded samples are `YYYY-MM-DD`. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dateField = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(ISO_DATE, "Use the YYYY-MM-DD format");

export const academicYearFormSchema = z
  .object({
    branchId: nonEmptyString,
    name: nonEmptyString,
    startDate: dateField,
    endDate: dateField,
  })
  .superRefine((values, ctx) => {
    // Documented validation rule 1. Compared as strings deliberately:
    // `YYYY-MM-DD` sorts lexicographically in date order, so this needs no
    // timezone and cannot be shifted by the operator's locale.
    if (
      ISO_DATE.test(values.startDate) &&
      ISO_DATE.test(values.endDate) &&
      values.startDate >= values.endDate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "The end date must fall after the start date",
      });
    }
  });

export type AcademicYearFormValues = z.infer<typeof academicYearFormSchema>;

/** The minimum an overlap check needs to know about an existing year. */
export interface DateRange {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

/**
 * The first year in `existing` whose range overlaps `[startDate, endDate]`.
 *
 * Documented validation rule 2, evaluated in the client so the user learns
 * about the clash while the form is still open rather than after a round trip.
 * Two ranges overlap when each starts on or before the other ends — the
 * standard interval test, with inclusive bounds because the documentation
 * describes a year by its first and last day, not by a half-open range.
 *
 * `excludeId` skips the record being edited, which otherwise always overlaps
 * itself.
 */
export function findOverlappingYear(
  existing: readonly DateRange[],
  range: { startDate: string; endDate: string },
  excludeId?: string,
): DateRange | null {
  if (!ISO_DATE.test(range.startDate) || !ISO_DATE.test(range.endDate)) {
    return null;
  }

  return (
    existing.find(
      (year) =>
        year.id !== excludeId &&
        ISO_DATE.test(year.startDate) &&
        ISO_DATE.test(year.endDate) &&
        range.startDate <= year.endDate &&
        year.startDate <= range.endDate,
    ) ?? null
  );
}

/**
 * A blank academic year.
 *
 * `branchId` is seeded by the caller from the active workspace. Nothing else is
 * pre-filled: seeding the dates from the Postman sample would put an Indian
 * April–March academic calendar into a school whose year runs September–July,
 * and a wrong default that looks deliberate is worse than an empty field.
 */
export function academicYearFormDefaults(
  branchId = "",
): AcademicYearFormValues {
  return { branchId, name: "", startDate: "", endDate: "" };
}
