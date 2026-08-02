import { RefreshCw, WifiOff } from "@/assets/icons";
import { Button } from "@/components/ui/button";

import { StatusState } from "./status-state";

export interface OfflineStateProps {
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryAction?: React.ReactNode;
  className?: string;
}

/**
 * Shown when the request never reached the server — no connection, or a
 * timeout on the way out.
 *
 * Distinct from a server error on purpose: this one the user can often fix
 * themselves, so retry is the primary action rather than an apology.
 */
export function OfflineState({
  title = "You appear to be offline",
  description = "Check your connection and try again. Nothing has been lost.",
  onRetry,
  retryLabel = "Try again",
  secondaryAction,
  className,
}: OfflineStateProps) {
  return (
    <StatusState
      role="alert"
      icon={WifiOff}
      tone="danger"
      variant="solid"
      title={title}
      description={description}
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
