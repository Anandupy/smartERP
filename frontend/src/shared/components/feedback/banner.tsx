"use client";

import { X, type LucideIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BannerTone = "info" | "warning" | "danger" | "success";

export interface BannerProps {
  tone?: BannerTone;
  /** Leading glyph. Decorative — the title carries the meaning. */
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Trailing controls (a link, a button). Wraps below the copy on mobile. */
  action?: React.ReactNode;
  /** Renders a dismiss control. The caller owns the dismissed state. */
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}

const TONE: Record<BannerTone, string> = {
  info: "border-border bg-secondary text-secondary-foreground",
  warning: "border-chart-4/40 bg-chart-4/10 text-foreground",
  danger: "border-destructive/30 bg-destructive/10 text-foreground",
  success: "border-chart-2/40 bg-chart-2/10 text-foreground",
};

const ICON_TONE: Record<BannerTone, string> = {
  info: "text-secondary-foreground",
  warning: "text-chart-4",
  danger: "text-destructive",
  success: "text-chart-2",
};

/**
 * Full-width contextual message pinned above content: scheduled maintenance,
 * a degraded subsystem, an unsaved-changes warning.
 *
 * Distinct from `StatusState`, which *replaces* a region's content. A banner
 * accompanies content that is still usable, so it is `role="status"` rather
 * than `alert` — it informs without seizing focus. Presentational only: it
 * takes no domain concepts, so every ERP module can reuse it.
 */
export function Banner({
  tone = "info",
  icon: Icon,
  title,
  description,
  action,
  onDismiss,
  dismissLabel = "Dismiss",
  className,
}: BannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center",
        TONE[tone],
        className,
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          className={cn("size-5 shrink-0", ICON_TONE[tone])}
        />
      ) : null}

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <div className="text-muted-foreground text-sm">{description}</div>
        ) : null}
      </div>

      {action || onDismiss ? (
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={dismissLabel}
              onClick={onDismiss}
            >
              <X />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
