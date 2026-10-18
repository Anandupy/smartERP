import { z } from "zod";

import { nonEmptyString } from "@/schemas";

import { NO_LEVEL, NO_PARENT } from "../constants";
import { PROGRAM_LEVELS } from "../types/program.dto";

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
 * the list it compares against excludes soft-deleted programs and may be stale.
 * It catches the common mistake while the form is open and says the server
 * decides.
 *
 * `level` is one of the three `PROGRAM_LEVELS` or unset (`NO_LEVEL`) — a
 * Prisma enum, so anything else is rejected server-side (H1). `medium` and
 * `stream` have no documented format, length or vocabulary, so none is imposed.
 */
export const programFormSchema = z.object({
  branchId: nonEmptyString,
  name: nonEmptyString,
  /** One of `PROGRAM_LEVELS`, or `NO_LEVEL`. */
  level: z.union([z.enum(PROGRAM_LEVELS), z.literal(NO_LEVEL), z.literal("")]),
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
 * top-level program is the ordinary case. Nothing else is pre-filled: a
 * default `level` would put `SCHOOL` into a university's record.
 */
export function programFormDefaults(branchId = ""): ProgramFormValues {
  return {
    branchId,
    name: "",
    level: NO_LEVEL,
    medium: "",
    stream: "",
    parentId: NO_PARENT,
  };
}
