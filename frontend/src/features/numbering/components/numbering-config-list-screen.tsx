"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Hash, Plus } from "@/assets/icons";
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

import { DIRECTORY_PAGE_SIZE, filterNumberingConfigs } from "../constants";
import { useNumberingConfigs } from "../hooks/use-numbering";
import type { NumberingConfigDto } from "../types/numbering.dto";
import { NumberingConfigsTable } from "./numbering-configs-table";
import { NumberingSummaryCards } from "./numbering-summary-cards";
import { PreviewNumberingDialog } from "./preview-numbering-dialog";

const ANY_STATUS = "ANY";
const STATUS_OPTIONS = [
  { value: ANY_STATUS, label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

/**
 * The Numbering directory — every sequence configuration readable from the
 * current organization/branch scope. No documented list filter exists, so
 * search/status filtering and paging all run client-side over one fetch.
 */
export function NumberingConfigListScreen() {
  const { configs, isPending, error, refetch } = useNumberingConfigs();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ANY_STATUS);
  const [page, setPage] = useState(1);
  const [previewing, setPreviewing] = useState<NumberingConfigDto | null>(null);

  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(
    () => filterNumberingConfigs(configs, { search: debouncedSearch, status }),
    [configs, debouncedSearch, status],
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
        title="Numbering"
        description="Configure how CampusFlow generates identifiers for supported records."
        actions={
          <Button asChild>
            <Link href={ROUTES.app.settings.numbering.create}>
              <Plus />
              New sequence
            </Link>
          </Button>
        }
      />

      <NumberingSummaryCards configs={configs} isLoading={isPending} />

      <div className="space-y-3">
        <DataTableToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search by purpose…"
          searchLabel="Search numbering sequences"
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
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <BackendPendingNote>
          no query parameter is documented for this endpoint — search,
          status filtering and paging all run in this browser over the full
          list readable from the current scope. There is no delete endpoint;
          an unwanted sequence is deactivated, not removed.
        </BackendPendingNote>

        <NumberingConfigsTable
          configs={visible}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          onPreview={setPreviewing}
          emptyState={
            activeFilterCount > 0 ? (
              <EmptyState
                title="No sequences match"
                description="Try a different search term or status."
                action={
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Hash}
                title="No numbering configurations yet"
                description="Create a configuration to define how CampusFlow generates supported identifiers."
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.settings.numbering.create}>
                      <Plus />
                      New sequence
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

      <PreviewNumberingDialog
        config={previewing}
        onOpenChange={(open) => {
          if (!open) setPreviewing(null);
        }}
      />
    </div>
  );
}
