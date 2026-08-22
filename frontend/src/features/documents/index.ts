/**
 * Public surface of the Documents module.
 *
 * Scope: `Document`, `DocumentVersion`, `DocumentType` and
 * `DocumentRequirement` — sourced from `docs/admission-lifecycle-module.md`
 * §6 and directly verified against `backend/postman/erp.postman_collection.json`'s
 * "Document", "Document Type" and "Document Requirement" folders
 * (`docs/documents-management-module.md`).
 *
 * **Generic and owner-polymorphic**, not Applicant-specific — every hook and
 * component takes an explicit `ownerType`/`ownerId` rather than assuming
 * `APPLICANT`, matching the backend's own design. `ApplicantDocumentsPanel`
 * is the one Applicant-flavoured composition of the generic pieces.
 *
 * **Full admin CRUD for `DocumentType` and `DocumentRequirement`** — both
 * were read-only in the R5 foundation phase; this milestone confirmed
 * Create/Update/Delete for both directly against the Postman collection and
 * built their directories, forms and detail screens. `DocumentRequirement`'s
 * form takes Program/Quota/Category picker slots rather than importing
 * Program or Admission Masters — filled in by the route composition
 * (AGENTS.md §28), the same seam Admissions itself uses.
 */

// Screens / panels — owner documents
export {
  ApplicantDocumentsPanel,
  type ApplicantDocumentsPanelProps,
} from "./components/applicant-documents-panel";

// Screens — Document Types
export { DocumentTypeListScreen } from "./components/document-type-list-screen";
export { CreateDocumentTypeScreen } from "./components/create-document-type-screen";
export {
  EditDocumentTypeScreen,
  type EditDocumentTypeScreenProps,
} from "./components/edit-document-type-screen";
export {
  DocumentTypeDetailScreen,
  type DocumentTypeDetailScreenProps,
} from "./components/document-type-detail-screen";

// Screens — Document Requirements
export {
  DocumentRequirementListScreen,
  type DocumentRequirementListScreenProps,
} from "./components/document-requirement-list-screen";
export {
  CreateDocumentRequirementScreen,
  type CreateDocumentRequirementScreenProps,
} from "./components/create-document-requirement-screen";
export {
  EditDocumentRequirementScreen,
  type EditDocumentRequirementScreenProps,
} from "./components/edit-document-requirement-screen";

// Screens — hub
export { DocumentsOverviewScreen } from "./components/documents-overview-screen";

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
export {
  DocumentTypeForm,
  type DocumentTypeFormProps,
} from "./components/document-type-form";
export {
  DocumentTypesTable,
  type DocumentTypesTableProps,
} from "./components/document-types-table";
export {
  DeleteDocumentTypeDialog,
  ToggleDocumentTypeActiveDialog,
  type DeleteDocumentTypeDialogProps,
  type ToggleDocumentTypeActiveDialogProps,
} from "./components/document-type-dialogs";
export {
  DocumentRequirementForm,
  type DocumentRequirementFormProps,
} from "./components/document-requirement-form";
export {
  DocumentRequirementsTable,
  type DocumentRequirementsTableProps,
} from "./components/document-requirements-table";
export {
  DeleteDocumentRequirementDialog,
  ToggleDocumentRequirementActiveDialog,
  type DeleteDocumentRequirementDialogProps,
  type ToggleDocumentRequirementActiveDialogProps,
} from "./components/document-requirement-dialogs";
export {
  OptionalSelectField,
  type OptionalSelectFieldProps,
} from "./components/optional-select-field";

// Backend integration
export { documentService } from "./api/document.service";
export { documentKeys } from "./api/document.keys";
export {
  useArchiveDocument,
  useCreateDocumentRequirement,
  useCreateDocumentType,
  useDeleteDocumentRequirement,
  useDeleteDocumentType,
  useDocument,
  useDocumentRequirement,
  useDocumentRequirements,
  useDocumentsBranch,
  useDocumentType,
  useDocumentTypes,
  useDownloadDocument,
  useOwnerDocuments,
  useRejectDocument,
  useReplaceDocument,
  useToggleDocumentRequirementActive,
  useToggleDocumentTypeActive,
  useUpdateDocumentRequirement,
  useUpdateDocumentType,
  useUploadDocument,
  useVerifyDocument,
} from "./hooks/use-documents";

// Domain logic
export {
  buildChecklist,
  checklistSummary,
  matchesRequirementScope,
  type ChecklistItem,
  type ChecklistItemState,
  type RequirementScope,
} from "./utils/checklist";
export {
  toDocumentRequirementCreateRequest,
  toDocumentRequirementFormValues,
  toDocumentRequirementUpdateRequest,
} from "./mappers/document-requirement.mapper";
export {
  toDocumentTypeFormValues,
  toDocumentTypeRequest,
} from "./mappers/document-type.mapper";

// Contracts
export {
  DOCUMENT_OWNER_TYPES,
  DOCUMENT_SCAN_STATUSES,
  DOCUMENT_VERIFICATION_STATUSES,
  type ArchiveDocumentRequest,
  type DocumentDto,
  type DocumentOwnerType,
  type DocumentRequirementDto,
  type DocumentRequirementRequest,
  type DocumentScanStatus,
  type DocumentTypeDto,
  type DocumentTypeRequest,
  type DocumentVerificationStatus,
  type DocumentVersionDto,
  type RejectDocumentRequest,
  type UploadDocumentFields,
} from "./types/document.dto";
export {
  documentRequirementFormDefaults,
  documentRequirementFormSchema,
  APPLIES_TO_ALL,
  type DocumentRequirementFormValues,
} from "./schemas/document-requirement.schema";
export {
  documentTypeFormDefaults,
  documentTypeFormSchema,
  type DocumentTypeFormValues,
} from "./schemas/document-type.schema";
export {
  ACTIVE_STATE_PRESENTATION,
  ANY_STATUS,
  COMMON_MIME_TYPES,
  DIRECTORY_PAGE_SIZE,
  SCAN_STATUS_LABEL,
  SCAN_STATUS_TONE,
  STATUS_FILTER_OPTIONS,
  VERIFICATION_STATUS_LABEL,
  VERIFICATION_STATUS_TONE,
  activeState,
  filterDocumentRequirements,
  filterDocumentTypes,
  type ActiveState,
} from "./constants";
