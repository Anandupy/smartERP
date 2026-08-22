"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FileCheck2, Plus } from "@/assets/icons";
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
import { DataTablePagination, DataTableToolbar } from "@/shared/components/data";
import { BackendPendingNote, EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  ANY_STATUS,
  DIRECTORY_PAGE_SIZE,
  STATUS_FILTER_OPTIONS,
  filterDocumentRequirements,
} from "../constants";
import {
  useDeleteDocumentRequirement,
  useDocumentRequirements,
  useDocumentTypes,
  useToggleDocumentRequirementActive,
} from "../hooks/use-documents";
import type { DocumentRequirementDto } from "../types/document.dto";
import {
  DeleteDocumentRequirementDialog,
  ToggleDocumentRequirementActiveDialog,
} from "./document-requirement-dialogs";
import { DocumentRequirementsTable } from "./document-requirements-table";

const ANY_PROGRAM = "ANY_PROGRAM";

export interface DocumentRequirementListScreenProps {
  programNames: ReadonlyMap<string, string>;
  programOptions: readonly { value: string; label: string }[];
  quotaNames: ReadonlyMap<string, string>;
  categoryNames: ReadonlyMap<string, string>;
  stageOptions: readonly { value: string; label: string }[];
}

/**
 * The Document Requirements directory.
 *
 * `branchId` is the only documented list filter for
 * `GET /document-requirements` — program, quota, category, stage and status
 * narrowing all happen client-side over the one fetched, branch-scoped
 * collection.
 */
export function DocumentRequirementListScreen({
  programNames,
  programOptions,
  quotaNames,
  categoryNames,
  stageOptions,
}: DocumentRequirementListScreenProps) {
  const { isReady, branch } = useWorkspace();
  const { requirements, isPending, error, refetch } = useDocumentRequirements();
  const { types } = useDocumentTypes();
  const toggleActive = useToggleDocumentRequirementActive();
  const deleteRequirement = useDeleteDocumentRequirement();

  const documentTypesById = useMemo(() => {
    const map = new Map<string, (typeof types)[number]>();
    for (const type of types) map.set(type.id, type);
    return map;
  }, [types]);

  const stageLabels = useMemo(
    () => new Map(stageOptions.map((option) => [option.value, option.label])),
    [stageOptions],
  );

  const [search, setSearch] = useState("");
  const [program, setProgram] = useState<string>(ANY_PROGRAM);
  const [stage, setStage] = useState<string>(ANY_STATUS);
  const [status, setStatus] = useState<string>(ANY_STATUS);
  const [page, setPage] = useState(1);
  const [pendingToggle, setPendingToggle] = useState<DocumentRequirementDto | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<DocumentRequirementDto | null>(null);

  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(() => {
    let list = filterDocumentRequirements(
      requirements,
      { search: debouncedSearch, status },
      documentTypesById,
    );
    if (program !== ANY_PROGRAM) {
      list = list.filter((requirement) => requirement.appliesToProgramId === program);
    }
    if (stage !== ANY_STATUS) {
      list = list.filter((requirement) => requirement.requiredByStage === stage);
    }
    return list;
  }, [requirements, debouncedSearch, status, program, stage, documentTypesById]);

  const totalPages = Math.max(Math.ceil(filtered.length / DIRECTORY_PAGE_SIZE), 1);
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * DIRECTORY_PAGE_SIZE,
    currentPage * DIRECTORY_PAGE_SIZE,
  );

  const activeFilterCount =
    (debouncedSearch ? 1 : 0) +
    (status !== ANY_STATUS ? 1 : 0) +
    (program !== ANY_PROGRAM ? 1 : 0) +
    (stage !== ANY_STATUS ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setProgram(ANY_PROGRAM);
    setStage(ANY_STATUS);
    setStatus(ANY_STATUS);
    setPage(1);
  };

  const requirementLabel = (requirement: DocumentRequirementDto) =>
    documentTypesById.get(requirement.documentTypeId)?.name ?? "this requirement";

  if (isReady && !branch) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Document Requirements"
          description="Configure which documents are required and where they apply."
        />
        <EmptyState
          icon={FileCheck2}
          title="No active branch"
          description="Document requirements are scoped to a branch. Choose a branch to continue."
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
        title="Document Requirements"
        description="Configure which documents are required and where they apply."
        actions={
          <Button asChild>
            <Link href={ROUTES.app.documents.requirements.create}>
              <Plus />
              Add requirement
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
          searchPlaceholder="Search by document type or stage…"
          searchLabel="Search document requirements"
          activeFilterCount={activeFilterCount}
          onClearFilters={resetFilters}
          filters={
            <>
              <Select
                value={program}
                onValueChange={(value) => {
                  setProgram(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44" aria-label="Filter by program">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_PROGRAM}>All programs</SelectItem>
                  {programOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={stage}
                onValueChange={(value) => {
                  setStage(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44" aria-label="Filter by stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_STATUS}>All stages</SelectItem>
                  {stageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            </>
          }
        />

        <BackendPendingNote>
          only `branchId` is a documented filter for this endpoint — program,
          quota, category, stage and status narrowing all run in this
          browser.
        </BackendPendingNote>

        <DocumentRequirementsTable
          requirements={visible}
          documentTypesById={documentTypesById}
          programNames={programNames}
          quotaNames={quotaNames}
          categoryNames={categoryNames}
          stageLabels={stageLabels}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          onToggleActive={setPendingToggle}
          onDelete={setPendingDeletion}
          emptyState={
            activeFilterCount > 0 ? (
              <EmptyState
                title="No requirements match"
                description="Try a different search term or filter."
                action={
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={FileCheck2}
                title="No document requirements configured"
                description="Configure the documents required for admissions, programs and other workflows."
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.documents.requirements.create}>
                      <Plus />
                      Add requirement
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

      <ToggleDocumentRequirementActiveDialog
        requirement={pendingToggle}
        requirementLabel={pendingToggle ? requirementLabel(pendingToggle) : ""}
        isPending={toggleActive.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        onConfirm={async (requirement) => {
          await toggleActive.mutateAsync(requirement);
          setPendingToggle(null);
        }}
      />

      <DeleteDocumentRequirementDialog
        requirement={pendingDeletion}
        requirementLabel={pendingDeletion ? requirementLabel(pendingDeletion) : ""}
        isPending={deleteRequirement.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null);
        }}
        onConfirm={async (requirement) => {
          await deleteRequirement.mutateAsync(requirement.id);
          setPendingDeletion(null);
        }}
      />
    </div>
  );
}
