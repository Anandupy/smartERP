import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.ComponentProps<"span"> {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const SIZE: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
};

/** Accessible loading spinner. */
export function Spinner({
  size = "md",
  label = "Loading",
  className,
  ...props
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex", className)}
      {...props}
    >
      <LoaderCircle
        className={cn("text-muted-foreground animate-spin", SIZE[size])}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
