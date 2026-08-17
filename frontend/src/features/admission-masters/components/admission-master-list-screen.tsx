"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Plus } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROUTES } from "@/constants";
import { useWorkspace } from "@/core/workspace";
import { useDebouncedValue } from "@/hooks";
import {
  DataTablePagination,
  DataTableToolbar,
} from "@/shared/components/data";
import { BackendPendingNote, EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { admissionMasterConfig, type AdmissionMasterType } from "../config/admission-master-registry";
import { ANY_STATUS, DIRECTORY_PAGE_SIZE, STATUS_FILTER_OPTIONS } from "../constants";
import {
  filterAdmissionMasters,
  useAdmissionMasterList,
  useAdmissionMastersBranch,
  useDeleteAdmissionMaster,
  useToggleAdmissionMasterActive,
} from "../hooks/use-admission-masters";
import type { AdmissionMasterDto } from "../types/admission-master.dto";
import {
  DeleteAdmissionMasterDialog,
  ToggleAdmissionMasterActiveDialog,
} from "./admission-master-dialogs";
import { AdmissionMastersTable } from "./admission-master-records-table";

export interface AdmissionMasterListScreenProps {
  masterType: AdmissionMasterType;
}

/**
 * The directory for one admission master resource.
 *
 * One generic screen for all 10 — the only thing that varies between, say,
 * Blood Groups and Relation Types is the `config` it renders with. Search,
 * status filtering, sorting and paging all run **in the client**: the only
 * query parameter any of the 10 list endpoints documents is
 * `includeInactive`, fetched once (see `useAdmissionMasterList`), and the note
 * under the toolbar says so.
 */
export function AdmissionMasterListScreen({
  masterType,
}: AdmissionMasterListScreenProps) {
  const config = admissionMasterConfig(masterType);
  const branch = useAdmissionMastersBranch();
  const { isReady } = useWorkspace();

  const { masters, isPending, error, refetch } = useAdmissionMasterList(masterType);
  const toggleActive = useToggleAdmissionMasterActive(masterType);
  const deleteMaster = useDeleteAdmissionMaster(masterType);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ANY_STATUS);
  const [page, setPage] = useState(1);
  const [pendingToggle, setPendingToggle] = useState<AdmissionMasterDto | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<AdmissionMasterDto | null>(null);

  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(
    () => filterAdmissionMasters(masters, { search: debouncedSearch, status }),
    [masters, debouncedSearch, status],
  );

  const totalPages = Math.max(Math.ceil(filtered.length / DIRECTORY_PAGE_SIZE), 1);
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

  const createHref = ROUTES.app.admissionMasters.create(config.resource);

  if (isReady && !branch) {
    return (
      <div className="space-y-6">
        <PageHeader title={config.pluralLabel} description={config.description} />
        <EmptyState
          icon={config.icon}
          title="No active branch"
          description={`${config.pluralLabel} are scoped to a branch, and x-branch-id is a required header on every request. Choose a branch to continue.`}
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
        title={config.pluralLabel}
        description={config.description}
        actions={
          <Button asChild>
            <Link href={createHref}>
              <Plus />
              New {config.singularLabel.toLowerCase()}
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
          searchPlaceholder="Search code, name, description…"
          searchLabel={`Search ${config.pluralLabel.toLowerCase()}`}
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
              <SelectTrigger className="w-40" aria-label="Filter by status">
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
          full list. `includeInactive` is the only query parameter any of these
          endpoints documents.
        </BackendPendingNote>

        <AdmissionMastersTable
          config={config}
          masters={visible}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          onToggleActive={setPendingToggle}
          onDelete={setPendingDeletion}
          emptyState={
            activeFilterCount > 0 ? (
              <EmptyState
                title={`No ${config.pluralLabel.toLowerCase()} match`}
                description="Try a different search term or status."
                action={
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={config.icon}
                title={`No ${config.pluralLabel.toLowerCase()} yet`}
                description={config.emptyStateDescription}
                action={
                  <Button asChild>
                    <Link href={createHref}>
                      <Plus />
                      Add {config.singularLabel.toLowerCase()}
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

      <ToggleAdmissionMasterActiveDialog
        master={pendingToggle}
        isPending={toggleActive.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        onConfirm={async (master) => {
          await toggleActive.mutateAsync(master);
          setPendingToggle(null);
        }}
      />

      <DeleteAdmissionMasterDialog
        config={config}
        master={pendingDeletion}
        isPending={deleteMaster.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null);
        }}
        onConfirm={async (master) => {
          await deleteMaster.mutateAsync(master.id);
          setPendingDeletion(null);
        }}
      />
    </div>
  );
}
