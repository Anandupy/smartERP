import type { LucideIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "brand" | "danger" | "warning";
export type StatusVariant = "dashed" | "solid" | "plain";

export interface StatusStateProps {
  /** Decorative glyph for the tile. Hidden from assistive tech. */
  icon?: LucideIcon;
  /** Colors the glyph tile. `danger` also reads as the failure treatment. */
  tone?: StatusTone;
  /** Border treatment: dashed for "nothing here", solid for "something broke". */
  variant?: StatusVariant;
  title: string;
  description?: React.ReactNode;
  /** Primary call to action. */
  action?: React.ReactNode;
  /** Optional escape hatch rendered beside the primary action. */
  secondaryAction?: React.ReactNode;
  /**
   * Live-region role. `alert` for failures the user did not ask for, so they
   * are announced; omitted for ordinary empty results, which are not events.
   */
  role?: "alert" | "status";
  /** Extra content between the copy and the actions. */
  children?: React.ReactNode;
  className?: string;
}

const TONE: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-primary/10 text-primary",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-accent text-accent-foreground",
};

const VARIANT: Record<StatusVariant, string> = {
  dashed: "border-border rounded-xl border border-dashed",
  solid: "border-border rounded-xl border",
  plain: "",
};

/**
 * The one layout every "this region has no ordinary content" message uses:
 * glyph tile, heading, supporting copy, optional actions.
 *
 * Empty, error, forbidden and offline states differ in glyph, tone and copy —
 * not in structure — so the structure lives here once and each state stays a
 * declaration. Presentational only: it takes no domain concepts, which is what
 * lets every ERP module reuse it.
 */
export function StatusState({
  icon: Icon,
  tone = "neutral",
  variant = "dashed",
  title,
  description,
  action,
  secondaryAction,
  role,
  children,
  className,
}: StatusStateProps) {
  return (
    <div
      role={role}
      className={cn(
        "flex min-h-48 w-full flex-col items-center justify-center gap-3 p-6 text-center sm:p-10",
        VARIANT[variant],
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full",
            TONE[tone],
          )}
        >
          <Icon className="size-6" />
        </span>
      ) : null}

      <div className="space-y-1">
        <h3 className="text-foreground text-base font-medium">{title}</h3>
        {description ? (
          <div className="text-muted-foreground mx-auto max-w-sm text-sm text-balance">
            {description}
          </div>
        ) : null}
      </div>

      {children}

      {action || secondaryAction ? (
        <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row">
          {secondaryAction}
          {action}
        </div>
      ) : null}
    </div>
  );
}
