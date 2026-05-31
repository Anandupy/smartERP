'use client';

import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type OnChangeFn,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { DataTablePagination } from './data-table-pagination';

// ── Types ─────────────────────────────────────────────────────

export interface DataTableProps<TData, TValue = unknown> {
  /** Column definitions — created with TanStack Table's ColumnDef */
  columns: ColumnDef<TData, TValue>[];
  /** Row data */
  data: TData[];
  /** Loading state — shows skeleton rows */
  isLoading?: boolean;
  /** Empty state — shown when data is empty and not loading */
  emptyState?: React.ReactNode;
  /** Pagination state (controlled) */
  pagination?: PaginationState;
  /** Total row count (for server-side pagination) */
  rowCount?: number;
  /** Pagination change handler */
  onPaginationChange?: OnChangeFn<PaginationState>;
  /** Sorting state (controlled) */
  sorting?: SortingState;
  /** Sort change handler */
  onSortingChange?: OnChangeFn<SortingState>;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Additional table class names */
  className?: string;
  /** Compact density override */
  dense?: boolean;
}

// ── Skeleton Row ──────────────────────────────────────────────

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr aria-hidden>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-skeleton rounded bg-surface-2" />
        </td>
      ))}
    </tr>
  );
}

// ── Sort Header ───────────────────────────────────────────────

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp className="h-3.5 w-3.5" />;
  if (sorted === 'desc') return <ChevronDown className="h-3.5 w-3.5" />;
  return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />;
}

// ── DataTable ─────────────────────────────────────────────────

/**
 * Enterprise DataTable Engine.
 *
 * Built on TanStack Table v8 with server-side pagination and sorting.
 *
 * Features:
 * - Controlled pagination (server-side)
 * - Controlled sorting (server-side)
 * - Row click handler
 * - Loading skeleton
 * - Empty state
 * - Dense/comfortable density modes
 * - Accessible (ARIA table semantics)
 *
 * Usage:
 * ```tsx
 * <DataTable
 *   columns={branchColumns}
 *   data={branches}
 *   isLoading={isLoading}
 *   pagination={pagination}
 *   rowCount={total}
 *   onPaginationChange={setPagination}
 *   onRowClick={(branch) => openDrawer(branch.id)}
 *   emptyState={<EmptyState title="No branches" />}
 * />
 * ```
 */
export function DataTable<TData, TValue = unknown>({
  columns,
  data,
  isLoading = false,
  emptyState,
  pagination,
  rowCount,
  onPaginationChange,
  sorting,
  onSortingChange,
  onRowClick,
  className,
  dense = false,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    rowCount,
    state: {
      ...(pagination && { pagination }),
      ...(sorting && { sorting }),
    },
    ...(onPaginationChange && {
      onPaginationChange,
      manualPagination: true,
    }),
    ...(onSortingChange && {
      onSortingChange,
      manualSorting: true,
    }),
    getCoreRowModel: getCoreRowModel(),
  });

  const rowHeight = dense
    ? 'h-[var(--table-row-height)]'
    : 'h-[var(--table-row-height)]';

  return (
    <div className={cn('overflow-hidden rounded-lg border border-erp', className)}>
      {/* Table */}
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-left"
          aria-label="Data table"
        >
          {/* Header */}
          <thead className="border-b border-erp bg-surface-2">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn(
                        'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-erp',
                        canSort && 'cursor-pointer select-none hover:text-foreground',
                      )}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                          ? 'descending'
                          : canSort
                          ? 'none'
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        {canSort && <SortIcon sorted={sorted} />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-erp bg-background">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: pagination?.pageSize ?? 10 }).map((_, i) => (
                <SkeletonRow key={i} columns={columns.length} />
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              // Empty state
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center"
                >
                  {emptyState ?? (
                    <p className="text-sm text-muted-erp">No records found.</p>
                  )}
                </td>
              </tr>
            ) : (
              // Data rows
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    rowHeight,
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-surface-2',
                  )}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row.original);
                          }
                        }
                      : undefined
                  }
                  role={onRowClick ? 'button' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && onPaginationChange && (
        <DataTablePagination
          table={table}
          rowCount={rowCount ?? 0}
        />
      )}
    </div>
  );
}
