"use client";

import { StatusBadge } from "@/shared/components/data-display";

import { PROGRAM_STATE_PRESENTATION, programState } from "../constants";
import type { ProgramDto } from "../types/program.dto";

export interface ProgramStatusBadgeProps {
  program: ProgramDto;
  /** Renders the glyph as well as the label. */
  withIcon?: boolean;
  className?: string;
}

/**
 * A program's operating state, in the module's vocabulary.
 *
 * A thin wrapper over the shared `StatusBadge` — the shared component is
 * deliberately domain-free, and deriving a state from `isActive` is exactly the
 * domain knowledge that belongs to this feature.
 *
 * An unreported flag renders "Unknown" rather than "Inactive". No response body
 * is documented, so the field genuinely may be absent, and defaulting it to
 * `false` would show a running programme as suspended — and would make the
 * status toggle unsafe, since it flips rather than sets.
 */
export function ProgramStatusBadge({
  program,
  withIcon = false,
  className,
}: ProgramStatusBadgeProps) {
  const presentation = PROGRAM_STATE_PRESENTATION[programState(program)];

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
