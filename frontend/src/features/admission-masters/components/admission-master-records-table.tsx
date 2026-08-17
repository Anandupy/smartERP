"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { EllipsisVertical, Eye, Pencil, Power, Trash2 } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants";
import { StatusBadge } from "@/shared/components/data-display";
import { DataTable, DataTableColumnHeader } from "@/shared/components/data";

import { ADMISSION_MASTER_STATE_PRESENTATION, admissionMasterState } from "../constants";
import type { AdmissionMasterConfig } from "../config/admission-master-registry";
import type { AdmissionMasterDto } from "../types/admission-master.dto";

export interface AdmissionMastersTableProps {
  config: AdmissionMasterConfig;
  masters: AdmissionMasterDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onToggleActive: (master: AdmissionMasterDto) => void;
  onDelete: (master: AdmissionMasterDto) => void;
}

/**
 * The directory table for one admission master resource.
 *
 * Columns are exactly the documented fields: code, name, description, display
 * order, status, last updated. Nothing from the user's original sketch that
 * has no backing field (record counts, usage figures) is here.
 */
export function AdmissionMastersTable({
  config,
  masters,
  isLoading,
  error,
  onRetry,
  emptyState,
  onToggleActive,
  onDelete,
}: AdmissionMastersTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<AdmissionMasterDto, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              <code>{row.original.code}</code>
            </p>
          </div>
        ),
      },
      {
        accessorKey: "description",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground line-clamp-2 text-sm">
            {row.original.description ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "displayOrder",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Display order" align="end" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground block text-right text-sm">
            {row.original.displayOrder}
          </span>
        ),
      },
      {
        id: "status",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const presentation =
            ADMISSION_MASTER_STATE_PRESENTATION[
              admissionMasterState(row.original)
            ];
          return (
            <StatusBadge tone={presentation.tone} dot>
              {presentation.label}
            </StatusBadge>
          );
        },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const master = row.original;

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
                    aria-label={`Actions for ${master.name}`}
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(ROUTES.app.admissionMasters.detail(config.resource, master.id))
                    }
                  >
                    <Eye aria-hidden="true" />
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(ROUTES.app.admissionMasters.edit(config.resource, master.id))
                    }
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onToggleActive(master)}>
                    <Power aria-hidden="true" />
                    {master.isActive ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDelete(master)}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [config.resource, onDelete, onToggleActive, router],
  );

  return (
    <DataTable
      caption={config.pluralLabel}
      columns={columns}
      data={masters}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(master) => master.id}
      onRowClick={(master) =>
        router.push(ROUTES.app.admissionMasters.detail(config.resource, master.id))
      }
    />
  );
}
