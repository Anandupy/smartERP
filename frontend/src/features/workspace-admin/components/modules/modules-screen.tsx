"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Blocks, Plus } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROUTES } from "@/constants";
import { usePermissions } from "@/core/auth";
import { GuideHelpTrigger } from "@/core/guides";
import { useDebouncedValue } from "@/hooks";
import { DataTableToolbar } from "@/shared/components/data";
import { EmptyState, ForbiddenState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { useNavigationTree } from "../../hooks/use-navigation";
import {
  filterModules,
  useDeleteModule,
  useModules,
  useUpdateModuleStatus,
} from "../../hooks/use-modules";
import type { ModuleListItemDto } from "../../types/module.dto";
import { SetupStatusBanner } from "../setup-status-banner";
import { DeleteModuleDialog, ToggleModuleStatusDialog } from "./module-dialogs";
import { ModulesTable } from "./modules-table";

const ANY_STATUS = "any";
const ACTIVE_ONLY = "active";

/**
 * Navigation Modules — the operational module registry.
 *
 * `GET /admin/navigation/modules` documents no query parameters, so search and
 * the active filter both run over the client's full list, matching every other
 * directory in this codebase that has the same contract shape (Branch,
 * Organization, Maintenance).
 *
 * The "reach" strip is a small, honest use of the *runtime* navigation
 * endpoint (`GET /workspace/navigation`) — it reports how much of the authored
 * hierarchy currently resolves into the caller's own tree. It is explicitly
 * not a claim about any other user's access (§40 of the module brief): the
 * backend, not `isActive`/`status`, remains the only source of truth for who
 * sees what.
 */
export function ModulesScreen() {
  const { hasRole } = usePermissions();
  const isSuperAdmin = hasRole("SUPER_ADMIN");

  const { modules, isPending, error, refetch } = useModules();
  const navigation = useNavigationTree();
  const toggleStatus = useUpdateModuleStatus();
  const deleteModule = useDeleteModule();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ANY_STATUS);
  const [pendingToggle, setPendingToggle] = useState<ModuleListItemDto | null>(
    null,
  );
  const [pendingDeletion, setPendingDeletion] =
    useState<ModuleListItemDto | null>(null);

  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(
    () =>
      filterModules(modules, {
        search: debouncedSearch,
        activeOnly: status === ACTIVE_ONLY,
      }),
    [modules, debouncedSearch, status],
  );

  const activeFilterCount =
    (debouncedSearch ? 1 : 0) + (status !== ANY_STATUS ? 1 : 0);

  if (!isSuperAdmin) {
    return (
      <ForbiddenState description="Navigation administration is Super Admin only." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Navigation Modules"
        description="Top-level ERP capabilities, and the menus registered beneath each one."
        actions={
          <>
            <GuideHelpTrigger guideId="workspace-modules" />
            <Button asChild data-guide="workspace-modules-list-create-link">
              <Link href={ROUTES.app.workspaceAdmin.modules.create}>
                <Plus />
                New module
              </Link>
            </Button>
          </>
        }
      />

      <SetupStatusBanner enabled={isSuperAdmin} />

      {navigation.data ? (
        <p className="text-muted-foreground text-sm">
          Your own navigation currently resolves{" "}
          <span className="text-foreground font-medium tabular-nums">
            {navigation.data.totalVisibleMenus}
          </span>{" "}
          menu{navigation.data.totalVisibleMenus === 1 ? "" : "s"} across{" "}
          <span className="text-foreground font-medium tabular-nums">
            {navigation.data.menuTreeDepth}
          </span>{" "}
          level{navigation.data.menuTreeDepth === 1 ? "" : "s"} — from{" "}
          <code>GET /workspace/navigation</code>, filtered to your own role and
          permissions.
        </p>
      ) : null}

      <div className="space-y-3">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, code, description…"
          searchLabel="Search modules"
          activeFilterCount={activeFilterCount}
          onClearFilters={() => {
            setSearch("");
            setStatus(ANY_STATUS);
          }}
          filters={
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_STATUS}>All statuses</SelectItem>
                <SelectItem value={ACTIVE_ONLY}>Active only</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        <ModulesTable
          modules={filtered}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          onToggleStatus={setPendingToggle}
          onDelete={setPendingDeletion}
          emptyState={
            activeFilterCount > 0 ? (
              <EmptyState
                title="No modules match"
                description="Try a different search term or status."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setStatus(ANY_STATUS);
                    }}
                  >
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Blocks}
                title="No modules yet"
                description="Register the first module to start building navigation."
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.workspaceAdmin.modules.create}>
                      <Plus />
                      New module
                    </Link>
                  </Button>
                }
              />
            )
          }
        />
      </div>

      <ToggleModuleStatusDialog
        module={pendingToggle}
        isPending={toggleStatus.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        onConfirm={async (module) => {
          await toggleStatus.mutateAsync({
            id: module.id,
            isActive: !module.isActive,
          });
          setPendingToggle(null);
        }}
      />

      <DeleteModuleDialog
        module={pendingDeletion}
        isPending={deleteModule.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDeletion(null);
        }}
        onConfirm={async (module) => {
          await deleteModule.mutateAsync(module.id);
          setPendingDeletion(null);
        }}
      />
    </div>
  );
}
