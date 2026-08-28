import type { AcademicUnitDto } from "@/features/academic-unit";

/**
 * Builders for an academic unit.
 *
 * Carries the ten documented request fields plus `level`, which the doc
 * describes as server-computed. Nothing else — no `createdAt`, no enrolment
 * counts.
 *
 * The scope ids match the workspace fixtures, so a rendered screen resolves the
 * same branch and academic year the store is seeded with.
 *
 * `displayPath` and `isPlacementTarget` default to the values a real
 * `GET /academic-units` response carries for a root unit with no children — a
 * leaf on its own is a placement target; see `childUnitDto` for a unit with a
 * parent, and note a root with children (as `academicUnitDto` becomes once
 * `childUnitDto` is also in a fixture list) is structural in reality, so tests
 * combining a parent with its children should override `isPlacementTarget:
 * false` on the parent explicitly rather than relying on this default.
 */
export function academicUnitDto(
  overrides: Partial<AcademicUnitDto> = {},
): AcademicUnitDto {
  return {
    id: "unit-1",
    branchId: "branch-1",
    programId: "program-1",
    academicYearId: "ay-2026",
    parentId: null,
    name: "Std 1",
    code: "HHS-001",
    unitType: "CLASS",
    displayOrder: 1,
    isActive: true,
    metadata: null,
    level: 0,
    displayPath: "Std 1",
    isPlacementTarget: true,
    ...overrides,
  };
}

/** A child of the first unit — the doc's own School example. */
export function childUnitDto(
  overrides: Partial<AcademicUnitDto> = {},
): AcademicUnitDto {
  return academicUnitDto({
    id: "unit-2",
    name: "Div A",
    code: "HHS-001-A",
    unitType: "DIVISION",
    parentId: "unit-1",
    displayOrder: 1,
    level: 1,
    displayPath: "Std 1 → Div A",
    isPlacementTarget: true,
    ...overrides,
  });
}

/** A second child, so sibling ordering and uniqueness have something to act on. */
export function secondChildUnitDto(
  overrides: Partial<AcademicUnitDto> = {},
): AcademicUnitDto {
  return childUnitDto({
    id: "unit-3",
    name: "Div B",
    code: "HHS-001-B",
    displayOrder: 2,
    displayPath: "Std 1 → Div B",
    ...overrides,
  });
}
