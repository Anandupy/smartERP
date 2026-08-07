import { z } from "zod";

import { nonEmptyString } from "@/schemas";

import { NO_PARENT } from "../constants";

/**
 * Form schema for creating and editing an academic unit.
 *
 * The backend documents four groups of validation rules, and this schema
 * asserts the parts a browser can decide:
 *
 * | Rule group   | Documented as                                                  | Where it is enforced                                     |
 * | ------------ | -------------------------------------------------------------- | -------------------------------------------------------- |
 * | Existence    | Branch, Program and AcademicYear must strictly exist            | Structural — all three come from loaded, scoped data.    |
 * | Consistency  | A unit shares its parent's `branchId`, `programId`, `academicYearId` | Structural — the parent picker offers same-scope units only. |
 * | Tree         | Self-parenting and circular references prevented                 | The picker excludes the record and its descendants.       |
 * | Uniqueness   | Siblings sharing a parent and year must have unique names        | **Here**, as a courtesy — see below.                      |
 *
 * The uniqueness rule is checked by `findDuplicateSibling`, which warns rather
 * than blocks: the list it compares against is not guaranteed to be every unit
 * that exists — the doc's Best Practices describe soft deletes and no field
 * marks one — so the server remains the authority.
 *
 * Two fields are deliberately loose:
 *
 * - **`unitType` accepts any string.** The form's control is a select over the
 *   backend's nine values, so the UI cannot express anything else; the schema
 *   stays a plain string because it also validates records seeded from the
 *   wire, where an unrecognised value must round-trip rather than be rejected
 *   by the browser. The doc's warning against hardcoding logic for a level
 *   still holds — nothing branches on the value.
 * - **`metadata` is validated only as JSON**, because the doc describes it as
 *   the escape hatch for attributes that "don't need strict relational
 *   schemas" and names no keys at all.
 *
 * `level` is absent entirely: the doc forbids setting it.
 */

export const academicUnitFormSchema = z.object({
  branchId: nonEmptyString,
  programId: nonEmptyString,
  academicYearId: nonEmptyString,
  name: nonEmptyString,
  code: z.string().trim(),
  /** Free text. Six documented examples are suggestions, not a value set. */
  unitType: z.string().trim(),
  /**
   * Kept as a string because the control is a text input; an empty box means
   * "unset" and is sent as `null`. Validated as a non-negative integer when
   * present — a negative display order is meaningless, and that is the only
   * assertion the documented sample (`1`) supports.
   */
  displayOrder: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d+$/.test(value),
      "Enter a whole number, or leave blank",
    ),
  isActive: z.boolean(),
  /** `NONE` means the unit sits at the root of its program's structure. */
  parentId: z.string(),
  /**
   * Raw JSON text. Validated as parseable and as an object, and nothing more:
   * the documentation names example uses and no schema whatsoever.
   */
  metadata: z.string().refine((value) => {
    if (value.trim().length === 0) return true;
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
    } catch {
      return false;
    }
  }, "Enter a JSON object, or leave blank"),
});

export type AcademicUnitFormValues = z.infer<typeof academicUnitFormSchema>;

/** The minimum a sibling-uniqueness check needs to know about a unit. */
export interface SiblingIdentity {
  id: string;
  name: string;
  parentId?: string | null;
}

/**
 * The first sibling colliding with the documented uniqueness rule.
 *
 * "Siblings (nodes sharing the same parent and academic year) must have
 * strictly unique names." The academic year is implicit — the list is already
 * scoped to one — so this compares name within a parent.
 *
 * Comparison is case-insensitive and trims, because "Div A " and "div a"
 * colliding on the server while looking distinct in the UI is the confusing
 * outcome. `excludeId` skips the record being edited.
 */
export function findDuplicateSibling(
  existing: readonly SiblingIdentity[],
  candidate: { name: string; parentId: string | null },
  excludeId?: string,
): SiblingIdentity | null {
  const name = candidate.name.trim().toLowerCase();
  if (name.length === 0) return null;

  return (
    existing.find(
      (unit) =>
        unit.id !== excludeId &&
        (unit.parentId ?? null) === candidate.parentId &&
        unit.name.trim().toLowerCase() === name,
    ) ?? null
  );
}

/**
 * A blank academic unit.
 *
 * The three scope ids are seeded by the caller from the active workspace and
 * the chosen program. `isActive` starts `true` because the field is in the
 * request body with a documented sample of `true`, and a unit created inactive
 * would be invisible to everything that consumes the structure.
 */
export function academicUnitFormDefaults(scope: {
  branchId?: string;
  academicYearId?: string;
  programId?: string;
  parentId?: string | null;
} = {}): AcademicUnitFormValues {
  return {
    branchId: scope.branchId ?? "",
    programId: scope.programId ?? "",
    academicYearId: scope.academicYearId ?? "",
    name: "",
    code: "",
    unitType: "",
    displayOrder: "",
    isActive: true,
    parentId: scope.parentId ?? NO_PARENT,
    metadata: "",
  };
}
