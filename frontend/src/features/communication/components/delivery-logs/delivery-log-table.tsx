"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { DataTable } from "@/shared/components/data";
import { formatDateTime } from "@/utils";

import type { DeliveryLogDto } from "../../types/delivery-log.dto";
import { ChannelBadge } from "../channel-badge";
import { DeliveryStatusBadge } from "../delivery-status-badge";

export interface DeliveryLogTableProps {
  logs: DeliveryLogDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onSelect: (log: DeliveryLogDto) => void;
}

/**
 * The delivery log table — mirrors the audit trail's table: rows open a
 * detail drawer rather than a route, and sorting is not wired to headers
 * since no `sortBy` parameter is documented for this endpoint.
 */
export function DeliveryLogTable({
  logs,
  isLoading,
  error,
  onRetry,
  emptyState,
  onSelect,
}: DeliveryLogTableProps) {
  const columns = useMemo<ColumnDef<DeliveryLogDto, unknown>[]>(
    () => [
      {
        id: "createdAt",
        header: () => <HeaderLabel>Created</HeaderLabel>,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {row.original.createdAt ? formatDateTime(row.original.createdAt) : "—"}
          </span>
        ),
      },
      {
        id: "recipient",
        header: () => <HeaderLabel>Recipient</HeaderLabel>,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.original.recipient ?? "—"}
            </p>
            {row.original.subject ? (
              <p className="text-muted-foreground truncate text-xs">
                {row.original.subject}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "channel",
        header: () => <HeaderLabel>Channel</HeaderLabel>,
        cell: ({ row }) => <ChannelBadge channel={row.original.channel} />,
      },
      {
        id: "provider",
        header: () => <HeaderLabel>Provider</HeaderLabel>,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.provider ?? "—"}
          </span>
        ),
      },
      {
        id: "status",
        header: () => <HeaderLabel>Status</HeaderLabel>,
        cell: ({ row }) => <DeliveryStatusBadge status={row.original.status} />,
      },
      {
        id: "latency",
        header: () => <HeaderLabel>Latency</HeaderLabel>,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {typeof row.original.latencyMs === "number"
              ? `${row.original.latencyMs} ms`
              : "—"}
          </span>
        ),
      },
      {
        id: "retries",
        header: () => <HeaderLabel>Retries</HeaderLabel>,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.retryCount ?? 0}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      caption="Delivery logs"
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

function HeaderLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
      {children}
    </span>
  );
}
