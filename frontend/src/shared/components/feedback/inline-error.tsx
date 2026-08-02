import { CircleAlert, RefreshCw } from "@/assets/icons";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib";
import { cn } from "@/lib/utils";

export interface InlineErrorProps {
  /** Any thrown value; mapped to friendly copy via `getErrorMessage`. */
  error?: unknown;
  /** Overrides the message derived from `error`. */
  description?: React.ReactNode;
  /** Optional heading above the message. */
  title?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * Compact failure notice for a region that still has usable content around it —
 * a form, a section of a page, one card in a grid.
 *
 * `ErrorState` replaces a whole region; this sits inside one. Both read their
 * copy from `getErrorMessage`, so a form-level failure and a page-level failure
 * word the same problem the same way.
 */
export function InlineError({
  error,
  description,
  title,
  onRetry,
  retryLabel = "Retry",
  className,
}: InlineErrorProps) {
  const message = description ?? (error ? getErrorMessage(error) : undefined);

  return (
    <Alert variant="destructive" className={cn(className)}>
      <CircleAlert />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {message ? <AlertDescription>{message}</AlertDescription> : null}
      {onRetry ? (
        <AlertAction>
          <Button variant="ghost" size="xs" onClick={onRetry}>
            <RefreshCw />
            {retryLabel}
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  );
}
