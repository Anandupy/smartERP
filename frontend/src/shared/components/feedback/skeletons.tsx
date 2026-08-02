import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeleton loaders for the shapes the ERP repeats: a page, a card, a table, a
 * form, and a selection step.
 *
 * They exist so no module hand-rolls its own grey rectangles. Each one only
 * describes a *shape*, never a domain, which is what makes the same five
 * components serve admissions, fees, attendance and settings alike.
 *
 * ## Accessibility
 *
 * A skeleton is decoration standing in for content, so the bars themselves are
 * `aria-hidden` and the region carries a single `role="status"` with
 * `aria-busy` and one visually hidden label. Screen readers announce "Loading
 * students" once, instead of reading out a dozen meaningless boxes.
 */

export interface SkeletonRegionProps extends React.ComponentProps<"div"> {
  /** Announced to assistive tech while the region is busy. */
  label?: string;
}

/**
 * Wraps a set of skeleton bars in one busy live region. Compose this when
 * building a bespoke skeleton so the a11y wiring is never re-derived.
 */
export function SkeletonRegion({
  label = "Loading…",
  className,
  children,
  ...props
}: SkeletonRegionProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn("w-full", className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="contents">
        {children}
      </div>
    </div>
  );
}

export interface PageSkeletonProps {
  /** Number of stacked content blocks below the header. */
  blocks?: number;
  label?: string;
  className?: string;
}

/** Page-level placeholder: title, supporting line, then content blocks. */
export function PageSkeleton({
  blocks = 3,
  label = "Loading page",
  className,
}: PageSkeletonProps) {
  return (
    <SkeletonRegion label={label} className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-2/5 min-w-40" />
        <Skeleton className="h-4 w-3/5 min-w-52" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: blocks }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </SkeletonRegion>
  );
}

export interface CardSkeletonProps {
  /** Render the leading avatar/logo tile. */
  withMedia?: boolean;
  /** Body lines under the title. */
  lines?: number;
  label?: string;
  className?: string;
}

/** Card-shaped placeholder: optional media tile, title, and body lines. */
export function CardSkeleton({
  withMedia = true,
  lines = 2,
  label = "Loading",
  className,
}: CardSkeletonProps) {
  return (
    <SkeletonRegion
      label={label}
      className={cn("border-border space-y-4 rounded-xl border p-4", className)}
    >
      <div className="flex items-center gap-3">
        {withMedia ? (
          <Skeleton className="size-10 shrink-0 rounded-lg" />
        ) : null}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton
            key={index}
            className={cn("h-3", index === lines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    </SkeletonRegion>
  );
}

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  label?: string;
  className?: string;
}

/** Table placeholder: a header band plus evenly divided body rows. */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  label = "Loading table",
  className,
}: TableSkeletonProps) {
  return (
    <SkeletonRegion
      label={label}
      className={cn(
        "border-border divide-border divide-y overflow-hidden rounded-xl border",
        className,
      )}
    >
      <div
        className="bg-muted/50 grid gap-3 p-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-3 p-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton key={columnIndex} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </SkeletonRegion>
  );
}

export interface FormSkeletonProps {
  fields?: number;
  /** Render the trailing full-width submit bar. */
  withSubmit?: boolean;
  label?: string;
  className?: string;
}

/** Form placeholder: labelled field pairs and an optional submit bar. */
export function FormSkeleton({
  fields = 3,
  withSubmit = true,
  label = "Loading form",
  className,
}: FormSkeletonProps) {
  return (
    <SkeletonRegion label={label} className={cn("space-y-5", className)}>
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ))}
      {withSubmit ? <Skeleton className="h-10 w-full rounded-lg" /> : null}
    </SkeletonRegion>
  );
}

export interface SelectionSkeletonProps {
  /** Number of labelled control rows above the card grid. */
  steps?: number;
  /** Number of option cards in the grid. `0` renders controls only. */
  options?: number;
  label?: string;
  className?: string;
}

/**
 * Placeholder for a guided selection step: labelled controls above a grid of
 * option cards. Used by workspace selection, and by any future wizard that
 * narrows a choice before continuing.
 */
export function SelectionSkeleton({
  steps = 2,
  options = 2,
  label = "Loading options",
  className,
}: SelectionSkeletonProps) {
  return (
    <SkeletonRegion label={label} className={cn("space-y-6", className)}>
      {Array.from({ length: steps }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ))}
      {options > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: options }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : null}
      <Skeleton className="h-12 w-full rounded-xl" />
    </SkeletonRegion>
  );
}
