import { buildTree, collectDescendantIds, type TreeResult } from "@/utils";

import { programState } from "../constants";
import type { ProgramDto } from "../types/program.dto";

/**
 * The program hierarchy, built with the shared helpers.
 *
 * Nothing here re-implements tree building — `@/utils/tree` owns that, and
 * Academic Unit uses the same functions. What lives here is only the part that
 * is about *programs*: which field is the parent, how siblings order, and what
 * the two documented hierarchy rules mean for the UI.
 */

/** How the shared helpers read a program. */
export const programAccessors = {
  getId: (program: ProgramDto) => program.id,
  getParentId: (program: ProgramDto) => program.parentId,
  /**
   * Siblings order by name. The endpoints document no `sortBy` and no
   * `displayOrder` field — unlike Academic Unit, which has one — so ordering is
   * the client's to choose and should at least be deterministic between
   * renders.
   */
  compare: (a: ProgramDto, b: ProgramDto) => a.name.localeCompare(b.name),
} as const;

/** Build the program tree from the flat list. */
export function buildProgramTree(
  programs: readonly ProgramDto[],
): TreeResult<ProgramDto> {
  return buildTree(programs, programAccessors);
}

/**
 * Parents a program may legally be given, per the two documented rules.
 *
 * - **Rule 2, same-branch hierarchy:** the candidate list is already one
 *   branch's, because that is the only way the endpoint returns programs — so
 *   the rule is satisfied structurally rather than by a check.
 * - **Rule 3, circular prevention:** a program may not be its own parent, nor
 *   the child of any of its own descendants. Both are excluded here so the
 *   picker cannot offer a choice the server will refuse.
 *
 * `programId` is omitted when creating, where nothing is excluded because the
 * record does not exist yet.
 */
export function eligibleParents(
  programs: readonly ProgramDto[],
  programId?: string,
): ProgramDto[] {
  if (!programId) return [...programs];

  const descendants = collectDescendantIds(
    programs,
    programAccessors,
    programId,
  );

  return programs.filter(
    (program) => program.id !== programId && !descendants.has(program.id),
  );
}

/** Direct children of a program. */
export function childrenOf(
  programs: readonly ProgramDto[],
  programId: string,
): ProgramDto[] {
  return programs.filter((program) => program.parentId === programId);
}

/**
 * Why this program cannot be deleted, or `null` when it can.
 *
 * Documented validation rule 4: "A program cannot be deleted if it has active
 * child programs." The check is deliberately narrow — it counts children whose
 * `isActive` is **explicitly true**, because a child whose flag was not
 * reported is not evidence of an active child, and blocking on it would make
 * deletion impossible for any backend that omits the field.
 *
 * The server remains the authority. This exists so the UI can explain the
 * refusal *before* it happens, naming the children responsible.
 */
export function deleteBlockedReason(
  programs: readonly ProgramDto[],
  programId: string,
): string | null {
  const active = childrenOf(programs, programId).filter(
    (child) => programState(child) === "active",
  );

  if (active.length === 0) return null;

  const names = active
    .slice(0, 3)
    .map((child) => `“${child.name}”`)
    .join(", ");
  const more = active.length > 3 ? ` and ${active.length - 3} more` : "";

  return `This program has ${active.length} active child ${
    active.length === 1 ? "program" : "programs"
  } — ${names}${more}. The API refuses to delete a program while any child is active.`;
}
