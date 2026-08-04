import { buildTree, collectDescendantIds, type TreeResult } from "@/utils";

import { academicUnitState } from "../constants";
import type { AcademicUnitDto } from "../types/academic-unit.dto";

/**
 * The academic-unit hierarchy, built with the shared helpers.
 *
 * Nothing here re-implements tree building — `@/utils/tree` owns that, and
 * Program uses the same functions. What lives here is only the part that is
 * about *academic units*: how siblings order, and what the documented
 * consistency and tree rules mean for the move control.
 */

/** How the shared helpers read a unit. */
export const academicUnitAccessors = {
  getId: (unit: AcademicUnitDto) => unit.id,
  getParentId: (unit: AcademicUnitDto) => unit.parentId,
  /**
   * Siblings order by `displayOrder`, then by name.
   *
   * Unlike Program, this module has a documented ordering field — so it is
   * honoured, and name is only the tie-break. Units with no `displayOrder`
   * sort **after** those that have one rather than being treated as `0`, which
   * would jump an unordered unit to the front of a deliberately ordered list.
   */
  compare: (a: AcademicUnitDto, b: AcademicUnitDto) => {
    const orderA = typeof a.displayOrder === "number" ? a.displayOrder : null;
    const orderB = typeof b.displayOrder === "number" ? b.displayOrder : null;

    if (orderA !== orderB) {
      if (orderA === null) return 1;
      if (orderB === null) return -1;
      return orderA - orderB;
    }

    return a.name.localeCompare(b.name);
  },
} as const;

/** Build the unit tree from the flat list. */
export function buildAcademicUnitTree(
  units: readonly AcademicUnitDto[],
): TreeResult<AcademicUnitDto> {
  return buildTree(units, academicUnitAccessors);
}

/**
 * Parents a unit may legally be given.
 *
 * Two documented rule groups converge here, and both are enforced by narrowing
 * the options rather than by validating a choice after the fact:
 *
 * - **Consistency:** "An academic unit must share the same `branchId`,
 *   `programId`, and `academicYearId` as its parent." Branch and year are
 *   already fixed by the scope the list was fetched with, so only the program
 *   has to be matched — and it is, strictly.
 * - **Tree:** "Self-parenting and circular references are actively prevented
 *   during move and creation operations." The record itself and every one of
 *   its descendants are excluded.
 *
 * `unitId` is omitted when creating, where nothing is excluded because the
 * record does not exist yet.
 */
export function eligibleParents(
  units: readonly AcademicUnitDto[],
  programId: string,
  unitId?: string,
): AcademicUnitDto[] {
  const sameProgram = units.filter((unit) => unit.programId === programId);

  if (!unitId) return sameProgram;

  const descendants = collectDescendantIds(
    units,
    academicUnitAccessors,
    unitId,
  );

  return sameProgram.filter(
    (unit) => unit.id !== unitId && !descendants.has(unit.id),
  );
}

/** Direct children of a unit. */
export function childrenOf(
  units: readonly AcademicUnitDto[],
  unitId: string,
): AcademicUnitDto[] {
  return units.filter((unit) => unit.parentId === unitId);
}

/**
 * Why this unit cannot be deleted, or `null` when it can.
 *
 * Documented in Best Practices: "The engine prevents deleting parent nodes if
 * active children exist." The check counts children whose `isActive` is
 * **explicitly true** — a child whose flag was not reported is not evidence of
 * an active child, and blocking on it would make deletion impossible against
 * any backend that omits the field.
 *
 * The server remains the authority. This exists so the UI can explain the
 * refusal before it happens, naming the children responsible.
 */
export function deleteBlockedReason(
  units: readonly AcademicUnitDto[],
  unitId: string,
): string | null {
  const active = childrenOf(units, unitId).filter(
    (child) => academicUnitState(child) === "active",
  );

  if (active.length === 0) return null;

  const names = active
    .slice(0, 3)
    .map((child) => `“${child.name}”`)
    .join(", ");
  const more = active.length > 3 ? ` and ${active.length - 3} more` : "";

  return `This unit has ${active.length} active ${
    active.length === 1 ? "child" : "children"
  } — ${names}${more}. The engine refuses to delete a parent node while any child is active.`;
}

/**
 * The depth this unit sits at, preferring the server's own figure.
 *
 * The doc defines `level` as auto-calculated from 0 at the roots, so when the
 * backend reports it, that is the answer. When it does not — no response body
 * is documented — the depth is derived from the tree the client just built,
 * which computes the same thing from `parentId`.
 */
export function resolveLevel(
  unit: AcademicUnitDto,
  derivedDepth: number,
): number {
  return typeof unit.level === "number" ? unit.level : derivedDepth;
}
