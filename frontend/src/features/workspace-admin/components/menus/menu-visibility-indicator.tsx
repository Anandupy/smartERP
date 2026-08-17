"use client";

import { CircleAlert, CircleCheckBig, CircleDot } from "@/assets/icons";
import { StatusBadge } from "@/shared/components/data-display";

import { MENU_STATUS_PRESENTATION } from "../../constants";
import type { MenuDto } from "../../types/menu.dto";

export interface MenuVisibilityIndicatorProps {
  menu: Pick<MenuDto, "status" | "permissions" | "permissionMode">;
  moduleActive: boolean;
  className?: string;
}

/**
 * Shows the visibility pipeline's verdict for one menu — module active? status
 * renderable? permissions required? — the exact three steps
 * `navigation.service.ts` evaluates, in order, before a menu reaches anyone's
 * tree.
 *
 * This is a diagnostic aid, not an access decision: it never claims to know
 * whether *this* user, or any specific user, can see the menu — permission
 * evaluation is server-side and this indicator cannot reproduce it. The
 * caller (`MenuDetailDrawer`) pairs it with an explicit note that hiding a
 * menu here does not revoke access to its route.
 */
export function MenuVisibilityIndicator({
  menu,
  moduleActive,
  className,
}: MenuVisibilityIndicatorProps) {
  if (!moduleActive) {
    return (
      <StatusBadge tone="neutral" icon={CircleAlert} className={className}>
        Won&apos;t render — module inactive
      </StatusBadge>
    );
  }

  const statusRenders = MENU_STATUS_PRESENTATION[menu.status].renders;
  if (!statusRenders) {
    return (
      <StatusBadge tone="neutral" icon={CircleAlert} className={className}>
        Won&apos;t render — {MENU_STATUS_PRESENTATION[menu.status].label} is an
        authoring state
      </StatusBadge>
    );
  }

  if (menu.permissions.length === 0) {
    return (
      <StatusBadge tone="success" icon={CircleCheckBig} className={className}>
        Renders for every user
      </StatusBadge>
    );
  }

  return (
    <StatusBadge tone="info" icon={CircleDot} className={className}>
      Renders when {menu.permissionMode === "ALL" ? "all" : "any"} of{" "}
      {menu.permissions.length} permission
      {menu.permissions.length === 1 ? "" : "s"} {menu.permissions.length === 1 ? "is" : "are"} granted
    </StatusBadge>
  );
}
