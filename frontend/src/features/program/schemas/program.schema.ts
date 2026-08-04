import { z } from "zod";

import { nonEmptyString } from "@/schemas";

import { NO_PARENT } from "../constants";

/**
 * Form schema for creating and editing a program.
 *
 * The backend documents **four** validation rules, and this schema asserts none
 * of them outright — which is deliberate, because not one can be decided by a
 * browser alone:
 *
 * | # | Rule                                                   | Where it is enforced                       |
 * | - | ------------------------------------------------------ | ------------------------------------------ |
 * | 1 | `branchId + name + medium + stream` unique per branch   | Server. Checked here as a courtesy.        |
 * | 2 | A child must share its parent's branch                  | Structural — the picker only offers same-branch parents. |
 * | 3 | No circular parent-child loops                          | The picker excludes self and descendants.  |
 * | 4 | Cannot delete a program with active children             | The UI withholds delete and names them.    |
 *
 * Rule 1 is a **courtesy check** (`findDuplicateProgram`), not an authority:
 * the list it compares against is not guaranteed to be every program that
 * exists — the endpoint documents a soft delete and no flag for it. It catches
 * the common mistake while the form is open and says the server decides.
 *
 * Nothing else is asserted. `level`, `medium` and `stream` have no documented
 * format, length or vocabulary — `level`'s only recorded sample is `"SCHOOL"`,
 * and it is absent from the module doc entirely — so imposing one would reject
 * a legitimate value with no backend to blame.
 */
export const programFormSchema = z.object({
  branchId: nonEmptyString,
  name: nonEmptyString,
  /** Postman-only field. Free text: one sample is not a value set. */
  level: z.string().trim(),
  medium: z.string().trim(),
  stream: z.string().trim(),
  /** `NONE` means the program sits at the top level. */
  parentId: z.string(),
});

export type ProgramFormValues = z.infer<typeof programFormSchema>;

/** The minimum a duplicate check needs to know about an existing program. */
export interface ProgramIdentity {
  id: string;
  name: string;
  medium?: string | null;
  stream?: string | null;
}

/** Normalizes an optional identity part for comparison. */
function key(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * The first program that collides with the documented uniqueness rule.
 *
 * Rule 1 is the combination of `branchId`, `name`, `medium` and `stream` — the
 * branch is implicit, since the list is already scoped to one. Comparison is
 * case-insensitive and trims, because "Primary " and "primary" colliding on the
 * server while looking distinct in the UI is the confusing outcome.
 *
 * `excludeId` skips the record being edited, which otherwise always collides
 * with itself.
 */
export function findDuplicateProgram(
  existing: readonly ProgramIdentity[],
  candidate: { name: string; medium: string; stream: string },
  excludeId?: string,
): ProgramIdentity | null {
  const name = key(candidate.name);
  if (name.length === 0) return null;

  return (
    existing.find(
      (program) =>
        program.id !== excludeId &&
        key(program.name) === name &&
        key(program.medium) === key(candidate.medium) &&
        key(program.stream) === key(candidate.stream),
    ) ?? null
  );
}

/**
 * A blank program.
 *
 * `branchId` is seeded by the caller from the active workspace, and `parentId`
 * starts at "no parent" — the documentation calls the hierarchy optional, so a
 * top-level program is the ordinary case. Nothing else is pre-filled: seeding
 * `level` with the Postman sample would put `SCHOOL` into a university's
 * record.
 */
export function programFormDefaults(branchId = ""): ProgramFormValues {
  return {
    branchId,
    name: "",
    level: "",
    medium: "",
    stream: "",
    parentId: NO_PARENT,
  };
}
