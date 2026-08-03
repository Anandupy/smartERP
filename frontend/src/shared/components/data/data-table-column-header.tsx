"use client";

import type { Column } from "@tanstack/react-table";

import { ArrowDown, ArrowUp, ArrowUpDown } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  /** Right-aligns the control for numeric columns. */
  align?: "start" | "end";
  className?: string;
}

const DIRECTION_LABEL = {
  asc: "sorted ascending",
  desc: "sorted descending",
} as const;

/**
 * Sortable column heading.
 *
 * A plain heading when the column cannot be sorted, a button when it can —
 * never a button that does nothing, which is the usual way a sortable-looking
 * header misleads keyboard users. The current direction is both drawn as an
 * arrow and stated in the accessible name, so it survives a screen reader.
 */
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  align = "start",
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <span
        className={cn(
          "text-muted-foreground text-xs font-medium tracking-wide uppercase",
          align === "end" && "block text-right",
          className,
        )}
      >
        {title}
      </span>
    );
  }

  const direction = column.getIsSorted();
  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ArrowUpDown;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={
        direction
          ? `${title}, ${DIRECTION_LABEL[direction]}`
          : `Sort by ${title}`
      }
      className={cn(
        "text-muted-foreground -mx-2 h-7 text-xs font-medium tracking-wide uppercase",
        align === "end" && "ml-auto",
        className,
      )}
      onClick={() => column.toggleSorting(direction === "asc")}
    >
      {title}
      <Icon aria-hidden="true" className="size-3.5" />
    </Button>
  );
}
