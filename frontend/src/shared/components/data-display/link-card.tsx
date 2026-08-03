import Link from "next/link";

import { ArrowRight, type LucideIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

export interface LinkCardProps {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  href: string;
  /** Status chip in the top-right corner (a `Backend Pending` marker, a count). */
  badge?: React.ReactNode;
  /** Supporting line pinned to the bottom of the card. */
  meta?: React.ReactNode;
  /** Renders the card inert — for destinations that are not reachable yet. */
  disabled?: boolean;
  className?: string;
}

/** The card surface, shared by the linked and inert renderings. */
const SURFACE =
  "bg-card text-card-foreground ring-foreground/10 group flex h-full flex-col rounded-xl p-4 text-sm ring-1";

/**
 * A navigable tile: icon, title, description, and where it goes.
 *
 * The whole card is one link rather than a card containing a link, so the
 * target is as large on a phone as the design implies and assistive tech
 * announces exactly one destination per tile instead of a card, a heading and
 * a stray "Open".
 */
export function LinkCard({
  icon: Icon,
  title,
  description,
  href,
  badge,
  meta,
  disabled = false,
  className,
}: LinkCardProps) {
  const body = (
    <>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg"
        >
          <Icon className="size-5" />
        </span>
        {badge ? <div className="ml-auto shrink-0">{badge}</div> : null}
      </div>

      <div className="mt-4 min-w-0 flex-1 space-y-1">
        <h3 className="text-foreground flex items-center gap-1.5 text-base font-medium">
          {title}
          {!disabled ? (
            <ArrowRight
              aria-hidden="true"
              className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
            />
          ) : null}
        </h3>
        <div className="text-muted-foreground text-sm">{description}</div>
      </div>

      {meta ? (
        <div className="border-border text-muted-foreground mt-4 border-t pt-3 text-xs">
          {meta}
        </div>
      ) : null}
    </>
  );

  if (disabled) {
    return (
      <div
        aria-disabled="true"
        className={cn(SURFACE, "opacity-60", className)}
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        SURFACE,
        "hover:shadow-elevation-md focus-visible:ring-ring transition-shadow focus-visible:ring-3 focus-visible:outline-none",
        className,
      )}
    >
      {body}
    </Link>
  );
}
