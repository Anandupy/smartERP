import type { StatusBadgeTone } from "@/shared/components/data-display";

import type { AdmissionApplicationStatus } from "./types/applicant.dto";
import { STATUS_MEANING } from "./utils/workflow";

/**
 * How each of the thirteen documented statuses reads in the UI. Tone is
 * domain knowledge that belongs here, not in the generic `StatusBadge`.
 */
export const STATUS_TONE: Record<AdmissionApplicationStatus, StatusBadgeTone> =
  {
    DRAFT: "neutral",
    SUBMITTED: "info",
    UNDER_REVIEW: "info",
    DOCUMENT_PENDING: "warning",
    FEE_PENDING: "warning",
    WAITLISTED: "warning",
    APPROVED: "brand",
    SEAT_CONFIRMED: "brand",
    DEFERRED: "neutral",
    ADMITTED: "success",
    REJECTED: "danger",
    WITHDRAWN: "neutral",
    CANCELLED: "neutral",
  };

export const STATUS_LABEL: Record<AdmissionApplicationStatus, string> =
  Object.fromEntries(
    Object.entries(STATUS_MEANING).map(([status, meaning]) => [
      status,
      meaning.label,
    ]),
  ) as Record<AdmissionApplicationStatus, string>;

/** Filter value meaning "don't narrow on status". */
export const ANY_STATUS = "ANY";

export const STATUS_FILTER_OPTIONS = [
  { value: ANY_STATUS, label: "All statuses" },
  ...(
    Object.keys(STATUS_LABEL) as AdmissionApplicationStatus[]
  ).map((value) => ({ value, label: STATUS_LABEL[value] })),
];

/** Rows per page — a real server parameter for this module (`limit`). */
export const DIRECTORY_PAGE_SIZE = 20;

/**
 * Disability status options. Not a master resource — `disabilityStatus` is a
 * plain boolean on the Applicant DTO, with `disabilityTypeId` (a real master,
 * "disabilities") shown only when it is set.
 */
export const DISABILITY_STATUS_OPTIONS = [
  { value: "false", label: "No" },
  { value: "true", label: "Yes" },
];
