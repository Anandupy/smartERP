import type { NumberingConfigDto } from "@/features/numbering";

/** Builder for a `NumberingConfig` record — every field the collection documents. */
export function numberingConfigDto(
  overrides: Partial<NumberingConfigDto> = {},
): NumberingConfigDto {
  return {
    id: "config-1",
    organizationId: "org-1",
    branchId: null,
    scope: "ORGANIZATION",
    purpose: "STUDENT_CODE",
    allocationMode: "MONOTONIC",
    prefix: "STU",
    suffix: null,
    includeBranchCode: false,
    includeAcademicYear: false,
    sequencePadding: 10,
    format: "{prefix}{sequence}",
    yearFormat: "NAME",
    resetStrategy: "NEVER",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

/** A second record, so filtering has something to act on. */
export function secondNumberingConfigDto(
  overrides: Partial<NumberingConfigDto> = {},
): NumberingConfigDto {
  return numberingConfigDto({
    id: "config-2",
    branchId: "branch-1",
    scope: "BRANCH",
    purpose: "ADMISSION_NO",
    allocationMode: "MONOTONIC",
    prefix: "ADM",
    includeBranchCode: true,
    includeAcademicYear: true,
    sequencePadding: 4,
    format: "{prefix}-{year}-{sequence}",
    yearFormat: "FULL_START",
    resetStrategy: "YEARLY",
    isActive: false,
    ...overrides,
  });
}
