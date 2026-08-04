import type { AcademicYearDto } from "@/features/academic-year";

/**
 * Builders for an academic year.
 *
 * Carries the four documented request fields plus the three documented state
 * flags, and nothing else — no `createdAt`, no `isDeleted`, no enrolment
 * counts, none of which the contract promises.
 *
 * The flags are set by default so the common case exercises a known state. The
 * specs that matter most pass a flag as `undefined` explicitly, because no
 * response body is documented and an absent flag is a real possibility the UI
 * has to survive.
 *
 * Dates use the documented `YYYY-MM-DD` format from the Postman sample.
 */
export function academicYearDto(
  overrides: Partial<AcademicYearDto> = {},
): AcademicYearDto {
  return {
    id: "ay-1",
    branchId: "branch-1",
    name: "2025-26",
    startDate: "2025-04-01",
    endDate: "2026-03-31",
    isActive: true,
    isSelected: true,
    isLocked: false,
    ...overrides,
  };
}

/**
 * An earlier year, finished and locked.
 *
 * Gives ordering, filtering and the "locked blocks everything" rules something
 * real to act on, and does not overlap the default fixture — the backend
 * documents that two years in one branch may not.
 */
export function lockedAcademicYearDto(
  overrides: Partial<AcademicYearDto> = {},
): AcademicYearDto {
  return academicYearDto({
    id: "ay-2",
    name: "2024-25",
    startDate: "2024-04-01",
    endDate: "2025-03-31",
    isActive: true,
    isSelected: false,
    isLocked: true,
    ...overrides,
  });
}

/** A future year: created but not yet activated or selected. */
export function upcomingAcademicYearDto(
  overrides: Partial<AcademicYearDto> = {},
): AcademicYearDto {
  return academicYearDto({
    id: "ay-3",
    name: "2026-27",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    isActive: false,
    isSelected: false,
    isLocked: false,
    ...overrides,
  });
}
