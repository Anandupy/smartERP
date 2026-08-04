"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { GraduationCap, Plus } from "@/assets/icons";
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

import type { AcademicUnitScope } from "../api/academic-unit.service";
import {
  ANY_PROGRAM,
  ANY_STATE,
  ANY_TYPE,
  DIRECTORY_PAGE_SIZE,
  STATE_FILTER_OPTIONS,
} from "../constants";
import {
  filterAcademicUnits,
  useAcademicUnits,
  useDeleteAcademicUnit,
  useMoveAcademicUnit,
  useToggleAcademicUnitStatus,
} from "../hooks/use-academic-units";
import type { AcademicUnitDto } from "../types/academic-unit.dto";
import { deleteBlockedReason } from "../utils/academic-unit-hierarchy";
import {
  DeleteAcademicUnitDialog,
  MoveAcademicUnitDialog,
  ToggleAcademicUnitStatusDialog,
} from "./academic-unit-dialogs";
import { AcademicUnitScopeGate } from "./academic-unit-scope-gate";
import { AcademicUnitsTable } from "./academic-units-table";

export interface AcademicUnitDirectoryScreenProps {
  /** Program names by id, wired at the route. */
  programNames?: ReadonlyMap<string, string>;
}

/** The directory, once the scope is resolved. */
function Directory({
  scope,
  programNames,
}: {
  scope: AcademicUnitScope;
  programNames?: ReadonlyMap<string, string>;
}) {
  const { units, isPending, error, refetch } = useAcademicUnits(scope);
  const move = useMoveAcademicUnit(scope);
  const toggleStatus = useToggleAcademicUnitStatus(scope);
  const deleteUnit = useDeleteAcademicUnit(scope);

  const [search, setSearch] = useState("");
  const [state, setState] = useState<string>(ANY_STATE);
  const [unitType, setUnitType] = useState<string>(ANY_TYPE);
  const [programId, setProgramId] = useState<string>(ANY_PROGRAM);
  const [page, setPage] = useState(1);
  const [pendingDeletion, setPendingDeletion] =
    useState<AcademicUnitDto | null>(null);
  const [pendingToggle, setPendingToggle] = useState<AcademicUnitDto | null>(
    null,
  );
  const [pendingMove, setPendingMove] = useState<AcademicUnitDto | null>(null);

  const debouncedSearch = useDebouncedValue(search, 200);

  /**
   * The unit types this scope actually uses.
   *
   * Built from the data rather than from `SUGGESTED_UNIT_TYPES`, because the
   * documentation is explicit that the type is a free-form UI tag — offering a
   * fixed vocabulary would hide real units behind options that do not match
   * them.
   */
  const typeOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const unit of units) {
      if (unit.unitType) seen.add(unit.unitType);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [units]);

  /** The programs this scope's units belong to. */
  const programOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const unit of units) seen.add(unit.programId);
    return [...seen].map((id) => ({ id, name: programNames?.get(id) ?? id }));
  }, [units, programNames]);

  const filtered = useMemo(
    () =>
      filterAcademicUnits(units, {
        search: debouncedSearch,
        state,
        unitType,
        programId,
      }),
    [units, debouncedSearch, state, unitType, programId],
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
    (unitType !== ANY_TYPE ? 1 : 0) +
    (programId !== ANY_PROGRAM ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setState(ANY_STATE);
    setUnitType(ANY_TYPE);
    setProgramId(ANY_PROGRAM);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Unit Directory"
        description="Every unit in the active branch and academic year — flat, searchable and filterable."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.academicUnits.tree}>View hierarchy</Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.academicUnits.create}>
                <Plus />
                New unit
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
          searchPlaceholder="Search name, code, type…"
          searchLabel="Search academic units"
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
                <SelectTrigger className="w-36" aria-label="Filter by status">
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

              {programOptions.length > 1 ? (
                <Select
                  value={programId}
                  onValueChange={(value) => {
                    setProgramId(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className="w-44"
                    aria-label="Filter by program"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_PROGRAM}>All programs</SelectItem>
                    {programOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {typeOptions.length > 0 ? (
                <Select
                  value={unitType}
                  onValueChange={(value) => {
                    setUnitType(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-36" aria-label="Filter by type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_TYPE}>All types</SelectItem>
                    {typeOptions.map((option) => (
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
          searching, filtering, sorting and paging run in this browser. The only
          query parameters the endpoints document are <code>branchId</code> and{" "}
          <code>academicYearId</code>, and both identify the scope rather than
          narrowing the result — notably there is <strong>no</strong>{" "}
          <code>programId</code> filter, though every unit has one.
        </BackendPendingNote>

        <AcademicUnitsTable
          units={visible}
          allUnits={units}
          programNames={programNames}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          onMove={setPendingMove}
          onToggleStatus={setPendingToggle}
          onDelete={setPendingDeletion}
          emptyState={
            activeFilterCount > 0 ? (
              <EmptyState
                title="No academic units match"
                description="Try a different search term, status, program or type."
                action={
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={GraduationCap}
                title="No academic units yet"
                description="This branch and academic year have no structure defined. Units are scoped to one year, so a new year starts empty by design."
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.academicUnits.create}>
                      <Plus />
                      Create unit
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

      <DeleteAcademicUnitDialog
        unit={pendingDeletion}
        blockedReason={
          pendingDeletion ? deleteBlockedReason(units, pendingDeletion.id) : null
        }
        isPending={deleteUnit.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null);
        }}
        onConfirm={async (unit) => {
          await deleteUnit.mutateAsync(unit.id);
          setPendingDeletion(null);
        }}
      />

      <ToggleAcademicUnitStatusDialog
        unit={pendingToggle}
        isPending={toggleStatus.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        onConfirm={async (unit) => {
          await toggleStatus.mutateAsync(unit.id);
          setPendingToggle(null);
        }}
      />

      <MoveAcademicUnitDialog
        unit={pendingMove}
        units={units}
        isPending={move.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingMove(null);
        }}
        onConfirm={async (unit, parentId) => {
          await move.mutateAsync({ id: unit.id, body: { parentId } });
          setPendingMove(null);
        }}
      />
    </div>
  );
}

/**
 * The academic unit directory.
 *
 * The flat counterpart to the tree. Search, filtering, sorting and paging all
 * run **in the client**: the only documented query parameters are the two scope
 * ids, and neither narrows the result.
 *
 * The program filter is worth calling out — `programId` is a required field on
 * every unit and is **not** a documented filter, so narrowing by program is
 * something only the browser can do. The note under the toolbar says so.
 */
export function AcademicUnitDirectoryScreen({
  programNames,
}: AcademicUnitDirectoryScreenProps) {
  return (
    <AcademicUnitScopeGate>
      {(scope) => <Directory scope={scope} programNames={programNames} />}
    </AcademicUnitScopeGate>
  );
}
