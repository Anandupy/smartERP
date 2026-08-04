"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CalendarDays, Plus, School } from "@/assets/icons";
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
  DIRECTORY_PAGE_SIZE,
  STATE_FILTER_OPTIONS,
} from "../constants";
import {
  filterAcademicYears,
  useAcademicYearBranch,
  useAcademicYearTransition,
  useAcademicYears,
  useDeleteAcademicYear,
} from "../hooks/use-academic-years";
import type { AcademicYearDto } from "../types/academic-year.dto";
import type { LifecycleAction } from "../utils/academic-year-lifecycle";
import {
  DeleteAcademicYearDialog,
  TransitionAcademicYearDialog,
} from "./academic-year-dialogs";
import { AcademicYearsTable } from "./academic-years-table";

/**
 * The academic year directory.
 *
 * Search, filtering, sorting and paging all run **in the client**. The list
 * endpoint documents exactly one query parameter — `branchId`, which is
 * required and identifies the branch rather than narrowing the result — so
 * there is no `page`, `limit`, `search` or `sortBy` to send, and the note under
 * the toolbar says so.
 *
 * The whole screen is scoped to the active branch, which is not a limitation
 * this module chose: there is no endpoint that lists academic years across
 * branches. Without a branch the table would have nothing to ask for, so the
 * screen says that rather than rendering an empty list that looks like a
 * branch with no years.
 */
export function AcademicYearDirectoryScreen() {
  const branch = useAcademicYearBranch();
  const { academicYears, isPending, error, refetch } = useAcademicYears(
    branch?.id ?? null,
  );
  const transition = useAcademicYearTransition(branch?.id ?? null);
  const deleteYear = useDeleteAcademicYear(branch?.id ?? null);

  const [search, setSearch] = useState("");
  const [state, setState] = useState<string>(ANY_STATE);
  const [page, setPage] = useState(1);
  const [pendingDeletion, setPendingDeletion] =
    useState<AcademicYearDto | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{
    year: AcademicYearDto;
    action: LifecycleAction;
  } | null>(null);

  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(
    () =>
      filterAcademicYears(academicYears, {
        search: debouncedSearch,
        state,
      }),
    [academicYears, debouncedSearch, state],
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
    (debouncedSearch ? 1 : 0) + (state !== ANY_STATE ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setState(ANY_STATE);
    setPage(1);
  };

  if (!branch) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Academic Year Directory"
          description="Every administrative timeframe defined for a branch."
        />
        <EmptyState
          icon={School}
          title="No active branch"
          description="Academic years are listed per branch — the list endpoint requires a branch id, and no endpoint lists them across branches. Choose a branch to continue."
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.workspace.root}>Change workspace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Year Directory"
        description={`Every administrative timeframe defined for ${branch.name}.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.academicYears.calendar}>
                View calendar
              </Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.academicYears.create}>
                <Plus />
                New academic year
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
          searchPlaceholder="Search by name or date…"
          searchLabel="Search academic years"
          activeFilterCount={activeFilterCount}
          onClearFilters={resetFilters}
          filters={
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
          }
        />

        <BackendPendingNote>
          searching, filtering, sorting and paging run in this browser over the
          branch&apos;s full list. The only query parameter the endpoint
          documents is <code>branchId</code>, which identifies the branch rather
          than narrowing the result, so nothing else is sent.
        </BackendPendingNote>

        <AcademicYearsTable
          academicYears={visible}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          onTransition={(year, action) =>
            setPendingTransition({ year, action })
          }
          onDelete={setPendingDeletion}
          emptyState={
            activeFilterCount > 0 ? (
              <EmptyState
                title="No academic years match"
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
                icon={CalendarDays}
                title="No academic years yet"
                description={`${branch.name} has no academic years. The first one created is automatically activated and set as the branch's current year.`}
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.academicYears.create}>
                      <Plus />
                      Create academic year
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

      <TransitionAcademicYearDialog
        year={pendingTransition?.year ?? null}
        action={pendingTransition?.action ?? null}
        isPending={transition.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingTransition(null);
        }}
        onConfirm={async (year, name) => {
          await transition.mutateAsync({ id: year.id, transition: name });
          setPendingTransition(null);
        }}
      />

      <DeleteAcademicYearDialog
        year={pendingDeletion}
        isPending={deleteYear.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null);
        }}
        onConfirm={async (year) => {
          await deleteYear.mutateAsync(year.id);
          setPendingDeletion(null);
        }}
      />
    </div>
  );
}
