import type {
  DocumentDto,
  DocumentRequirementDto,
  DocumentTypeDto,
} from "@/features/documents";

/** Builder for a `DocumentType` record — every field the collection documents. */
export function documentTypeDto(
  overrides: Partial<DocumentTypeDto> = {},
): DocumentTypeDto {
  return {
    id: "type-1",
    organizationId: "org-1",
    branchId: "branch-1",
    code: "BIRTH_CERTIFICATE",
    name: "Birth Certificate",
    description: "Proof of date of birth.",
    isSensitive: false,
    hasExpiry: false,
    defaultValidityMonths: null,
    retentionYears: 7,
    allowedMimeTypes: ["application/pdf", "image/jpeg"],
    maxSizeBytes: 10 * 1024 * 1024,
    displayOrder: 1,
    isActive: true,
    ...overrides,
  };
}

/** A second record, so ordering and filtering have something to act on. */
export function secondDocumentTypeDto(
  overrides: Partial<DocumentTypeDto> = {},
): DocumentTypeDto {
  return documentTypeDto({
    id: "type-2",
    code: "PASSPORT",
    name: "Passport",
    description: "Government-issued passport.",
    isSensitive: true,
    displayOrder: 2,
    isActive: false,
    ...overrides,
  });
}

/** Builder for a `DocumentRequirement` record. */
export function documentRequirementDto(
  overrides: Partial<DocumentRequirementDto> = {},
): DocumentRequirementDto {
  return {
    id: "requirement-1",
    organizationId: "org-1",
    branchId: "branch-1",
    documentTypeId: "type-1",
    appliesToProgramId: null,
    appliesToQuotaId: null,
    appliesToCategoryId: null,
    requiredByStage: "DRAFT",
    isMandatory: true,
    isActive: true,
    ...overrides,
  };
}

export function secondDocumentRequirementDto(
  overrides: Partial<DocumentRequirementDto> = {},
): DocumentRequirementDto {
  return documentRequirementDto({
    id: "requirement-2",
    documentTypeId: "type-2",
    appliesToProgramId: "program-1",
    requiredByStage: "SUBMITTED",
    isMandatory: false,
    isActive: false,
    ...overrides,
  });
}

/** Builder for a `Document` record. */
export function documentDto(overrides: Partial<DocumentDto> = {}): DocumentDto {
  return {
    id: "document-1",
    organizationId: "org-1",
    branchId: "branch-1",
    ownerType: "APPLICANT",
    ownerId: "applicant-1",
    documentTypeId: "type-1",
    status: "PENDING",
    currentVersionId: "version-1",
    expiresAt: null,
    currentVersion: {
      id: "version-1",
      versionNumber: 1,
      fileName: "birth-certificate.pdf",
      mimeType: "application/pdf",
      sizeBytes: 102400,
      scanStatus: "CLEAN",
      uploadedAt: "2026-01-01T00:00:00.000Z",
    },
    ...overrides,
  };
}
