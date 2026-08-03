import type { LucideIcon } from "@/assets/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Semantic meanings a status can carry, independent of any domain.
 *
 * Modules map their own vocabulary onto these — an audit `severity`, a
 * maintenance `isActive`, an environment name — so "active" and "healthy" look
 * the same across the ERP without any module knowing about another's states.
 */
export type StatusTone =
  "neutral" | "info" | "success" | "warning" | "danger" | "brand";

export interface StatusBadgeProps {
  tone?: StatusTone;
  /** Leading glyph. Decorative — the label carries the meaning. */
  icon?: LucideIcon;
  /** Renders a filled dot before the label instead of an icon. */
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

const TONE: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-chart-3/30 bg-chart-3/10 text-chart-3",
  success: "border-chart-2/40 bg-chart-2/15 text-chart-2",
  warning: "border-chart-4/40 bg-chart-4/15 text-chart-4",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  brand: "border-primary/30 bg-primary/10 text-primary",
};

const DOT: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-chart-3",
  success: "bg-chart-2",
  warning: "bg-chart-4",
  danger: "bg-destructive",
  brand: "bg-primary",
};

/**
 * Compact, tone-coded state label for table cells, cards and headers.
 *
 * Presentational only. The tone is passed in, never derived here — deciding
 * that `SUSPENDED` is a warning is domain knowledge and belongs to the feature
 * that owns the vocabulary.
 */
export function StatusBadge({
  tone = "neutral",
  icon: Icon,
  dot = false,
  children,
  className,
}: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(TONE[tone], className)}>
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])}
        />
      ) : null}
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </Badge>
  );
}
