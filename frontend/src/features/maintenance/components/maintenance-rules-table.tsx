"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import {
  Ban,
  CircleCheckBig,
  EllipsisVertical,
  Pencil,
  Trash2,
} from "@/assets/icons";
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

import { SCOPE_PRESENTATION, statusTone } from "../constants";
import type { MaintenanceRuleDto } from "../types/maintenance.dto";

export interface MaintenanceRulesTableProps {
  rules: MaintenanceRuleDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onDelete: (rule: MaintenanceRuleDto) => void;
}

/** Compact summary of when a rule applies, from whichever fields are set. */
function scheduleSummary(rule: MaintenanceRuleDto): string {
  if (rule.isRecurring) {
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      rule.recurrenceDayOfWeek ?? -1
    ];
    if (day && rule.recurrenceStartTime && rule.recurrenceEndTime) {
      return `${day} ${rule.recurrenceStartTime}–${rule.recurrenceEndTime}`;
    }
    return "Weekly";
  }

  if (rule.startAt || rule.endAt) {
    const format = (value: string | null | undefined) =>
      value ? new Date(value).toLocaleDateString() : "…";
    return `${format(rule.startAt)} → ${format(rule.endAt)}`;
  }

  return "Immediate";
}

/**
 * The rules list.
 *
 * Columns are ordered by the question they answer: *what is covered*, *is it
 * on*, *what still works*, *when*. The access column is three glyphs rather
 * than three words, because the comparison across rows is the point — an
 * operator scanning for "which rule is blocking writes" reads a column of
 * icons far faster than a column of sentences.
 *
 * Rows open the editor; destructive actions live behind an explicit menu, so a
 * mis-click on a row can never delete a rule.
 */
export function MaintenanceRulesTable({
  rules,
  isLoading,
  error,
  onRetry,
  emptyState,
  onDelete,
}: MaintenanceRulesTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<MaintenanceRuleDto, unknown>[]>(
    () => [
      {
        accessorKey: "scopeType",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Scope" />
        ),
        cell: ({ row }) => {
          const rule = row.original;
          const scope = SCOPE_PRESENTATION[rule.scopeType];
          const Icon = scope.icon;

          return (
            <div className="flex items-start gap-2">
              <Icon
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {rule.title?.trim() || scope.label}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {rule.scopeId
                    ? `${scope.label} · ${rule.scopeId}`
                    : scope.label}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <StatusBadge tone={statusTone(row.original.isActive)} dot>
            {row.original.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        ),
      },
      {
        id: "access",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Allowed" />
        ),
        cell: ({ row }) => {
          const rule = row.original;
          const flags: [string, boolean][] = [
            ["Sign-in", rule.allowLogin],
            ["Reads", rule.allowReadApis],
            ["Writes", rule.allowWriteApis],
          ];

          return (
            <ul className="flex items-center gap-3">
              {flags.map(([label, allowed]) => (
                <li key={label} className="flex items-center gap-1">
                  {allowed ? (
                    <CircleCheckBig
                      aria-hidden="true"
                      className="text-chart-2 size-3.5"
                    />
                  ) : (
                    <Ban
                      aria-hidden="true"
                      className="text-destructive size-3.5"
                    />
                  )}
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <span className="sr-only">
                    {allowed ? "allowed" : "blocked"}
                  </span>
                </li>
              ))}
            </ul>
          );
        },
      },
      {
        id: "schedule",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="When" />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{scheduleSummary(row.original)}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.timezone}
            </p>
          </div>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const rule = row.original;

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
                    aria-label={`Actions for ${rule.title?.trim() || rule.id}`}
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(ROUTES.app.maintenance.edit(rule.id))
                    }
                  >
                    <Pencil aria-hidden="true" />
                    Edit rule
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDelete(rule)}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete rule
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onDelete, router],
  );

  return (
    <DataTable
      caption="Maintenance rules"
      columns={columns}
      data={rules}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(rule) => rule.id}
      onRowClick={(rule) => router.push(ROUTES.app.maintenance.edit(rule.id))}
    />
  );
}
