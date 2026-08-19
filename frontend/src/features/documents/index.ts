/**
 * Public surface of the Documents module.
 *
 * Scope: `Document`, `DocumentVersion`, `DocumentType` (read-only —
 * consumed, not administered here) and `DocumentRequirement` (also
 * read-only) — sourced from `docs/admission-lifecycle-module.md` §6, the R5
 * "foundation only" release.
 *
 * **Generic and owner-polymorphic**, not Applicant-specific — every hook and
 * component takes an explicit `ownerType`/`ownerId` rather than assuming
 * `APPLICANT`, matching the backend's own design. `ApplicantDocumentsPanel`
 * is the one Applicant-flavoured composition of the generic pieces.
 *
 * **One real unconfirmed shape**: the multipart upload's exact field names
 * (`docs/backend-gaps.md` DOC1) — see `api/document.service.ts`'s own note.
 *
 * **Not built**: admin CRUD for `DocumentType`/`DocumentRequirement`
 * themselves — that is a separate "Document Masters" concern, analogous to
 * Admission Masters, and out of this phase's scope. Both are only read here.
 */

// Screens / panels
export {
  ApplicantDocumentsPanel,
  type ApplicantDocumentsPanelProps,
} from "./components/applicant-documents-panel";

// Composable pieces
export {
  DocumentChecklist,
  type DocumentChecklistProps,
} from "./components/document-checklist";
export { DocumentRow, type DocumentRowProps } from "./components/document-row";
export {
  DocumentStatusBadge,
  type DocumentStatusBadgeProps,
} from "./components/document-status-badge";
export {
  RejectDocumentDialog,
  type RejectDocumentDialogProps,
} from "./components/reject-document-dialog";
export {
  UploadDocumentDialog,
  type UploadDocumentDialogProps,
} from "./components/upload-document-dialog";

// Backend integration
export { documentService } from "./api/document.service";
export { documentKeys } from "./api/document.keys";
export {
  useArchiveDocument,
  useDocumentRequirements,
  useDocumentTypes,
  useDownloadDocument,
  useOwnerDocuments,
  useRejectDocument,
  useReplaceDocument,
  useUploadDocument,
  useVerifyDocument,
} from "./hooks/use-documents";

// Domain logic
export {
  buildChecklist,
  checklistSummary,
  type ChecklistItem,
  type ChecklistItemState,
} from "./utils/checklist";

// Contracts
export {
  DOCUMENT_OWNER_TYPES,
  DOCUMENT_SCAN_STATUSES,
  DOCUMENT_VERIFICATION_STATUSES,
  type ArchiveDocumentRequest,
  type DocumentDto,
  type DocumentOwnerType,
  type DocumentRequirementDto,
  type DocumentScanStatus,
  type DocumentTypeDto,
  type DocumentVerificationStatus,
  type DocumentVersionDto,
  type RejectDocumentRequest,
  type UploadDocumentFields,
} from "./types/document.dto";
export {
  SCAN_STATUS_LABEL,
  SCAN_STATUS_TONE,
  VERIFICATION_STATUS_LABEL,
  VERIFICATION_STATUS_TONE,
} from "./constants";
