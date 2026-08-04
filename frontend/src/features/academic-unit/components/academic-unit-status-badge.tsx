"use client";

import { StatusBadge } from "@/shared/components/data-display";

import { UNIT_STATE_PRESENTATION, academicUnitState } from "../constants";
import type { AcademicUnitDto } from "../types/academic-unit.dto";

export interface AcademicUnitStatusBadgeProps {
  unit: AcademicUnitDto;
  /** Renders the glyph as well as the label. */
  withIcon?: boolean;
  className?: string;
}

/**
 * An academic unit's operating state, in the module's vocabulary.
 *
 * A thin wrapper over the shared `StatusBadge`. An unreported flag renders
 * "Unknown" rather than "Inactive" — no response body is documented, so the
 * field genuinely may be absent, and the distinction carries weight here: the
 * documented delete rule turns on whether a *child* is active, so guessing
 * would either offer a delete the server refuses or block one that would have
 * worked.
 */
export function AcademicUnitStatusBadge({
  unit,
  withIcon = false,
  className,
}: AcademicUnitStatusBadgeProps) {
  const presentation = UNIT_STATE_PRESENTATION[academicUnitState(unit)];

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
