import { cn } from "@/lib/utils";

export interface ContainerProps extends React.ComponentProps<"div"> {
  /** Max content width. `full` removes the cap for edge-to-edge layouts. */
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const MAX_WIDTH: Record<NonNullable<ContainerProps["size"]>, string> = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-7xl",
  xl: "max-w-[96rem]",
  full: "max-w-none",
};

/**
 * Responsive, mobile-first content container. Uses fluid horizontal padding
 * that scales across the supported breakpoints — never a fixed width.
 */
export function Container({
  size = "lg",
  className,
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        MAX_WIDTH[size],
        className,
      )}
      {...props}
    />
  );
}
