"use client";

import { StatusBadge } from "@/shared/components/data-display";

import {
  ACADEMIC_YEAR_STATE_PRESENTATION,
  academicYearState,
} from "../constants";
import type { AcademicYearDto } from "../types/academic-year.dto";

export interface AcademicYearStatusBadgeProps {
  year: AcademicYearDto;
  /** Renders the glyph as well as the label. */
  withIcon?: boolean;
  className?: string;
}

/**
 * An academic year's state, in the module's vocabulary.
 *
 * A thin wrapper over the shared `StatusBadge` — the shared component is
 * deliberately domain-free, and collapsing three independent flags into one
 * label is exactly the domain knowledge that belongs to this feature.
 *
 * Two decisions worth knowing:
 *
 * - **Locked wins.** A year that is both current and locked shows "Locked",
 *   because that is the flag that stops writes and therefore the one a user
 *   needs to see before trying to record anything against it.
 * - **An unreported flag renders "Unknown", never "Inactive".** No response
 *   body is documented, so the flags genuinely may be absent, and defaulting
 *   them to `false` would present a live academic year as closed.
 */
export function AcademicYearStatusBadge({
  year,
  withIcon = false,
  className,
}: AcademicYearStatusBadgeProps) {
  const presentation = ACADEMIC_YEAR_STATE_PRESENTATION[academicYearState(year)];

  return (
    <StatusBadge
      tone={presentation.tone}
      icon={withIcon ? presentation.icon : undefined}
      dot={!withIcon}
      className={className}
    >
      {presentation.label}
    </StatusBadge>
  );
}
