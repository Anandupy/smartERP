import { StatusBadge } from "@/shared/components/data-display";

import { VERIFICATION_STATUS_LABEL, VERIFICATION_STATUS_TONE } from "../constants";
import type { DocumentVerificationStatus } from "../types/document.dto";

export interface DocumentStatusBadgeProps {
  status: DocumentVerificationStatus;
  className?: string;
}

/** Tone-coded label for one of the three documented verification statuses. */
export function DocumentStatusBadge({
  status,
  className,
}: DocumentStatusBadgeProps) {
  return (
    <StatusBadge tone={VERIFICATION_STATUS_TONE[status]} className={className}>
      {VERIFICATION_STATUS_LABEL[status]}
    </StatusBadge>
  );
}
