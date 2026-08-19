/**
 * Wire shapes for `/v1/documents`, `/v1/document-requirements` and
 * `/v1/document-types`.
 *
 * Sourced entirely from `docs/admission-lifecycle-module.md` §6 — the
 * Documents module (R5, "foundation only"). Document is generic and
 * owner-polymorphic — not nested under Admissions — so nothing here assumes
 * `ownerType` is always `APPLICANT`.
 */

/** As-shipped `ownerType` enum — confirmed via `POST /v1/documents` (module doc §6.1). */
export const DOCUMENT_OWNER_TYPES = [
  "PERSON",
  "APPLICANT",
  "ADMISSION",
  "ENROLLMENT",
  "STUDENT",
  "ORGANIZATION",
  "BRANCH",
] as const;

export type DocumentOwnerType = (typeof DOCUMENT_OWNER_TYPES)[number];

/**
 * Confirmed vocabulary (module doc §6.3) — no `MISSING` value exists. A
 * missing requirement is the *absence* of a satisfying `VERIFIED` version,
 * computed client-side in `utils/checklist.ts` for display, never sent as a
 * status.
 */
export const DOCUMENT_VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;

export type DocumentVerificationStatus =
  (typeof DOCUMENT_VERIFICATION_STATUSES)[number];

/** `DocumentVersion.scanStatus` — a separate, four-value vocabulary (module doc §6.3). */
export const DOCUMENT_SCAN_STATUSES = [
  "PENDING",
  "CLEAN",
  "INFECTED",
  "FAILED",
] as const;

export type DocumentScanStatus = (typeof DOCUMENT_SCAN_STATUSES)[number];

/**
 * One document version. Append-only; a rejected/replaced version is
 * retained, never deleted (module doc §6.2). Field list from the design
 * spec's confirmed shape — not every field is expanded in the one captured
 * Postman example, so this is read defensively downstream.
 */
export interface DocumentVersionDto {
  id: string;
  versionNumber: number;
  fileName?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  scanStatus: DocumentScanStatus;
  scannedAt?: string | null;
  uploadedBy?: string | null;
  uploadedAt?: string | null;
  supersededAt?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
}

/**
 * A `Document` — confirmed shape via `POST /v1/documents` (module doc §6.2):
 * `id, organizationId, ownerType, ownerId, documentTypeId, status, branchId,
 * currentVersionId, expiresAt, currentVersion`. `status` here is the
 * documented `verificationStatus` field, named `status` on the wire.
 */
export interface DocumentDto {
  id: string;
  organizationId: string;
  branchId?: string | null;
  ownerType: DocumentOwnerType;
  ownerId: string;
  documentTypeId: string;
  status: DocumentVerificationStatus;
  currentVersionId: string | null;
  expiresAt: string | null;
  currentVersion?: DocumentVersionDto;
}

/**
 * `DocumentType` — confirmed field list (module doc §6.1): `code, name,
 * description, isSensitive, hasExpiry, defaultValidityMonths, retentionYears,
 * allowedMimeTypes, maxSizeBytes, displayOrder, isActive`.
 */
export interface DocumentTypeDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSensitive: boolean;
  hasExpiry: boolean;
  defaultValidityMonths: number | null;
  retentionYears: number | null;
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  displayOrder: number;
  isActive: boolean;
}

/**
 * `DocumentRequirement` — the checklist definition table (module doc §6.4):
 * `documentTypeId, appliesToProgramId, appliesToQuotaId, appliesToCategoryId,
 * requiredByStage, isMandatory, isActive`. The `admissionType` axis in the
 * original design is **not implemented** — no field for it exists.
 */
export interface DocumentRequirementDto {
  id: string;
  documentTypeId: string;
  appliesToProgramId: string | null;
  appliesToQuotaId: string | null;
  appliesToCategoryId: string | null;
  /** Reuses `AdmissionApplicationStatus` directly — not a parallel enum. */
  requiredByStage: string;
  isMandatory: boolean;
  isActive: boolean;
  documentType?: DocumentTypeDto;
}

/**
 * Multipart upload fields. **Unconfirmed by Postman** (module doc §6.7,
 * `backend-gaps.md` DOC1 — the example body is multipart, not raw JSON, and
 * this extraction pass could not parse it). `file`/`ownerType`/`ownerId`/
 * `documentTypeId` follow the overwhelming NestJS/multer convention; verify
 * against a live request before relying on the exact field names.
 */
export interface UploadDocumentFields {
  file: File;
  ownerType: DocumentOwnerType;
  ownerId: string;
  documentTypeId: string;
}

/** Body for `POST /documents/:id/reject`. Reason is required. */
export interface RejectDocumentRequest {
  reason: string;
}

/** Body for `POST /documents/:id/archive`. */
export interface ArchiveDocumentRequest {
  reason: string;
}
