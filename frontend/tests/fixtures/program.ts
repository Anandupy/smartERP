import type { ProgramDto } from "@/features/program";

/**
 * Builders for a program.
 *
 * Carries the six documented request fields plus `isActive`, which the status
 * toggle endpoint implies, and nothing else — no `createdAt`, no enrolment
 * counts, none of which the contract promises.
 *
 * `level` is included because Postman sends it, and its value is the one
 * recorded sample. Specs that care about the docs/Postman mismatch set it
 * explicitly.
 */
export function programDto(overrides: Partial<ProgramDto> = {}): ProgramDto {
  return {
    id: "program-1",
    branchId: "branch-1",
    name: "Higher Secondary Science",
    level: "SCHOOL",
    medium: "English",
    stream: "Science (PCM)",
    parentId: null,
    isActive: true,
    ...overrides,
  };
}

/** A second top-level program, so ordering and filtering have something to do. */
export function secondProgramDto(
  overrides: Partial<ProgramDto> = {},
): ProgramDto {
  return programDto({
    id: "program-2",
    name: "Commerce",
    medium: "English",
    stream: "Commerce",
    ...overrides,
  });
}

/** A child of the first program, for the hierarchy and delete-rule specs. */
export function childProgramDto(
  overrides: Partial<ProgramDto> = {},
): ProgramDto {
  return programDto({
    id: "program-3",
    name: "Physics Elective",
    parentId: "program-1",
    // Distinct medium/stream so it does not collide with its parent under the
    // documented uniqueness rule.
    medium: "English",
    stream: "Physics",
    ...overrides,
  });
}
