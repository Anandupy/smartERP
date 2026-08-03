import { CheckCircle2, type LucideIcon } from "@/assets/icons";

import { StatusState } from "./status-state";

export interface SuccessStateProps {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

/**
 * Terminal confirmation for a completed operation — the counterpart to
 * `ErrorState`.
 *
 * Carries `role="status"`, not `alert`: a success the user just asked for
 * should be announced politely once the region settles, never interrupt.
 */
export function SuccessState({
  title,
  description,
  icon = CheckCircle2,
  action,
  secondaryAction,
  className,
}: SuccessStateProps) {
  return (
    <StatusState
      icon={icon}
      tone="brand"
      variant="solid"
      role="status"
      title={title}
      description={description}
      action={action}
      secondaryAction={secondaryAction}
      className={className}
    />
  );
}
