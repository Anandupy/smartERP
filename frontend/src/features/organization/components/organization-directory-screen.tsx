"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Building2, Download, Plus } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROUTES } from "@/constants";
import { useDebouncedValue } from "@/hooks";
import {
  DataTablePagination,
  DataTableToolbar,
} from "@/shared/components/data";
import { BackendPendingNote, EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  ANY_STATUS,
  DIRECTORY_PAGE_SIZE,
  STATUS_FILTER_OPTIONS,
} from "../constants";
import {
  filterOrganizations,
  useDeactivateOrganization,
  useOrganizations,
} from "../hooks/use-organizations";
import type { OrganizationDto } from "../types/organization.dto";
import { DeactivateOrganizationDialog } from "./deactivate-organization-dialog";
import { OrganizationsTable } from "./organizations-table";

/**
 * The organization directory.
 *
 * Search, status filtering, sorting and paging all run **in the client**. That
 * is not a shortcut: `GET /organizations` documents no query parameters at
 * all, so there is nothing to send, and the note under the toolbar says so.
 *
 * The status filter deserves its own explanation on screen, which it gets when
 * it returns nothing: the endpoint is documented to list *active*
 * organizations, so filtering to Inactive or Suspended legitimately yields an
 * empty table. Leaving the user to guess whether that means "none exist" or
 * "the list never contained them" would be the worse outcome.
 */
export function OrganizationDirectoryScreen() {
  const { organizations, isPending, error, refetch } = useOrganizations();
  const deactivate = useDeactivateOrganization();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ANY_STATUS);
  const [page, setPage] = useState(1);
  const [pendingDeactivation, setPendingDeactivation] =
    useState<OrganizationDto | null>(null);

  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(
    () =>
      filterOrganizations(organizations, { search: debouncedSearch, status }),
    [organizations, debouncedSearch, status],
  );

  const totalPages = Math.max(
    Math.ceil(filtered.length / DIRECTORY_PAGE_SIZE),
    1,
  );
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * DIRECTORY_PAGE_SIZE,
    currentPage * DIRECTORY_PAGE_SIZE,
  );

  const activeFilterCount =
    (debouncedSearch ? 1 : 0) + (status !== ANY_STATUS ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setStatus(ANY_STATUS);
    setPage(1);
  };

  const isNarrowedToUnlisted = status === "INACTIVE" || status === "SUSPENDED";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Directory"
        description="Every organization on the platform — identity, contacts and subscription."
        actions={
          <>
            <Button type="button" variant="outline" disabled>
              <Download />
              Export
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.organizations.create}>
                <Plus />
                New organization
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-3">
        <DataTableToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search name, code, contact, city…"
          searchLabel="Search organizations"
          activeFilterCount={activeFilterCount}
          onClearFilters={resetFilters}
          filters={
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <BackendPendingNote>
          searching, filtering, sorting and paging run in this browser over the
          full list. The organizations endpoint documents no query parameters,
          so none are sent — and no export endpoint is documented either.
        </BackendPendingNote>

        <OrganizationsTable
          organizations={visible}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          onDeactivate={setPendingDeactivation}
          emptyState={
            isNarrowedToUnlisted ? (
              <EmptyState
                icon={Building2}
                title="None of these are listed"
                description="GET /organizations is documented to return active organizations only, so inactive and suspended ones never reach this table."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetFilters}
                  >
                    Reset filters
                  </Button>
                }
              />
            ) : activeFilterCount > 0 ? (
              <EmptyState
                title="No organizations match"
                description="Try a different search term or status."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetFilters}
                  >
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Building2}
                title="No organizations found"
                description="Your institutional directory is currently empty. Create the first organization to get started."
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.organizations.create}>
                      <Plus />
                      Create organization
                    </Link>
                  </Button>
                }
              />
            )
          }
        />

        {filtered.length > 0 ? (
          <DataTablePagination
            page={currentPage}
            pageSize={DIRECTORY_PAGE_SIZE}
            total={filtered.length}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </div>

      <DeactivateOrganizationDialog
        organization={pendingDeactivation}
        isPending={deactivate.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeactivation(null);
        }}
        onConfirm={async (organization) => {
          await deactivate.mutateAsync(organization.id);
          setPendingDeactivation(null);
        }}
      />
    </div>
  );
}
