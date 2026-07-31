import { cn } from "@/lib/utils";

/** Vertical rhythm wrapper for stacking page sections responsively. */
export function Section({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("w-full py-4 sm:py-6 lg:py-8", className)}
      {...props}
    />
  );
}
