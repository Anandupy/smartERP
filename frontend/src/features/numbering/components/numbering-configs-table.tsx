"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Eye, Pencil } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { StatusBadge } from "@/shared/components/data-display";
import { DataTable, DataTableColumnHeader } from "@/shared/components/data";

import {
  ALLOCATION_MODE_LABEL,
  RESET_STRATEGY_LABEL,
  SCOPE_LABEL,
  YEAR_FORMAT_LABEL,
  purposeLabel,
} from "../constants";
import type { NumberingConfigDto } from "../types/numbering.dto";
import { FormatBreakdown } from "./format-breakdown";

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
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Purpose" />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {purposeLabel(row.original.purpose)}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              <code>{row.original.purpose}</code>
            </p>
          </div>
        ),
      },
      {
        id: "format",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Format" />
        ),
        cell: ({ row }) => {
          const config = row.original;
          const rendersYear =
            config.includeAcademicYear || config.format.includes("{year}");
          return (
            <div className="min-w-0 space-y-1.5">
              <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                {config.format}
              </code>
              <FormatBreakdown format={config.format} variant="compact" />
              {rendersYear ? (
                <p className="text-muted-foreground/70 truncate text-xs">
                  Year: {YEAR_FORMAT_LABEL[config.yearFormat]}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "scope",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Scope" />
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {SCOPE_LABEL[row.original.scope] ?? row.original.scope}
          </span>
        ),
      },
      {
        id: "allocationMode",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Allocation" />
        ),
        cell: ({ row }) => (
          // Wraps instead of forcing the table wider than the page, which
          // pushed Reset, Status and Actions out of view.
          <span className="text-muted-foreground block min-w-36 text-sm whitespace-normal">
            {ALLOCATION_MODE_LABEL[row.original.allocationMode] ??
              row.original.allocationMode}
          </span>
        ),
      },
      {
        id: "resetStrategy",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Reset" />
        ),
        cell: ({ row }) => (
          // Wraps instead of forcing the table wider than the page, which
          // pushed Reset, Status and Actions out of view.
          <span className="text-muted-foreground block min-w-36 text-sm whitespace-normal">
            {RESET_STRATEGY_LABEL[row.original.resetStrategy] ??
              row.original.resetStrategy}
          </span>
        ),
      },
      {
        id: "status",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
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
              className="flex justify-end gap-1"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Preview ${purposeLabel(config.purpose)}`}
                title="Preview"
                onClick={() => onPreview(config)}
              >
                <Eye aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${purposeLabel(config.purpose)}`}
                title="Edit"
                onClick={() =>
                  router.push(ROUTES.app.settings.numbering.edit(config.id))
                }
              >
                <Pencil aria-hidden="true" />
              </Button>
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
      onRowClick={(config) =>
        router.push(ROUTES.app.settings.numbering.edit(config.id))
      }
    />
  );
}
