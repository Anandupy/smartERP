"use client";

import { StatusBadge } from "@/shared/components/data-display";

import { statusPresentation } from "../constants";

export interface OrganizationStatusBadgeProps {
  status: string | null | undefined;
  /** Renders the glyph as well as the label. */
  withIcon?: boolean;
  className?: string;
}

/**
 * An organization's status, in the module's vocabulary.
 *
 * A thin wrapper over the shared `StatusBadge` — the shared component is
 * deliberately domain-free, and deciding that `SUSPENDED` reads as a warning
 * is exactly the domain knowledge that belongs to this feature.
 *
 * A missing status renders "Unknown" rather than nothing: the read shape is
 * undocumented, so the field genuinely may not arrive, and a blank cell would
 * be indistinguishable from a status the app failed to render.
 */
export function OrganizationStatusBadge({
  status,
  withIcon = false,
  className,
}: OrganizationStatusBadgeProps) {
  const presentation = statusPresentation(status);

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
