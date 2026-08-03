"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Plus, Wrench } from "@/assets/icons";
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
import { StatCard } from "@/shared/components/data-display";
import {
  DataTablePagination,
  DataTableToolbar,
} from "@/shared/components/data";
import { BackendPendingNote, EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  ALL_SCOPES,
  SCOPE_OPTIONS,
  STATUS_FILTER_OPTIONS,
  type MaintenanceStatusFilter,
} from "../constants";
import {
  filterRules,
  useDeleteMaintenanceRule,
  useMaintenanceRules,
} from "../hooks/use-maintenance-rules";
import type {
  MaintenanceRuleDto,
  MaintenanceScopeType,
} from "../types/maintenance.dto";
import { DeleteRuleDialog } from "./delete-rule-dialog";
import { MaintenanceRulesTable } from "./maintenance-rules-table";
import { MaintenanceStatusCard } from "./maintenance-status-card";

const PAGE_SIZE = 10;

/**
 * Maintenance: current status, the rules that produce it, and the controls to
 * change them.
 *
 * Search, filtering and paging all run **in the client**. That is not a
 * shortcut — `GET /maintenance-rules` documents no query parameters at all, so
 * there is nothing to send. The note under the toolbar says so, because the
 * distinction matters the moment this list is long enough for it to.
 */
export function MaintenanceScreen() {
  const { rules, isPending, error, refetch } = useMaintenanceRules();
  const deleteRule = useDeleteMaintenanceRule();

  const [search, setSearch] = useState("");
  const [scopeType, setScopeType] = useState<MaintenanceScopeType | "ALL">(
    ALL_SCOPES,
  );
  const [status, setStatus] = useState<MaintenanceStatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [pendingDeletion, setPendingDeletion] =
    useState<MaintenanceRuleDto | null>(null);

  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(
    () => filterRules(rules, { search: debouncedSearch, scopeType, status }),
    [rules, debouncedSearch, scopeType, status],
  );

  const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const activeFilterCount =
    (debouncedSearch ? 1 : 0) +
    (scopeType !== ALL_SCOPES ? 1 : 0) +
    (status !== "ALL" ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setScopeType(ALL_SCOPES);
    setStatus("ALL");
    setPage(1);
  };

  const activeCount = rules.filter((rule) => rule.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Restrict parts of the platform while work is in progress, immediately or on a schedule."
        actions={
          <Button asChild>
            <Link href={ROUTES.app.maintenance.create}>
              <Plus />
              New rule
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_2fr]">
        <StatCard
          icon={Wrench}
          label="Rules"
          value={isPending ? "—" : rules.length}
          isLoading={isPending}
          hint="Configured across all scopes"
        />
        <StatCard
          icon={Wrench}
          label="Active"
          value={isPending ? "—" : activeCount}
          isLoading={isPending}
          hint="Currently eligible to apply"
        />
        <MaintenanceStatusCard />
      </div>

      <div className="space-y-3">
        <DataTableToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search rules…"
          searchLabel="Search maintenance rules"
          activeFilterCount={activeFilterCount}
          onClearFilters={resetFilters}
          filters={
            <>
              <Select
                value={scopeType}
                onValueChange={(value) => {
                  setScopeType(value as MaintenanceScopeType | "ALL");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40" aria-label="Filter by scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SCOPES}>All scopes</SelectItem>
                  {SCOPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as MaintenanceStatusFilter);
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
          searching, filtering and paging run in this browser over the full
          list. The rules endpoint documents no query parameters, so none are
          sent.
        </BackendPendingNote>

        <MaintenanceRulesTable
          rules={visible}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          onDelete={setPendingDeletion}
          emptyState={
            activeFilterCount > 0 ? (
              <EmptyState
                title="No rules match those filters"
                description="Try a different scope or status."
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
                icon={Wrench}
                title="No maintenance rules yet"
                description="Create a rule to take part of the platform offline for planned work."
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.maintenance.create}>
                      <Plus />
                      New rule
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
            pageSize={PAGE_SIZE}
            total={filtered.length}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </div>

      <DeleteRuleDialog
        rule={pendingDeletion}
        isPending={deleteRule.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null);
        }}
        onConfirm={async (rule) => {
          await deleteRule.mutateAsync(rule.id);
          setPendingDeletion(null);
        }}
      />
    </div>
  );
}
