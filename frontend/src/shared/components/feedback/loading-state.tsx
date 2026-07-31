import { cn } from "@/lib/utils";

import { Spinner } from "./spinner";

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

/** Centered, full-region loading placeholder used by Suspense/loading UIs. */
export function LoadingState({
  message = "Loading…",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-40 w-full flex-col items-center justify-center gap-3 p-6 text-center",
        className,
      )}
    >
      <Spinner size="lg" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
