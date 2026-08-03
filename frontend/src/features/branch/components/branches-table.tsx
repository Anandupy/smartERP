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
import { DataTable, DataTableColumnHeader } from "@/shared/components/data";

import { INSTITUTION_TYPE_PRESENTATION } from "../constants";
import type { BranchDto } from "../types/branch.dto";
import { nextToggleAction } from "../utils/branch-lifecycle";
import { BranchStatusBadge } from "./branch-status-badge";

export interface BranchesTableProps {
  branches: BranchDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onToggleStatus: (branch: BranchDto) => void;
  onDelete: (branch: BranchDto) => void;
}

/**
 * The branch directory.
 *
 * Columns are built from documented fields only. The design also shows student
 * and faculty counts and a "programs offered" figure; those belong to other
 * modules and no branch-scoped endpoint is documented for them, so an empty
 * column would imply the backend returned nothing when it was never asked.
 *
 * The status action is labelled from `nextToggleAction`, which returns `null`
 * when the current state is unknown or the branch is deleted — the toggle takes
 * no body and therefore flips rather than sets, so offering it against an
 * unknown state would be a control whose effect nobody can predict.
 */
export function BranchesTable({
  branches,
  isLoading,
  error,
  onRetry,
  emptyState,
  onToggleStatus,
  onDelete,
}: BranchesTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<BranchDto, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Branch" />
        ),
        cell: ({ row }) => {
          const branch = row.original;
          return (
            <div className="min-w-0">
              <p className="truncate font-medium">{branch.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                <code>{branch.code}</code>
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "institutionType",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        cell: ({ row }) => {
          const type = row.original.institutionType;
          if (!type) {
            return <span className="text-muted-foreground text-sm">—</span>;
          }

          const presentation = INSTITUTION_TYPE_PRESENTATION[type];
          const Icon = presentation.icon;

          return (
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {presentation.label}
            </span>
          );
        },
      },
      {
        id: "contact",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Contact" />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.contactEmail}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.contactPhone}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "city",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Location" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {[row.original.city, row.original.country]
              .filter(Boolean)
              .join(", ")}
          </span>
        ),
      },
      {
        id: "state",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => <BranchStatusBadge branch={row.original} />,
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const branch = row.original;
          const toggle = nextToggleAction(branch);

          return (
            <div
              className="flex justify-end"
              // The row is activatable; the menu inside it is not part of that.
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for ${branch.name}`}
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(ROUTES.app.branches.detail(branch.id))
                    }
                  >
                    <Eye aria-hidden="true" />
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(ROUTES.app.branches.edit(branch.id))
                    }
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>
                  {toggle ? (
                    <DropdownMenuItem onSelect={() => onToggleStatus(branch)}>
                      <Power aria-hidden="true" />
                      {toggle.label}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDelete(branch)}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete branch
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
      caption="Branches"
      columns={columns}
      data={branches}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(branch) => branch.id}
      onRowClick={(branch) =>
        router.push(ROUTES.app.branches.detail(branch.id))
      }
    />
  );
}
