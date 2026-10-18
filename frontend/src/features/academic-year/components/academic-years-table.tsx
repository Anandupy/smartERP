"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import {
  CalendarCheck,
  CircleCheckBig,
  EllipsisVertical,
  Eye,
  Lock,
  Pencil,
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
import { formatDate, formatNumber } from "@/utils";

import type { AcademicYearDto } from "../types/academic-year.dto";
import {
  availableLifecycleActions,
  deleteBlockedReason,
  editBlockedReason,
  type LifecycleAction,
} from "../utils/academic-year-lifecycle";
import { academicYearProgress } from "../utils/academic-year-timeline";
import { AcademicYearStatusBadge } from "./academic-year-status-badge";

/** The glyph each documented transition leads with, matching the dialogs. */
const TRANSITION_ICON = {
  activate: CircleCheckBig,
  select: CalendarCheck,
  lock: Lock,
} as const;

export interface AcademicYearsTableProps {
  academicYears: AcademicYearDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onTransition: (year: AcademicYearDto, action: LifecycleAction) => void;
  onDelete: (year: AcademicYearDto) => void;
}

/**
 * The academic year directory.
 *
 * Columns are built from documented fields only: name, the date range, the
 * derived state, and a progress figure computed from the two dates. The design
 * also shows enrolled-student and class counts per year; those belong to other
 * modules, and no year-scoped endpoint is documented for either, so an empty
 * column would imply the backend returned nothing when it was never asked.
 *
 * The row menu is built from `availableLifecycleActions`, so an action the
 * documented rules forbid is **absent rather than disabled** — a year is never
 * offered a transition it already reports. Edit and delete are the exception and stay
 * visible with their reason as a tooltip, because their absence would otherwise
 * read as a missing feature rather than as a rule doing its job.
 */
export function AcademicYearsTable({
  academicYears,
  isLoading,
  error,
  onRetry,
  emptyState,
  onTransition,
  onDelete,
}: AcademicYearsTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<AcademicYearDto, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Academic year" />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              <code>{row.original.id}</code>
            </p>
          </div>
        ),
      },
      {
        accessorKey: "startDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Starts" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {formatDate(row.original.startDate) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "endDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Ends" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {formatDate(row.original.endDate) || "—"}
          </span>
        ),
      },
      {
        id: "progress",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Progress" />
        ),
        cell: ({ row }) => {
          const { percentComplete } = academicYearProgress(row.original);
          if (percentComplete === null) {
            return <span className="text-muted-foreground text-sm">—</span>;
          }
          return (
            <span className="text-muted-foreground text-sm tabular-nums">
              {formatNumber(percentComplete)}%
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
        cell: ({ row }) => <AcademicYearStatusBadge year={row.original} />,
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const year = row.original;
          const actions = availableLifecycleActions(year);
          const cannotEdit = editBlockedReason(year);
          const cannotDelete = deleteBlockedReason(year);

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
                    aria-label={`Actions for ${year.name}`}
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(ROUTES.app.academicYears.detail(year.id))
                    }
                  >
                    <Eye aria-hidden="true" />
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={cannotEdit !== null}
                    title={cannotEdit ?? undefined}
                    onSelect={() =>
                      router.push(ROUTES.app.academicYears.edit(year.id))
                    }
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>

                  {actions.length > 0 ? <DropdownMenuSeparator /> : null}
                  {actions.map((action) => {
                    const Icon = TRANSITION_ICON[action.transition];
                    return (
                      <DropdownMenuItem
                        key={action.transition}
                        onSelect={() => onTransition(year, action)}
                      >
                        <Icon aria-hidden="true" />
                        {action.label}
                      </DropdownMenuItem>
                    );
                  })}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={cannotDelete !== null}
                    title={cannotDelete ?? undefined}
                    onSelect={() => onDelete(year)}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete year
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onDelete, onTransition, router],
  );

  return (
    <DataTable
      caption="Academic years"
      columns={columns}
      data={academicYears}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(year) => year.id}
      onRowClick={(year) =>
        router.push(ROUTES.app.academicYears.detail(year.id))
      }
    />
  );
}
