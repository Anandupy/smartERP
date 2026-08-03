"use client";

import { StatusBadge } from "@/shared/components/data-display";

import { BRANCH_STATE_PRESENTATION, branchState } from "../constants";
import type { BranchDto } from "../types/branch.dto";

export interface BranchStatusBadgeProps {
  branch: BranchDto;
  /** Renders the glyph as well as the label. */
  withIcon?: boolean;
  className?: string;
}

/**
 * A branch's operating state, in the module's vocabulary.
 *
 * A thin wrapper over the shared `StatusBadge` — the shared component is
 * deliberately domain-free, and deriving a state from `isActive`/`isDeleted` is
 * exactly the domain knowledge that belongs to this feature.
 *
 * An unreported flag renders "Unknown" rather than "Inactive". No response body
 * is documented, so the field genuinely may be absent, and defaulting it to
 * `false` would show a working campus as suspended.
 */
export function BranchStatusBadge({
  branch,
  withIcon = false,
  className,
}: BranchStatusBadgeProps) {
  const presentation = BRANCH_STATE_PRESENTATION[branchState(branch)];

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
