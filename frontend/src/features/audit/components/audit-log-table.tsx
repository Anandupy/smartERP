"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { StatusBadge } from "@/shared/components/data-display";
import { DataTable } from "@/shared/components/data";
import { formatDateTime } from "@/utils";

import { actionTone } from "../constants";
import type { AuditLogDto } from "../types/audit.dto";

export interface AuditLogTableProps {
  logs: AuditLogDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onSelect: (log: AuditLogDto) => void;
}

/**
 * The audit trail.
 *
 * Sorting is **not** wired to the column headers. The endpoint sorts on four
 * documented fields (`timestamp`, `severity`, `module`, `executionTime`), which
 * is not the same set as the columns shown — offering a sort control on
 * "Changed by" that the server cannot honour would be a button that lies. The
 * documented fields are offered explicitly in the toolbar instead.
 *
 * Rows open the detail drawer rather than a route: the drawer keeps the
 * filters, page and scroll position the user got here with, which on a table
 * that is regularly thousands of rows deep is the difference between
 * inspecting three records and re-finding them twice.
 */
export function AuditLogTable({
  logs,
  isLoading,
  error,
  onRetry,
  emptyState,
  onSelect,
}: AuditLogTableProps) {
  const columns = useMemo<ColumnDef<AuditLogDto, unknown>[]>(
    () => [
      {
        accessorKey: "eventName",
        enableSorting: false,
        header: () => <HeaderLabel>Event</HeaderLabel>,
        cell: ({ row }) => {
          const log = row.original;
          return (
            <div className="min-w-0">
              <p className="truncate font-medium">{log.eventName}</p>
              <p className="text-muted-foreground truncate text-xs">
                {log.aggregateType}
                {log.aggregateId ? ` · ${log.aggregateId}` : ""}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "action",
        enableSorting: false,
        header: () => <HeaderLabel>Action</HeaderLabel>,
        cell: ({ row }) => (
          <StatusBadge tone={actionTone(row.original.action)}>
            {row.original.action}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "module",
        enableSorting: false,
        header: () => <HeaderLabel>Module</HeaderLabel>,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.module}
          </span>
        ),
      },
      {
        id: "actor",
        enableSorting: false,
        header: () => <HeaderLabel>Changed by</HeaderLabel>,
        cell: ({ row }) => {
          const log = row.original;
          return (
            <div className="min-w-0">
              <p className="truncate text-sm">
                {log.userEmail ?? log.userId ?? "System"}
              </p>
              {log.role ? (
                <p className="text-muted-foreground truncate text-xs">
                  {log.role}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "timestamp",
        enableSorting: false,
        header: () => <HeaderLabel>When</HeaderLabel>,
        cell: ({ row }) => (
          <time
            dateTime={row.original.timestamp}
            className="text-muted-foreground text-sm whitespace-nowrap"
          >
            {formatDateTime(row.original.timestamp)}
          </time>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      caption="Audit log entries"
      columns={columns}
      data={logs}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(log) => log.id}
      onRowClick={onSelect}
      skeletonRows={10}
    />
  );
}

/** Non-sortable column label, matching the sortable header's type scale. */
function HeaderLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
      {children}
    </span>
  );
}
