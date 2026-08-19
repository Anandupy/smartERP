import { StatusBadge } from "@/shared/components/data-display";

import { STATUS_LABEL, STATUS_TONE } from "../constants";
import type { AdmissionApplicationStatus } from "../types/applicant.dto";

export interface ApplicantStatusBadgeProps {
  status: AdmissionApplicationStatus;
  className?: string;
}

/** Tone-coded label for one of the thirteen documented applicant statuses. */
export function ApplicantStatusBadge({
  status,
  className,
}: ApplicantStatusBadgeProps) {
  return (
    <StatusBadge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABEL[status]}
    </StatusBadge>
  );
}
