import { Inbox, type LucideIcon } from "@/assets/icons";

import { StatusState } from "./status-state";

export interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  /** Optional secondary affordance beside the primary action. */
  secondaryAction?: React.ReactNode;
  className?: string;
}

/**
 * Neutral placeholder for "no data" situations. Presentational only.
 *
 * An empty result is a state, not an event, so it carries no live-region role —
 * announcing "no students" the moment a filter clears would interrupt without
 * informing.
 */
export function EmptyState({
  title,
  description,
  icon = Inbox,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <StatusState
      icon={icon}
      tone="neutral"
      variant="dashed"
      title={title}
      description={description}
      action={action}
      secondaryAction={secondaryAction}
      className={className}
    />
  );
}
