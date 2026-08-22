/**
 * Wire shapes for `/v1/documents`, `/v1/document-requirements` and
 * `/v1/document-types`.
 *
 * Sourced from `docs/admission-lifecycle-module.md` §6 and directly verified
 * against `backend/postman/erp.postman_collection.json`'s "Document",
 * "Document Requirement" and "Document Type" folders — every request URL,
 * query parameter and request body below was read from a captured example,
 * not inferred. Document is generic and owner-polymorphic — not nested under
 * Admissions — so nothing here assumes `ownerType` is always `APPLICANT`.
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
 * A `Document` — confirmed shape via `POST /v1/documents` and
 * `GET /v1/documents/:id` (module doc §6.2): `id, organizationId, ownerType,
 * ownerId, documentTypeId, status, branchId, currentVersionId, expiresAt,
 * currentVersion`. `status` here is the documented `verificationStatus`
 * field, named `status` on the wire.
 *
 * `GET /v1/documents/:id` is named "Get One Document with Its Version
 * History" in the Postman collection, but its captured response schema
 * carries the exact same field list as every other document response —
 * no `versions[]` array. A full multi-version history list is therefore
 * **not confirmed** to exist on the wire (`docs/backend-gaps.md` DOC2); only
 * `currentVersion` is read.
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
 * `DocumentType` — confirmed field list via the "Create/Update/Get Document
 * Type" Postman examples: `id, code, name, description, isSensitive,
 * hasExpiry, allowedMimeTypes, maxSizeBytes, isActive, organizationId,
 * branchId, defaultValidityMonths, retentionYears`.
 *
 * `displayOrder` is a request-only field in the captured contract — it is
 * accepted by Create/Update but does **not** appear in either response
 * example's field list, so it is typed optional here and never relied on for
 * ordering when absent (`docs/backend-gaps.md` DOC5).
 *
 * Visibility follows the Admission Masters shape: nullable `organizationId`/
 * `branchId` (design spec §7) — system default, organization default, or
 * branch-specific.
 */
export interface DocumentTypeDto {
  id: string;
  organizationId?: string | null;
  branchId?: string | null;
  code: string;
  name: string;
  description: string | null;
  isSensitive: boolean;
  hasExpiry: boolean;
  defaultValidityMonths: number | null;
  retentionYears: number | null;
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  /** Request-only in the captured contract — see the type doc-comment. */
  displayOrder?: number;
  isActive: boolean;
}

/** Body for `POST /document-types` and `PATCH /document-types/:id`. */
export interface DocumentTypeRequest {
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
  /** Only the Update body documents this field — omitted on create. */
  isActive?: boolean;
}

/**
 * `DocumentRequirement` — the checklist definition table. Confirmed field
 * list via the "Create/Update/Get Document Requirement" Postman examples:
 * `id, organizationId, branchId, documentTypeId, appliesToProgramId,
 * appliesToQuotaId, appliesToCategoryId, requiredByStage, isMandatory,
 * isActive`. The `admissionType` axis in the original design is **not
 * implemented** — no field for it exists (design spec §8).
 *
 * Each `appliesTo*Id` is nullable, meaning "applies to all" (design spec
 * §8) — matched client-side in `utils/checklist.ts`.
 */
export interface DocumentRequirementDto {
  id: string;
  organizationId?: string;
  branchId: string;
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
 * Body for `POST /document-requirements` and `PATCH /document-requirements/:id`.
 * Create's captured example omits `isActive` (defaults server-side); Update's
 * includes it, matching every other "resend the complete record" module in
 * this codebase.
 */
export interface DocumentRequirementRequest {
  branchId: string;
  documentTypeId: string;
  appliesToProgramId: string | null;
  appliesToQuotaId: string | null;
  appliesToCategoryId: string | null;
  requiredByStage: string;
  isMandatory: boolean;
  isActive?: boolean;
}

/**
 * Multipart upload fields. Field names confirmed via the "Upload a Document"
 * Postman example's `formdata` body: `ownerType`, `ownerId`, `documentTypeId`
 * (`file` is the implicit multer field every other multipart route in this
 * codebase uses, not itself enumerated in the example's text-field list).
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
