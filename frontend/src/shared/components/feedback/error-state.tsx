import { RefreshCw, TriangleAlert, type LucideIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib";

import { StatusState } from "./status-state";

export interface ErrorStateProps {
  title?: string;
  /** Any thrown value; mapped to friendly copy via `getErrorMessage`. */
  error?: unknown;
  description?: React.ReactNode;
  /** Overrides the default alert glyph (see `ApiErrorState`). */
  icon?: LucideIcon;
  onRetry?: () => void;
  /** Label for the retry control, when "Try again" is not the right verb. */
  retryLabel?: string;
  /** Optional escape hatch beside retry (status page, contact, go back). */
  secondaryAction?: React.ReactNode;
  className?: string;
}

/**
 * Presentational error panel with an optional retry affordance.
 *
 * Carries `role="alert"`: a failure is an event the user did not ask for, so it
 * is announced rather than left to be discovered.
 */
export function ErrorState({
  title = "Something went wrong",
  error,
  description,
  icon = TriangleAlert,
  onRetry,
  retryLabel = "Try again",
  secondaryAction,
  className,
}: ErrorStateProps) {
  const message = description ?? (error ? getErrorMessage(error) : undefined);

  return (
    <StatusState
      role="alert"
      icon={icon}
      tone="danger"
      variant="solid"
      title={title}
      description={message}
      secondaryAction={secondaryAction}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw />
            {retryLabel}
          </Button>
        ) : null
      }
      className={className}
    />
  );
}
