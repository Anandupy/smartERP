"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import {
  ArrowLeftRight,
  EllipsisVertical,
  Eye,
  Pencil,
  Power,
  Trash2,
} from "@/assets/icons";
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

import { academicUnitState } from "../constants";
import { formatUnitIdentity } from "../mappers/academic-unit.mapper";
import type { AcademicUnitDto } from "../types/academic-unit.dto";
import { AcademicUnitStatusBadge } from "./academic-unit-status-badge";

export interface AcademicUnitsTableProps {
  units: AcademicUnitDto[];
  /** The scope's full list, so a parent name can be resolved for any row. */
  allUnits: readonly AcademicUnitDto[];
  /** Program names by id, supplied by the route. See below. */
  programNames?: ReadonlyMap<string, string>;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onMove: (unit: AcademicUnitDto) => void;
  onToggleStatus: (unit: AcademicUnitDto) => void;
  onDelete: (unit: AcademicUnitDto) => void;
}

/**
 * The academic unit directory.
 *
 * A flat table alongside the tree, because the two answer different questions:
 * the tree shows where a unit sits, this shows every unit at once so it can be
 * searched, sorted and filtered.
 *
 * `programNames` arrives as plain data from the route rather than being looked
 * up here — the program list belongs to another feature, and this module never
 * learns that a Program module exists. Without the map the column shows the id,
 * which is still true, just less readable.
 */
export function AcademicUnitsTable({
  units,
  allUnits,
  programNames,
  isLoading,
  error,
  onRetry,
  emptyState,
  onMove,
  onToggleStatus,
  onDelete,
}: AcademicUnitsTableProps) {
  const router = useRouter();

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const unit of allUnits) map.set(unit.id, unit.name);
    return map;
  }, [allUnits]);

  const columns = useMemo<ColumnDef<AcademicUnitDto, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Unit" />
        ),
        cell: ({ row }) => {
          const identity = formatUnitIdentity(row.original);
          return (
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.name}</p>
              {identity ? (
                <p className="text-muted-foreground truncate text-xs">
                  {identity}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "programId",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Program" />
        ),
        cell: ({ row }) => {
          const id = row.original.programId;
          const name = programNames?.get(id);
          return (
            <span className="text-muted-foreground truncate text-sm">
              {name ?? <code>{id}</code>}
            </span>
          );
        },
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
          return (
            <span className="text-muted-foreground truncate text-sm">
              {nameById.get(parentId) ?? "Not in this scope's list"}
            </span>
          );
        },
      },
      {
        accessorKey: "level",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Level" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            {typeof row.original.level === "number" ? row.original.level : "—"}
          </span>
        ),
      },
      {
        accessorKey: "displayOrder",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Order" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            {typeof row.original.displayOrder === "number"
              ? row.original.displayOrder
              : "—"}
          </span>
        ),
      },
      {
        id: "state",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => <AcademicUnitStatusBadge unit={row.original} />,
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const unit = row.original;
          const canToggle = academicUnitState(unit) !== "unknown";

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
                    aria-label={`Actions for ${unit.name}`}
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(ROUTES.app.academicUnits.detail(unit.id))
                    }
                  >
                    <Eye aria-hidden="true" />
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(ROUTES.app.academicUnits.edit(unit.id))
                    }
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onMove(unit)}>
                    <ArrowLeftRight aria-hidden="true" />
                    Move in hierarchy
                  </DropdownMenuItem>
                  {canToggle ? (
                    <DropdownMenuItem onSelect={() => onToggleStatus(unit)}>
                      <Power aria-hidden="true" />
                      {academicUnitState(unit) === "active"
                        ? "Deactivate unit"
                        : "Activate unit"}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDelete(unit)}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete unit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [nameById, onDelete, onMove, onToggleStatus, programNames, router],
  );

  return (
    <DataTable
      caption="Academic units"
      columns={columns}
      data={units}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(unit) => unit.id}
      onRowClick={(unit) =>
        router.push(ROUTES.app.academicUnits.detail(unit.id))
      }
    />
  );
}
