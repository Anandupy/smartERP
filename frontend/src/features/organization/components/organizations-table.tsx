"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { EllipsisVertical, Eye, Pencil, Power } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants";
import { DataTable, DataTableColumnHeader } from "@/shared/components/data";

import { expiryState } from "../utils/organization-lifecycle";
import type { OrganizationDto } from "../types/organization.dto";
import { OrganizationStatusBadge } from "./organization-status-badge";

export interface OrganizationsTableProps {
  organizations: OrganizationDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  onDeactivate: (organization: OrganizationDto) => void;
}

/**
 * The organization directory.
 *
 * Columns answer the questions the design's do, minus the ones the contract
 * cannot: the design shows a "Type" (University / K-12 / Corporate) and a
 * created date, and neither is a documented field. Showing an empty column
 * would imply the backend returned nothing when it was never asked.
 *
 * Sorting is client-side and enabled on the columns that hold plain strings —
 * the endpoint documents no `sortBy`, so the alternative is no sorting at all
 * rather than a server round-trip. Rows open the detail screen; deactivation
 * lives behind an explicit menu so a mis-click on a row can never take an
 * organization offline.
 */
export function OrganizationsTable({
  organizations,
  isLoading,
  error,
  onRetry,
  emptyState,
  onDeactivate,
}: OrganizationsTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<OrganizationDto, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Organization" />
        ),
        cell: ({ row }) => {
          const organization = row.original;
          return (
            <div className="min-w-0">
              <p className="truncate font-medium">{organization.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                <code>{organization.code}</code>
              </p>
            </div>
          );
        },
      },
      {
        id: "contact",
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Contact" />
        ),
        cell: ({ row }) => {
          const organization = row.original;
          return (
            <div className="min-w-0">
              <p className="truncate text-sm">{organization.contactEmail}</p>
              <p className="text-muted-foreground truncate text-xs">
                {organization.contactPhone}
              </p>
            </div>
          );
        },
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
        accessorKey: "masterExpiryDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Expires" />
        ),
        cell: ({ row }) => {
          const value = row.original.masterExpiryDate;
          const state = expiryState(value);

          return (
            <span
              className={
                state === "expired"
                  ? "text-destructive text-sm font-medium"
                  : state === "expiring"
                    ? "text-chart-4 text-sm font-medium"
                    : "text-muted-foreground text-sm"
              }
            >
              {value || "—"}
              {state === "expired" ? (
                <span className="sr-only"> — past its expiry date</span>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <OrganizationStatusBadge status={row.original.status} />
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const organization = row.original;

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
                    aria-label={`Actions for ${organization.name}`}
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(
                        ROUTES.app.organizations.detail(organization.id),
                      )
                    }
                  >
                    <Eye aria-hidden="true" />
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(
                        ROUTES.app.organizations.edit(organization.id),
                      )
                    }
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDeactivate(organization)}
                  >
                    <Power aria-hidden="true" />
                    Deactivate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onDeactivate, router],
  );

  return (
    <DataTable
      caption="Organizations"
      columns={columns}
      data={organizations}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(organization) => organization.id}
      onRowClick={(organization) =>
        router.push(ROUTES.app.organizations.detail(organization.id))
      }
    />
  );
}
