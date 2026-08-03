import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /**
   * Status chips rendered beside the title — a `Backend Pending` marker, an
   * environment badge. Inline with the heading so they read as part of it.
   */
  badge?: React.ReactNode;
  /** Right-aligned actions (buttons, menus). Wraps below title on mobile. */
  actions?: React.ReactNode;
  className?: string;
}

/** Standard page heading block: title, optional description, and actions. */
export function PageHeader({
  title,
  description,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "border-border flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-foreground text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {badge}
        </div>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
