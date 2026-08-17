"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { EllipsisVertical, Pencil, Power, Trash2 } from "@/assets/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants";
import { DataTable, DataTableColumnHeader } from "@/shared/components/data";

import { resolveIcon } from "../../constants";
import type { ModuleListItemDto } from "../../types/module.dto";
import { ModuleStatusBadge } from "./module-status-badge";

export interface ModulesTableProps {
  modules: ModuleListItemDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onToggleStatus: (module: ModuleListItemDto) => void;
  onDelete: (module: ModuleListItemDto) => void;
}

/**
 * The module registry.
 *
 * `menuCount` comes straight from `_count.menus` — the field Prisma attaches
 * to the admin list row — and doubles as the reason Delete is disabled: the
 * backend blocks deleting a module while any menu still belongs to it.
 */
export function ModulesTable({
  modules,
  isLoading,
  error,
  onRetry,
  emptyState,
  onToggleStatus,
  onDelete,
}: ModulesTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<ModuleListItemDto, unknown>[]>(
    () => [
      {
        accessorKey: "displayOrder",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Order" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            {row.original.displayOrder}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Module" />
        ),
        cell: ({ row }) => {
          const moduleRow = row.original;
          const Icon = resolveIcon(moduleRow.icon);
          return (
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg"
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{moduleRow.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  <code>{moduleRow.code}</code>
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: "menuCount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Menus" />
        ),
        accessorFn: (moduleRow) => moduleRow._count.menus,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original._count.menus}
          </span>
        ),
      },
      {
        id: "system",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Origin" />
        ),
        cell: ({ row }) =>
          row.original.isSystem ? (
            <Badge variant="outline">System</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">Custom</span>
          ),
      },
      {
        id: "status",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => <ModuleStatusBadge module={row.original} />,
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const moduleRow = row.original;
          const canDelete = moduleRow._count.menus === 0 && !moduleRow.isSystem;

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
                    aria-label={`Actions for ${moduleRow.name}`}
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(ROUTES.app.workspaceAdmin.modules.edit(moduleRow.id))
                    }
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onToggleStatus(moduleRow)}>
                    <Power aria-hidden="true" />
                    {moduleRow.isActive ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={!canDelete}
                    onSelect={() => onDelete(moduleRow)}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete module
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onDelete, onToggleStatus, router],
  );

  return (
    <DataTable
      caption="Navigation modules"
      columns={columns}
      data={modules}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(module) => module.id}
      onRowClick={(module) =>
        router.push(ROUTES.app.workspaceAdmin.modules.detail(module.id))
      }
    />
  );
}
