"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Blocks, Plus, School } from "@/assets/icons";
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
  ANY_LEVEL,
  ANY_STATE,
  DIRECTORY_PAGE_SIZE,
  STATE_FILTER_OPTIONS,
} from "../constants";
import {
  filterPrograms,
  useDeleteProgram,
  useProgramBranch,
  usePrograms,
  useToggleProgramStatus,
} from "../hooks/use-programs";
import type { ProgramDto } from "../types/program.dto";
import { deleteBlockedReason } from "../utils/program-hierarchy";
import { DeleteProgramDialog, ToggleProgramStatusDialog } from "./program-dialogs";
import { ProgramsTable } from "./programs-table";

/**
 * The program directory.
 *
 * Search, filtering, sorting and paging all run **in the client**. The only
 * query parameter any program endpoint documents is `branchId`, which
 * identifies the branch rather than narrowing the result, so there is nothing
 * else to send and the note under the toolbar says so.
 *
 * The level filter is built from the values the branch actually returned rather
 * than from a fixed list: `level` is a Postman-only field whose sole recorded
 * sample is `"SCHOOL"`, so offering an invented vocabulary would hide real data
 * behind options that do not match it.
 */
export function ProgramDirectoryScreen() {
  const branch = useProgramBranch();
  const { programs, isPending, error, refetch } = usePrograms(
    branch?.id ?? null,
  );
  const toggleStatus = useToggleProgramStatus(branch?.id ?? null);
  const deleteProgram = useDeleteProgram(branch?.id ?? null);

  const [search, setSearch] = useState("");
  const [state, setState] = useState<string>(ANY_STATE);
  const [level, setLevel] = useState<string>(ANY_LEVEL);
  const [page, setPage] = useState(1);
  const [pendingDeletion, setPendingDeletion] = useState<ProgramDto | null>(
    null,
  );
  const [pendingToggle, setPendingToggle] = useState<ProgramDto | null>(null);

  const debouncedSearch = useDebouncedValue(search, 200);

  /** The levels this branch actually uses — see the note above. */
  const levelOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const program of programs) {
      if (program.level) seen.add(program.level);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [programs]);

  const filtered = useMemo(
    () => filterPrograms(programs, { search: debouncedSearch, state, level }),
    [programs, debouncedSearch, state, level],
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
    (level !== ANY_LEVEL ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setState(ANY_STATE);
    setLevel(ANY_LEVEL);
    setPage(1);
  };

  if (!branch) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Program Directory"
          description="Every academic classification defined for a branch."
        />
        <EmptyState
          icon={School}
          title="No active branch"
          description="Programs are listed per branch — the list endpoint requires a branch id, and no endpoint lists them across branches. Choose a branch to continue."
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
        title="Program Directory"
        description={`Every academic classification defined for ${branch.name}.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.programs.tree}>View hierarchy</Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.programs.create}>
                <Plus />
                New program
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
          searchPlaceholder="Search name, level, medium, stream…"
          searchLabel="Search programs"
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

              {levelOptions.length > 0 ? (
                <Select
                  value={level}
                  onValueChange={(value) => {
                    setLevel(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-40" aria-label="Filter by level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_LEVEL}>All levels</SelectItem>
                    {levelOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </>
          }
        />

        <BackendPendingNote>
          searching, filtering, sorting and paging run in this browser over the
          branch&apos;s full list. The only query parameter the endpoints
          document is <code>branchId</code>, which identifies the branch rather
          than narrowing the result.
        </BackendPendingNote>

        <ProgramsTable
          programs={visible}
          allPrograms={programs}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          onToggleStatus={setPendingToggle}
          onDelete={setPendingDeletion}
          emptyState={
            activeFilterCount > 0 ? (
              <EmptyState
                title="No programs match"
                description="Try a different search term, status or level."
                action={
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Blocks}
                title="No programs yet"
                description={`${branch.name} has no programs. Academic units name a program, so at least one is needed before the operational structure can be built.`}
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.programs.create}>
                      <Plus />
                      Create program
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

      <DeleteProgramDialog
        program={pendingDeletion}
        blockedReason={
          pendingDeletion
            ? deleteBlockedReason(programs, pendingDeletion.id)
            : null
        }
        isPending={deleteProgram.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null);
        }}
        onConfirm={async (program) => {
          await deleteProgram.mutateAsync(program.id);
          setPendingDeletion(null);
        }}
      />

      <ToggleProgramStatusDialog
        program={pendingToggle}
        isPending={toggleStatus.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        onConfirm={async (program) => {
          await toggleStatus.mutateAsync(program.id);
          setPendingToggle(null);
        }}
      />
    </div>
  );
}
