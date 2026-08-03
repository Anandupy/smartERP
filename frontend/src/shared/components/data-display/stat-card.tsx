import type { LucideIcon } from "@/assets/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  /** What is being counted. Always rendered, including while loading. */
  label: string;
  /** The figure itself. Formatted by the caller — this component never does. */
  value: React.ReactNode;
  /** Supporting line beneath the value (comparison, period, caveat). */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** Trailing slot for a badge or trend chip. */
  adornment?: React.ReactNode;
  /** Swaps the value for a skeleton so a row of tiles never reflows. */
  isLoading?: boolean;
  /** Overrides the value's type scale — text-heavy values want a smaller one. */
  valueClassName?: string;
  className?: string;
}

/**
 * A single figure in a summary row: label, value, optional hint.
 *
 * Reserves the value's space while loading so a row of tiles keeps its layout
 * as data arrives — a dashboard that jumps once per tile is the usual cost of
 * per-tile spinners. Presentational only; every ERP module composes its own
 * row from these.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  adornment,
  isLoading = false,
  valueClassName,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="flex items-start gap-3 px-4">
        {Icon ? (
          <span
            aria-hidden="true"
            className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg"
          >
            <Icon className="size-4" />
          </span>
        ) : null}

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">
            {label}
          </p>
          {isLoading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <p
              className={cn(
                "text-foreground truncate text-2xl font-semibold tracking-tight",
                valueClassName,
              )}
            >
              {value}
            </p>
          )}
          {hint ? (
            <div className="text-muted-foreground truncate text-xs">{hint}</div>
          ) : null}
        </div>

        {adornment ? <div className="shrink-0">{adornment}</div> : null}
      </CardContent>
    </Card>
  );
}
