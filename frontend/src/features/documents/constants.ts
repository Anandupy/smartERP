import type { StatusBadgeTone } from "@/shared/components/data-display";

import type {
  DocumentScanStatus,
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
