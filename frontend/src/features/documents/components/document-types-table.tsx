"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { EllipsisVertical, Eye, Lock, Pencil, Power, Trash2 } from "@/assets/icons";
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
import { formatBytes } from "@/utils";

import { ACTIVE_STATE_PRESENTATION, activeState } from "../constants";
import type { DocumentTypeDto } from "../types/document.dto";

export interface DocumentTypesTableProps {
  types: DocumentTypeDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onToggleActive: (type: DocumentTypeDto) => void;
  onDelete: (type: DocumentTypeDto) => void;
}

/** The directory table for Document Types. */
export function DocumentTypesTable({
  types,
  isLoading,
  error,
  onRetry,
  emptyState,
  onToggleActive,
  onDelete,
}: DocumentTypesTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<DocumentTypeDto, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-medium">
              {row.original.name}
              {row.original.isSensitive ? (
                <Lock aria-label="Sensitive" className="text-muted-foreground size-3.5 shrink-0" />
              ) : null}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              <code>{row.original.code}</code>
            </p>
          </div>
        ),
      },
      {
        id: "fileRules",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="File rules" />,
        cell: ({ row }) => (
          <div className="text-muted-foreground text-xs">
            <p className="truncate">
              {row.original.allowedMimeTypes.length} type
              {row.original.allowedMimeTypes.length === 1 ? "" : "s"} · up to{" "}
              {formatBytes(row.original.maxSizeBytes)}
            </p>
          </div>
        ),
      },
      {
        id: "expiry",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Expiry" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.hasExpiry
              ? `${row.original.defaultValidityMonths ?? "—"} mo`
              : "No expiry"}
          </span>
        ),
      },
      {
        id: "status",
        enableSorting: false,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const presentation = ACTIVE_STATE_PRESENTATION[activeState(row.original)];
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
          const type = row.original;
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
                    aria-label={`Actions for ${type.name}`}
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => router.push(ROUTES.app.documents.types.detail(type.id))}
                  >
                    <Eye aria-hidden="true" />
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => router.push(ROUTES.app.documents.types.edit(type.id))}
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onToggleActive(type)}>
                    <Power aria-hidden="true" />
                    {type.isActive ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(type)}>
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
    [onDelete, onToggleActive, router],
  );

  return (
    <DataTable
      caption="Document Types"
      columns={columns}
      data={types}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(type) => type.id}
      onRowClick={(type) => router.push(ROUTES.app.documents.types.detail(type.id))}
    />
  );
}
