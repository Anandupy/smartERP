import { GraduationCap } from "@/assets/icons";
import { appConfig } from "@/config";
import { cn } from "@/lib/utils";

export interface BrandMarkProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md" | "lg";
  /** Stack the glyph above the wordmark instead of beside it. */
  orientation?: "horizontal" | "vertical";
  /** Render only the glyph tile (the wordmark stays available to readers). */
  glyphOnly?: boolean;
}

const TILE: Record<NonNullable<BrandMarkProps["size"]>, string> = {
  sm: "size-9 rounded-lg [&_svg]:size-4.5",
  md: "size-12 rounded-xl [&_svg]:size-6",
  lg: "size-16 rounded-2xl [&_svg]:size-8",
};

const WORDMARK: Record<NonNullable<BrandMarkProps["size"]>, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl sm:text-5xl",
};

/**
 * The CampusFlow lockup: a primary-filled glyph tile plus the wordmark. The
 * only place the brand identity is expressed, so a workspace theme restyles
 * every auth surface by restyling its tokens.
 */
export function BrandMark({
  size = "md",
  orientation = "horizontal",
  glyphOnly = false,
  className,
  ...props
}: BrandMarkProps) {
  return (
    <div
      className={cn(
        "flex items-center",
        orientation === "vertical"
          ? "flex-col gap-4 text-center"
          : "flex-row gap-3",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-primary text-primary-foreground shadow-ambient flex shrink-0 items-center justify-center",
          TILE[size],
        )}
      >
        <GraduationCap />
      </span>
      <span
        className={cn(
          "text-primary font-semibold tracking-tight",
          WORDMARK[size],
          glyphOnly && "sr-only",
        )}
      >
        {appConfig.name}
      </span>
    </div>
  );
}
