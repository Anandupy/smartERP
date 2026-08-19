"use client";

import Link from "next/link";
import { useState } from "react";

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
import {
  DataTablePagination,
  DataTableToolbar,
} from "@/shared/components/data";
import { EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { ANY_STATUS, DIRECTORY_PAGE_SIZE, STATUS_FILTER_OPTIONS } from "../constants";
import { useApplicantScope, useApplicants } from "../hooks/use-applicants";
import type {
  AdmissionApplicationStatus,
  ApplicantListQuery,
} from "../types/applicant.dto";
import { ApplicantsTable } from "./applicants-table";

/**
 * The applicants directory.
 *
 * Unlike branch, academic-year and admission masters, `GET
 * /admissions/applicants` genuinely documents `search`, `status`, `page` and
 * `limit` (`docs/admission-lifecycle-module.md` §3.3) — so every one of
 * those is sent to the server, and nothing is filtered in this browser.
 *
 * `academicYearId` is not an offerable filter: it is the active workspace
 * scope, not a query parameter a user picks per-search, and every request
 * already carries it as a header.
 */
export function ApplicantDirectoryScreen() {
  const scope = useApplicantScope();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ANY_STATUS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DIRECTORY_PAGE_SIZE);

  const debouncedSearch = useDebouncedValue(search, 300);

  const query: ApplicantListQuery = {
    search: debouncedSearch || undefined,
    status:
      status === ANY_STATUS
        ? undefined
        : (status as AdmissionApplicationStatus),
    page,
    limit,
  };

  const { applicants, pagination, isPending, isFetching, error, refetch } =
    useApplicants(query);

  const activeFilterCount =
    (debouncedSearch ? 1 : 0) + (status !== ANY_STATUS ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setStatus(ANY_STATUS);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applicants"
        description="Manage admission applications and track each applicant through the admission lifecycle."
        actions={
          <Button asChild>
            <Link href={ROUTES.app.admissions.applicants.create}>
              <Plus />
              New admission
            </Link>
          </Button>
        }
      />

      {!scope ? (
        <EmptyState
          icon={FileText}
          title="No active branch or academic year"
          description="Applicants are scoped to one branch and one academic year. Choose a workspace to continue."
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.workspace.root}>Change workspace</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <DataTableToolbar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search name, mobile, Aadhaar, application no…"
            searchLabel="Search applicants"
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

          <ApplicantsTable
            applicants={applicants}
            isLoading={isPending}
            error={error}
            onRetry={() => refetch()}
            emptyState={
              activeFilterCount > 0 ? (
                <EmptyState
                  title="No applicants match"
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
                  icon={FileText}
                  title="No applicants yet"
                  description="Start a new admission to register the first applicant for this branch and academic year."
                  action={
                    <Button asChild>
                      <Link href={ROUTES.app.admissions.applicants.create}>
                        <Plus />
                        New admission
                      </Link>
                    </Button>
                  }
                />
              )
            }
          />

          {pagination ? (
            <DataTablePagination
              page={pagination.page}
              pageSize={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              isLoading={isFetching}
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
