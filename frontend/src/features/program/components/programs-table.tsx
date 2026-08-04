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

import { programState } from "../constants";
import { formatProgramClassification } from "../mappers/program.mapper";
import type { ProgramDto } from "../types/program.dto";
import { ProgramStatusBadge } from "./program-status-badge";

export interface ProgramsTableProps {
  programs: ProgramDto[];
  /** The branch's full list, so a parent name can be resolved for any row. */
  allPrograms: readonly ProgramDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onToggleStatus: (program: ProgramDto) => void;
  onDelete: (program: ProgramDto) => void;
}

/**
 * The program directory.
 *
 * Columns are built from documented fields only. The design also shows enrolled
 * students and unit counts per program; those belong to other modules and no
 * program-scoped endpoint is documented for either, so an empty column would
 * imply the backend returned nothing when it was never asked.
 *
 * The parent is shown as a **name** rather than an id, resolved from the
 * branch's own list. That is safe precisely because the list is the whole
 * branch — rule 2 guarantees a parent is in the same branch, so it is either in
 * this list or it is genuinely unreachable, and the column says so rather than
 * printing a bare uuid.
 *
 * The status action is withheld when the current state is unknown: the toggle
 * takes no body and therefore flips rather than sets, so offering it against an
 * unreported flag would be a control whose effect nobody can predict.
 */
export function ProgramsTable({
  programs,
  allPrograms,
  isLoading,
  error,
  onRetry,
  emptyState,
  onToggleStatus,
  onDelete,
}: ProgramsTableProps) {
  const router = useRouter();

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const program of allPrograms) map.set(program.id, program.name);
    return map;
  }, [allPrograms]);

  const columns = useMemo<ColumnDef<ProgramDto, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Program" />
        ),
        cell: ({ row }) => {
          const classification = formatProgramClassification(row.original);
          return (
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.name}</p>
              {classification ? (
                <p className="text-muted-foreground truncate text-xs">
                  {classification}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "level",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Level" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.level || "—"}
          </span>
        ),
      },
      {
        id: "parent",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Parent" />
        ),
        cell: ({ row }) => {
          const parentId = row.original.parentId;
          if (!parentId) {
            return (
              <span className="text-muted-foreground text-sm">Top level</span>
            );
          }
          const name = nameById.get(parentId);
          return (
            <span className="text-muted-foreground truncate text-sm">
              {name ?? "Not in this branch's list"}
            </span>
          );
        },
      },
      {
        id: "state",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => <ProgramStatusBadge program={row.original} />,
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const program = row.original;
          const canToggle = programState(program) !== "unknown";

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
                    aria-label={`Actions for ${program.name}`}
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(ROUTES.app.programs.detail(program.id))
                    }
                  >
                    <Eye aria-hidden="true" />
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(ROUTES.app.programs.edit(program.id))
                    }
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>
                  {canToggle ? (
                    <DropdownMenuItem onSelect={() => onToggleStatus(program)}>
                      <Power aria-hidden="true" />
                      {programState(program) === "active"
                        ? "Deactivate program"
                        : "Activate program"}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDelete(program)}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete program
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [nameById, onDelete, onToggleStatus, router],
  );

  return (
    <DataTable
      caption="Programs"
      columns={columns}
      data={programs}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(program) => program.id}
      onRowClick={(program) =>
        router.push(ROUTES.app.programs.detail(program.id))
      }
    />
  );
}
