import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  /** Any thrown value; mapped to friendly copy via `getErrorMessage`. */
  error?: unknown;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/** Presentational error panel with an optional retry affordance. */
export function ErrorState({
  title = "Something went wrong",
  error,
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  const message = description ?? (error ? getErrorMessage(error) : undefined);

  return (
    <div
      role="alert"
      className={cn(
        "border-border flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border p-6 text-center sm:p-10",
        className,
      )}
    >
      <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <TriangleAlert className="size-6" />
      </span>
      <div className="space-y-1">
        <h3 className="text-foreground text-base font-medium">{title}</h3>
        {message ? (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            {message}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCw />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
