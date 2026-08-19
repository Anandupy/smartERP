"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { ROUTES } from "@/constants";
import { DataTable } from "@/shared/components/data";
import { formatDate } from "@/utils";

import type { ApplicantDto } from "../types/applicant.dto";
import { ApplicantStatusBadge } from "./applicant-status-badge";

export interface ApplicantsTableProps {
  applicants: ApplicantDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
}

/**
 * The applicants directory table.
 *
 * Sorting is not wired to column headers — the server's documented `sortBy`
 * is a free string with no enumerated field list, so offering a click-to-sort
 * control that might silently no-op would be a control that lies. The
 * toolbar's explicit sort control (if one is added later) is the place for
 * that, not the header.
 *
 * Guardian and document counts are deliberately absent from this table: no
 * list endpoint returns them, and fabricating "3/5 verified" here is exactly
 * the kind of invented figure AGENTS.md §28 forbids.
 */
export function ApplicantsTable({
  applicants,
  isLoading,
  error,
  onRetry,
  emptyState,
}: ApplicantsTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<ApplicantDto, unknown>[]>(
    () => [
      {
        accessorKey: "applicationNo",
        enableSorting: false,
        header: () => <HeaderLabel>Application</HeaderLabel>,
        cell: ({ row }) => {
          const applicant = row.original;
          return (
            <div className="min-w-0">
              <p className="truncate font-medium">{applicant.displayName}</p>
              <p className="text-muted-foreground truncate text-xs">
                {applicant.applicationNo ?? "No application number yet"}
              </p>
            </div>
          );
        },
      },
      {
        id: "status",
        enableSorting: false,
        header: () => <HeaderLabel>Status</HeaderLabel>,
        cell: ({ row }) => (
          <ApplicantStatusBadge status={row.original.admissionStatus} />
        ),
      },
      {
        id: "contact",
        enableSorting: false,
        header: () => <HeaderLabel>Contact</HeaderLabel>,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.primaryMobile}</p>
            {row.original.primaryEmail ? (
              <p className="text-muted-foreground truncate text-xs">
                {row.original.primaryEmail}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "updatedAt",
        enableSorting: false,
        header: () => <HeaderLabel>Updated</HeaderLabel>,
        cell: ({ row }) => (
          <time
            dateTime={row.original.updatedAt}
            className="text-muted-foreground text-sm whitespace-nowrap"
          >
            {formatDate(row.original.updatedAt)}
          </time>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      caption="Applicants"
      columns={columns}
      data={applicants}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      getRowId={(applicant) => applicant.id}
      onRowClick={(applicant) =>
        router.push(ROUTES.app.admissions.applicants.detail(applicant.id))
      }
    />
  );
}

function HeaderLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
      {children}
    </span>
  );
}
