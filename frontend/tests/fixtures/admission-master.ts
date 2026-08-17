import type { AdmissionMasterDto } from "@/features/admission-masters";

/**
 * Builder for an admission master record. Carries every field the collection
 * documents (`id, organizationId, branchId, code, name, description,
 * displayOrder, isActive, metadata, createdAt, updatedAt, deletedAt`) and
 * nothing else.
 */
export function admissionMasterDto(
  overrides: Partial<AdmissionMasterDto> = {},
): AdmissionMasterDto {
  return {
    id: "master-1",
    organizationId: "org-1",
    branchId: "branch-1",
    code: "O_POS",
    name: "O Positive",
    description: "The most common blood group.",
    displayOrder: 1,
    isActive: true,
    metadata: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

/** A second record, so ordering and filtering have something to act on. */
export function secondAdmissionMasterDto(
  overrides: Partial<AdmissionMasterDto> = {},
): AdmissionMasterDto {
  return admissionMasterDto({
    id: "master-2",
    code: "A_POS",
    name: "A Positive",
    description: "Common in South Asia.",
    displayOrder: 2,
    isActive: false,
    ...overrides,
  });
}
