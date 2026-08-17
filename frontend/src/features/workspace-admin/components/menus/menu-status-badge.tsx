"use client";

import { StatusBadge } from "@/shared/components/data-display";

import { MENU_STATUS_PRESENTATION } from "../../constants";
import type { MenuStatus } from "../../types/menu.dto";

export interface MenuStatusBadgeProps {
  status: MenuStatus;
  withIcon?: boolean;
  className?: string;
}

/**
 * A menu's lifecycle status, tone-mapped across all six `MenuStatus` values.
 *
 * Only `ACTIVE` and `BETA` ever reach a real user's tree — the badge is the
 * only place the other four (authoring states) are visible at all, so it
 * never hides which one applies.
 */
export function MenuStatusBadge({
  status,
  withIcon = false,
  className,
}: MenuStatusBadgeProps) {
  const presentation = MENU_STATUS_PRESENTATION[status];

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
