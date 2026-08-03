"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ApiErrorState,
  EmptyState,
  TableSkeleton,
} from "@/shared/components/feedback";

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Describes the table for assistive tech. Visually hidden. */
  caption: string;
  isLoading?: boolean;
  /** A failed fetch. Rendered through `ApiErrorState` in place of the rows. */
  error?: unknown;
  onRetry?: () => void;
  /** Replaces the default "nothing here" panel. */
  emptyState?: React.ReactNode;
  /** Makes rows activatable. Rows become buttons for keyboard users. */
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData) => string;
  /**
   * Sorting state. Supplying it hands ownership to the caller; combine with
   * `manualSorting` when the server does the sorting.
   */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;
  /** Rows rendered by the loading skeleton. */
  skeletonRows?: number;
  className?: string;
}

/**
 * The one table every ERP list uses.
 *
 * It owns the four states a remote list actually has — loading, error, empty,
 * loaded — so no module re-decides what a failed fetch looks like mid-table.
 * Column definitions stay with the feature that understands the domain; this
 * component only knows how to render them.
 *
 * The table scrolls horizontally inside its own container rather than widening
 * the page, which is what keeps a twelve-column audit log usable at 320px.
 */
export function DataTable<TData>({
  columns,
  data,
  caption,
  isLoading = false,
  error,
  onRetry,
  emptyState,
  onRowClick,
  getRowId,
  sorting,
  onSortingChange,
  manualSorting = false,
  skeletonRows = 8,
  className,
}: DataTableProps<TData>) {
  // React Compiler declines to memoize this component: `useReactTable` returns
  // functions whose identity is not stable, and memoizing around them would
  // serve stale rows. That is inherent to TanStack Table, not an oversight —
  // the lint warning here is expected and the un-memoized render is correct.
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    manualSorting,
    state: sorting ? { sorting } : undefined,
    onSortingChange,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });

  if (error) {
    return <ApiErrorState error={error} onRetry={onRetry} />;
  }

  if (isLoading) {
    return <TableSkeleton rows={skeletonRows} columns={columns.length} />;
  }

  if (data.length === 0) {
    return (
      emptyState ?? (
        <EmptyState
          title="Nothing to show"
          description="No records match the current view."
        />
      )
    );
  }

  return (
    <div
      className={cn(
        "border-border w-full overflow-x-auto rounded-xl border",
        className,
      )}
    >
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              // Focusable and Enter/Space-activated, but deliberately **not**
              // `role="button"`: that would replace the row's own role and drop
              // the row out of the table for assistive tech, costing every
              // screen-reader user table navigation to buy a click target
              // sighted users already have.
              tabIndex={onRowClick ? 0 : undefined}
              className={cn(onRowClick && "hover:bg-muted/60 cursor-pointer")}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(row.original);
                      }
                    }
                  : undefined
              }
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
