"use client";

import { Search, X } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DataTableToolbarProps {
  /** Current search term. Controlled — the caller owns debouncing. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Accessible name for the search box. Defaults to the placeholder. */
  searchLabel?: string;
  /** Filter controls (selects, date ranges). Wraps below search on mobile. */
  filters?: React.ReactNode;
  /**
   * How many filters are currently narrowing the list. Non-zero reveals the
   * reset control — the caller decides what counts, since only it knows which
   * of its filters are at their default.
   */
  activeFilterCount?: number;
  onClearFilters?: () => void;
  /** Right-aligned actions (create, export, refresh). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard control strip above a `DataTable`: search, filters, actions.
 *
 * Stacks vertically on mobile and spreads on `lg` so the same toolbar serves a
 * 320px phone and a 1920px desktop without a second layout. Purely
 * presentational — it holds no filter state, which is what lets one toolbar
 * drive server-filtered and client-filtered lists alike.
 */
export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  searchLabel,
  filters,
  activeFilterCount = 0,
  onClearFilters,
  actions,
  className,
}: DataTableToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {onSearchChange ? (
          <div className="relative w-full sm:max-w-xs">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            />
            <Input
              type="search"
              value={search ?? ""}
              aria-label={searchLabel ?? searchPlaceholder}
              placeholder={searchPlaceholder}
              className="pl-8"
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
        ) : null}

        {filters}

        {activeFilterCount > 0 && onClearFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
          >
            <X />
            Reset
            <span className="sr-only"> {activeFilterCount} active filters</span>
          </Button>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
