'use client';

import type { Table } from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  rowCount: number;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Pagination controls for DataTable.
 * Shows page info, page size selector, and navigation buttons.
 */
export function DataTablePagination<TData>({
  table,
  rowCount,
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.ceil(rowCount / pageSize);
  const from = pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, rowCount);

  const buttonClass = cn(
    'flex h-7 w-7 items-center justify-center rounded border border-erp',
    'text-sm text-muted-erp transition-colors',
    'hover:bg-surface-2 hover:text-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-40',
  );

  return (
    <div className="flex items-center justify-between border-t border-erp px-4 py-2.5">
      {/* Row count info */}
      <div className="flex items-center gap-4">
        <p className="text-xs text-muted-erp">
          {rowCount === 0
            ? 'No records'
            : `${from}–${to} of ${rowCount} records`}
        </p>

        {/* Page size selector */}
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="page-size"
            className="text-xs text-muted-erp"
          >
            Rows per page:
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) =>
              table.setPageSize(Number(e.target.value))
            }
            className={cn(
              'h-7 rounded border border-erp bg-background px-2 text-xs',
              'focus:outline-none focus:ring-2 focus:ring-ring',
            )}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <button
          className={buttonClass}
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          aria-label="First page"
        >
          <ChevronsLeft className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          className={buttonClass}
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </button>

        <span className="px-2 text-xs text-muted-erp" aria-live="polite">
          Page {pageIndex + 1} of {pageCount || 1}
        </span>

        <button
          className={buttonClass}
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          className={buttonClass}
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={!table.getCanNextPage()}
          aria-label="Last page"
        >
          <ChevronsRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
