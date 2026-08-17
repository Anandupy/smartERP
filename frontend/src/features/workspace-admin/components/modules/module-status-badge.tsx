"use client";

import { Ban, CircleCheckBig } from "@/assets/icons";
import { StatusBadge } from "@/shared/components/data-display";

import type { ModuleDto } from "../../types/module.dto";

export interface ModuleStatusBadgeProps {
  module: Pick<ModuleDto, "isActive">;
  withIcon?: boolean;
  className?: string;
}

/**
 * A module's active flag, in the module's vocabulary.
 *
 * An inactive module contributes nothing to any user's navigation tree,
 * immediately — the badge exists so that consequence is visible everywhere the
 * module appears, not just in the toggle confirmation.
 */
export function ModuleStatusBadge({
  module,
  withIcon = false,
  className,
}: ModuleStatusBadgeProps) {
  return (
    <StatusBadge
      tone={module.isActive ? "success" : "neutral"}
      icon={withIcon ? (module.isActive ? CircleCheckBig : Ban) : undefined}
      dot={!withIcon}
      className={className}
    >
      {module.isActive ? "Active" : "Inactive"}
    </StatusBadge>
  );
}
