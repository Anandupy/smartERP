"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { EllipsisVertical, Eye, Pencil } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants";
import { StatusBadge } from "@/shared/components/data-display";
import { DataTable, DataTableColumnHeader } from "@/shared/components/data";

import { ALLOCATION_MODE_LABEL, RESET_STRATEGY_LABEL, SCOPE_LABEL, purposeLabel } from "../constants";
import type { NumberingConfigDto } from "../types/numbering.dto";

export interface NumberingConfigsTableProps {
  configs: NumberingConfigDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onPreview: (config: NumberingConfigDto) => void;
}

/** The directory table for Numbering sequence configs. */
export function NumberingConfigsTable({
  configs,
  isLoading,
  error,
  onRetry,
  emptyState,
  onPreview,
}: NumberingConfigsTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<NumberingConfigDto, unknown>[]>(
    () => [
      {
        id: "purpose",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Purpose" />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{purposeLabel(row.original.purpose)}</p>
            <p className="text-muted-foreground truncate text-xs">
              <code>{row.original.purpose}</code>
            </p>
          </div>
        ),
      },
      {
        id: "format",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Format" />,
        cell: ({ row }) => (
          <code className="text-muted-foreground text-xs">{row.original.format}</code>
        ),
      },
      {
        id: "scope",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Scope" />,
        cell: ({ row }) => (
          <span className="text-sm">{SCOPE_LABEL[row.original.scope] ?? row.original.scope}</span>
        ),
      },
      {
        id: "allocationMode",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Allocation" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {ALLOCATION_MODE_LABEL[row.original.allocationMode] ?? row.original.allocationMode}
          </span>
        ),
      },
      {
        id: "resetStrategy",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Reset" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {RESET_STRATEGY_LABEL[row.original.resetStrategy] ?? row.original.resetStrategy}
          </span>
        ),
      },
      {
        id: "status",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <StatusBadge tone={row.original.isActive ? "success" : "neutral"} dot>
            {row.original.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const config = row.original;
          return (
            <div
              className="flex justify-end"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for ${purposeLabel(config.purpose)}`}
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onPreview(config)}>
                    <Eye aria-hidden="true" />
                    Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => router.push(ROUTES.app.settings.numbering.edit(config.id))}
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onPreview, router],
  );

  return (
    <DataTable
      caption="Numbering Sequences"
      columns={columns}
      data={configs}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(config) => config.id}
      onRowClick={(config) => router.push(ROUTES.app.settings.numbering.edit(config.id))}
    />
  );
}
