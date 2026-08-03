import { cn } from "@/lib/utils";

export interface DescriptionItem {
  /** Stable key — also the visible term unless `label` overrides it. */
  key: string;
  label?: React.ReactNode;
  value: React.ReactNode;
  /** Spans both columns. Use for long text (messages, descriptions, JSON). */
  wide?: boolean;
}

export interface DescriptionListProps {
  items: DescriptionItem[];
  /** Column count at `sm` and above. Single column on mobile regardless. */
  columns?: 1 | 2 | 3;
  className?: string;
}

const COLUMNS: Record<NonNullable<DescriptionListProps["columns"]>, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
};

/**
 * Read-only term/definition grid for detail panels and drawers.
 *
 * A real `<dl>` rather than a table, so assistive tech announces each value
 * with its term. Stacks to one column on mobile; `wide` items always span the
 * full width, which is what keeps a long audit message from squeezing into a
 * half-width cell.
 */
export function DescriptionList({
  items,
  columns = 2,
  className,
}: DescriptionListProps) {
  return (
    <dl className={cn("grid grid-cols-1 gap-4", COLUMNS[columns], className)}>
      {items.map((item) => (
        <div
          key={item.key}
          className={cn("min-w-0 space-y-1", item.wide && "sm:col-span-full")}
        >
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {item.label ?? item.key}
          </dt>
          <dd className="text-foreground text-sm break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
