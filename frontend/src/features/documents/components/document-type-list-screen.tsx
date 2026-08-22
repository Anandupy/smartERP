"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FileText, Plus } from "@/assets/icons";
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
import { DataTablePagination, DataTableToolbar } from "@/shared/components/data";
import { BackendPendingNote, EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  ANY_STATUS,
  DIRECTORY_PAGE_SIZE,
  STATUS_FILTER_OPTIONS,
  filterDocumentTypes,
} from "../constants";
import {
  useDeleteDocumentType,
  useDocumentTypes,
  useToggleDocumentTypeActive,
} from "../hooks/use-documents";
import type { DocumentTypeDto } from "../types/document.dto";
import {
  DeleteDocumentTypeDialog,
  ToggleDocumentTypeActiveDialog,
} from "./document-type-dialogs";
import { DocumentTypesTable } from "./document-types-table";

/**
 * The Document Types directory.
 *
 * `includeInactive=true` is the only documented list parameter — search,
 * status filtering, sorting and paging all happen client-side over the one
 * fetched collection, the same arrangement Admission Masters uses.
 */
export function DocumentTypeListScreen() {
  const { types, isPending, error, refetch } = useDocumentTypes();
  const deleteType = useDeleteDocumentType();
  const toggleActive = useToggleDocumentTypeActive();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ANY_STATUS);
  const [page, setPage] = useState(1);
  const [pendingToggle, setPendingToggle] = useState<DocumentTypeDto | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<DocumentTypeDto | null>(null);

  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(
    () => filterDocumentTypes(types, { search: debouncedSearch, status }),
    [types, debouncedSearch, status],
  );

  const totalPages = Math.max(Math.ceil(filtered.length / DIRECTORY_PAGE_SIZE), 1);
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * DIRECTORY_PAGE_SIZE,
    currentPage * DIRECTORY_PAGE_SIZE,
  );

  const activeFilterCount = (debouncedSearch ? 1 : 0) + (status !== ANY_STATUS ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setStatus(ANY_STATUS);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Types"
        description="The document catalogue — file rules, sensitivity and lifecycle for every kind of document this branch accepts."
        actions={
          <Button asChild>
            <Link href={ROUTES.app.documents.types.create}>
              <Plus />
              New document type
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
          searchLabel="Search document types"
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
          searching, filtering, sorting and paging run in this browser over
          the full list. `includeInactive` is the only query parameter this
          endpoint documents.
        </BackendPendingNote>

        <DocumentTypesTable
          types={visible}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          onToggleActive={setPendingToggle}
          onDelete={setPendingDeletion}
          emptyState={
            activeFilterCount > 0 ? (
              <EmptyState
                title="No document types match"
                description="Try a different search term or status."
                action={
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={FileText}
                title="No document types yet"
                description="Add the kinds of documents this branch works with — birth certificates, transfer certificates, identity proofs — before configuring which are required where."
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.documents.types.create}>
                      <Plus />
                      Add document type
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

      <ToggleDocumentTypeActiveDialog
        type={pendingToggle}
        isPending={toggleActive.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        onConfirm={async (type) => {
          await toggleActive.mutateAsync(type);
          setPendingToggle(null);
        }}
      />

      <DeleteDocumentTypeDialog
        type={pendingDeletion}
        isPending={deleteType.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null);
        }}
        onConfirm={async (type) => {
          await deleteType.mutateAsync(type.id);
          setPendingDeletion(null);
        }}
      />
    </div>
  );
}
