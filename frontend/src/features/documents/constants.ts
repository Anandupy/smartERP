import { CircleCheckBig, Power, type LucideIcon } from "@/assets/icons";
import type { StatusBadgeTone } from "@/shared/components/data-display";

import type {
  DocumentRequirementDto,
  DocumentScanStatus,
  DocumentTypeDto,
  DocumentVerificationStatus,
} from "./types/document.dto";

/** How each of the three documented verification statuses reads. */
export const VERIFICATION_STATUS_LABEL: Record<
  DocumentVerificationStatus,
  string
> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export const VERIFICATION_STATUS_TONE: Record<
  DocumentVerificationStatus,
  StatusBadgeTone
> = {
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
};

/** How each of the four documented scan statuses reads. */
export const SCAN_STATUS_LABEL: Record<DocumentScanStatus, string> = {
  PENDING: "Scanning",
  CLEAN: "Clean",
  INFECTED: "Infected",
  FAILED: "Scan failed",
};

export const SCAN_STATUS_TONE: Record<DocumentScanStatus, StatusBadgeTone> = {
  PENDING: "neutral",
  CLEAN: "success",
  INFECTED: "danger",
  FAILED: "danger",
};

/**
 * Global upload ceiling as a UX nicety only — exact limits are per
 * `DocumentType.maxSizeBytes` and the server's `400 FILE_TOO_LARGE`/`413`
 * response is the source of truth (module doc §6.5, `backend-gaps.md` DOC6).
 */
export const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Active/inactive presentation, shared by the Document Types and Document
 * Requirements directories — both document only the one boolean, the same
 * shape Admission Masters uses.
 */
export type ActiveState = "active" | "inactive";

export function activeState(record: { isActive: boolean }): ActiveState {
  return record.isActive ? "active" : "inactive";
}

export const ACTIVE_STATE_PRESENTATION: Record<
  ActiveState,
  { label: string; tone: StatusBadgeTone; icon: LucideIcon }
> = {
  active: { label: "Active", tone: "success", icon: CircleCheckBig },
  inactive: { label: "Inactive", tone: "neutral", icon: Power },
};

/** Filter value meaning "don't narrow on status". */
export const ANY_STATUS = "ANY";

export const STATUS_FILTER_OPTIONS = [
  { value: ANY_STATUS, label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

/** Rows per page in a directory. Client-side — neither endpoint takes paging params. */
export const DIRECTORY_PAGE_SIZE = 10;

/** A common, non-exhaustive MIME type catalogue offered on the Document Type form. */
export const COMMON_MIME_TYPES: readonly { value: string; label: string }[] = [
  { value: "application/pdf", label: "PDF" },
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/png", label: "PNG" },
  { value: "image/webp", label: "WEBP" },
  { value: "application/msword", label: "DOC" },
  {
    value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "DOCX",
  },
];

export function filterDocumentTypes(
  types: readonly DocumentTypeDto[],
  filters: { search: string; status: string },
): DocumentTypeDto[] {
  const needle = filters.search.trim().toLowerCase();

  return types.filter((type) => {
    if (filters.status === "active" && !type.isActive) return false;
    if (filters.status === "inactive" && type.isActive) return false;
    if (needle.length === 0) return true;
    return [type.code, type.name, type.description ?? ""].some((field) =>
      field.toLowerCase().includes(needle),
    );
  });
}

export function filterDocumentRequirements(
  requirements: readonly DocumentRequirementDto[],
  filters: { search: string; status: string },
  documentTypesById: ReadonlyMap<string, DocumentTypeDto>,
): DocumentRequirementDto[] {
  const needle = filters.search.trim().toLowerCase();

  return requirements.filter((requirement) => {
    if (filters.status === "active" && !requirement.isActive) return false;
    if (filters.status === "inactive" && requirement.isActive) return false;
    if (needle.length === 0) return true;

    const typeName = documentTypesById.get(requirement.documentTypeId)?.name ?? "";
    return [typeName, requirement.requiredByStage].some((field) =>
      field.toLowerCase().includes(needle),
    );
  });
}
