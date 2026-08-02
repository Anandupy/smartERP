import { ShieldAlert } from "@/assets/icons";

import { StatusState } from "./status-state";

export interface ForbiddenStateProps {
  title?: string;
  description?: React.ReactNode;
  /** Usually "contact an administrator" — the only move the user actually has. */
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

/**
 * Shown when the user is authenticated but not entitled to this region.
 *
 * Deliberately offers no retry: the request was understood and refused, so
 * repeating it changes nothing. The way forward is a person, not a button,
 * which is why `action` is normally an administrator contact.
 */
export function ForbiddenState({
  title = "You don't have access",
  description = "Your account isn't permitted to view this. An administrator can grant access.",
  action,
  secondaryAction,
  className,
}: ForbiddenStateProps) {
  return (
    <StatusState
      role="alert"
      icon={ShieldAlert}
      tone="warning"
      variant="solid"
      title={title}
      description={description}
      action={action}
      secondaryAction={secondaryAction}
      className={className}
    />
  );
}
