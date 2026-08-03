"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Plus, School } from "@/assets/icons";
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
  ANY_STATE,
  ANY_TYPE,
  DIRECTORY_PAGE_SIZE,
  INSTITUTION_TYPE_OPTIONS,
  STATE_FILTER_OPTIONS,
} from "../constants";
import {
  filterBranches,
  useBranches,
  useDeleteBranch,
  useToggleBranchStatus,
} from "../hooks/use-branches";
import type { BranchDto } from "../types/branch.dto";
import { DeleteBranchDialog, ToggleBranchStatusDialog } from "./branch-dialogs";
import { BranchesTable } from "./branches-table";

/**
 * The branch directory.
 *
 * Search, filtering, sorting and paging all run **in the client**: no branch
 * endpoint documents a single query parameter, so there is nothing to send, and
 * the note under the toolbar says so.
 *
 * Filtering to Deleted deserves its own explanation when it returns nothing —
 * `GET /branches` is documented to list active branches, so deleted ones never
 * reach this table regardless of the filter.
 */
export function BranchDirectoryScreen() {
  const { branches, isPending, error, refetch } = useBranches();
  const toggleStatus = useToggleBranchStatus();
  const deleteBranch = useDeleteBranch();

  const [search, setSearch] = useState("");
  const [state, setState] = useState<string>(ANY_STATE);
  const [institutionType, setInstitutionType] = useState<string>(ANY_TYPE);
  const [page, setPage] = useState(1);
  const [pendingDeletion, setPendingDeletion] = useState<BranchDto | null>(
    null,
  );
  const [pendingToggle, setPendingToggle] = useState<BranchDto | null>(null);

  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(
    () =>
      filterBranches(branches, {
        search: debouncedSearch,
        state,
        institutionType,
      }),
    [branches, debouncedSearch, state, institutionType],
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
    (debouncedSearch ? 1 : 0) +
    (state !== ANY_STATE ? 1 : 0) +
    (institutionType !== ANY_TYPE ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setState(ANY_STATE);
    setInstitutionType(ANY_TYPE);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Directory"
        description="Every campus on the platform — identity, classification, contact and status."
        actions={
          <Button asChild>
            <Link href={ROUTES.app.branches.create}>
              <Plus />
              New branch
            </Link>
          </Button>
        }
      />

      <div className="space-y-3">
        <DataTableToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search name, code, registration, contact…"
          searchLabel="Search branches"
          activeFilterCount={activeFilterCount}
          onClearFilters={resetFilters}
          filters={
            <>
              <Select
                value={state}
                onValueChange={(value) => {
                  setState(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATE_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={institutionType}
                onValueChange={(value) => {
                  setInstitutionType(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44" aria-label="Filter by type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_TYPE}>All types</SelectItem>
                  {INSTITUTION_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />

        <BackendPendingNote>
          searching, filtering, sorting and paging run in this browser over the
          full list. No branch endpoint documents a query parameter, so none are
          sent.
        </BackendPendingNote>

        <BranchesTable
          branches={visible}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          onToggleStatus={setPendingToggle}
          onDelete={setPendingDeletion}
          emptyState={
            state === "deleted" ? (
              <EmptyState
                icon={School}
                title="Deleted branches are not listed"
                description="GET /branches is documented to return active branches only, so soft-deleted ones never reach this table."
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
                title="No branches match"
                description="Try a different search term, status or institution type."
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
                icon={School}
                title="No branches yet"
                description="Create the first campus to start managing academic years, programs and admissions."
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.branches.create}>
                      <Plus />
                      Create branch
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

      <DeleteBranchDialog
        branch={pendingDeletion}
        isPending={deleteBranch.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null);
        }}
        onConfirm={async (branch) => {
          await deleteBranch.mutateAsync(branch.id);
          setPendingDeletion(null);
        }}
      />

      <ToggleBranchStatusDialog
        branch={pendingToggle}
        isPending={toggleStatus.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        onConfirm={async (branch) => {
          await toggleStatus.mutateAsync(branch.id);
          setPendingToggle(null);
        }}
      />
    </div>
  );
}
