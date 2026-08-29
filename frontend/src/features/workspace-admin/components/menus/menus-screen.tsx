"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ListTree, Plus } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/core/auth";
import { GuideHelpTrigger } from "@/core/guides";
import { useDebouncedValue } from "@/hooks";
import { DataTableToolbar } from "@/shared/components/data";
import { EmptyState, ForbiddenState, PageSkeleton } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  useDeleteMenu,
  useDuplicateMenu,
  useMenu,
  useMenus,
  useMoveMenu,
} from "../../hooks/use-menus";
import { useModules } from "../../hooks/use-modules";
import type { MenuDto, MenuListItemDto } from "../../types/menu.dto";
import { CreateMenuDialog, EditMenuDialog } from "./menu-form-dialog";
import { DeleteMenuDialog, DuplicateMenuDialog } from "./menu-dialogs";
import { MenuDetailDrawer } from "./menu-detail-drawer";
import { MenuMoveDialog } from "./menu-move-dialog";
import { MenuTree } from "./menu-tree";

const ANY_STATUS = "any";

export interface MenusScreenProps {
  /** Deep-links a specific menu — its module is resolved before the tree mounts. */
  initialMenuId?: string;
}

/**
 * Menu Details — the tree + detail experience for one module's menus.
 *
 * A module must be selected first, because a menu's `parentId` only ever
 * names another menu **within its own module** — there is no cross-module
 * hierarchy to render as one tree. Deep-linked from the Navigation Modules
 * screen and Module Details via `?module=<id>`, or from a specific menu's own
 * URL via `initialMenuId`; otherwise defaults to the first module returned.
 */
export function MenusScreen({ initialMenuId }: MenusScreenProps = {}) {
  const { hasRole } = usePermissions();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const searchParams = useSearchParams();

  const { modules, isPending: modulesPending } = useModules();
  const [selectedId, setSelectedId] = useState<string | null>(initialMenuId ?? null);

  // Resolves the deep-linked menu's own module before any other default applies.
  const initialMenu = useMenu(initialMenuId ?? "");

  const [manualModuleId, setManualModuleId] = useState<string | null>(null);
  const derivedModuleId = initialMenuId
    ? (initialMenu.data?.moduleId ?? "")
    : (searchParams.get("module") ?? modules[0]?.id ?? "");
  const moduleId = manualModuleId ?? derivedModuleId;

  const { menus, isPending, error, refetch } = useMenus(moduleId || undefined);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ANY_STATUS);
  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return menus.filter((menu) => {
      if (status !== ANY_STATUS && menu.status !== status) return false;
      if (needle.length === 0) return true;
      return [menu.displayName, menu.code, menu.route].some((field) =>
        field.toLowerCase().includes(needle),
      );
    });
  }, [menus, debouncedSearch, status]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MenuListItemDto | null>(null);
  const [moving, setMoving] = useState<MenuDto | null>(null);
  const [duplicating, setDuplicating] = useState<MenuDto | null>(null);
  const [deleting, setDeleting] = useState<MenuDto | null>(null);

  const move = useMoveMenu();
  const duplicate = useDuplicateMenu();
  const remove = useDeleteMenu();

  const selectedMenu = menus.find((menu) => menu.id === selectedId) ?? null;
  const hasChildren = deleting
    ? menus.some((menu) => menu.parentId === deleting.id)
    : false;

  if (!isSuperAdmin) {
    return (
      <ForbiddenState description="Navigation administration is Super Admin only." />
    );
  }

  if (modulesPending || (initialMenuId && initialMenu.isPending)) {
    return <PageSkeleton blocks={3} label="Loading menus" />;
  }

  if (modules.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Menu Details" />
        <EmptyState
          icon={ListTree}
          title="No modules yet"
          description="Create a module before adding menus to it."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu Details"
        description="The menu hierarchy of one module — module, menu, submenu, up to three levels deep."
        actions={
          <>
            <GuideHelpTrigger guideId="workspace-menus" />
            <Button
              onClick={() => setCreating(true)}
              disabled={!moduleId}
              data-guide="workspace-menus-create-link"
            >
              <Plus />
              New menu
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={moduleId} onValueChange={setManualModuleId}>
          <SelectTrigger
            className="w-full sm:w-64"
            aria-label="Module"
            data-guide="workspace-menus-module-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modules.map((module) => (
              <SelectItem key={module.id} value={module.id}>
                {module.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, code, route…"
        searchLabel="Search menus"
        filters={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_STATUS}>All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="BETA">Beta</SelectItem>
              <SelectItem value="COMING_SOON">Coming soon</SelectItem>
              <SelectItem value="DISABLED">Disabled</SelectItem>
              <SelectItem value="HIDDEN">Hidden</SelectItem>
              <SelectItem value="DEPRECATED">Deprecated</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <MenuTree
        menus={filtered}
        isLoading={isPending}
        error={error}
        onRetry={() => refetch()}
        selectedId={selectedId}
        onSelect={(menu) => setSelectedId(menu.id)}
      />

      <MenuDetailDrawer
        menuId={selectedId}
        menusInModule={menus}
        moduleActive={modules.find((m) => m.id === moduleId)?.isActive ?? true}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onEdit={() => {
          if (selectedMenu) setEditing(selectedMenu);
        }}
        onMove={() => {
          if (selectedMenu) setMoving(selectedMenu);
        }}
        onDuplicate={() => {
          if (selectedMenu) setDuplicating(selectedMenu);
        }}
        onDelete={() => {
          if (selectedMenu) setDeleting(selectedMenu);
        }}
      />

      <CreateMenuDialog
        open={creating}
        onOpenChange={setCreating}
        moduleId={moduleId}
        menusInModule={menus}
        onCreated={(menu) => setSelectedId(menu.id)}
      />

      <EditMenuDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        menu={editing}
        menusInModule={menus}
      />

      <MenuMoveDialog
        menu={moving}
        isPending={move.isPending}
        onOpenChange={(open) => {
          if (!open) setMoving(null);
        }}
        onConfirm={async ({ targetModuleId, targetParentId }) => {
          if (!moving) return;
          await move.mutateAsync({
            id: moving.id,
            body: { targetModuleId, targetParentId },
          });
          setMoving(null);
        }}
      />

      <DuplicateMenuDialog
        menu={duplicating}
        isPending={duplicate.isPending}
        onOpenChange={(open) => {
          if (!open) setDuplicating(null);
        }}
        onConfirm={async (menu) => {
          await duplicate.mutateAsync(menu.id);
          setDuplicating(null);
        }}
      />

      <DeleteMenuDialog
        menu={deleting}
        hasChildren={hasChildren}
        isPending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={async (menu) => {
          await remove.mutateAsync({ id: menu.id, moduleId: menu.moduleId });
          setSelectedId(null);
          setDeleting(null);
        }}
      />
    </div>
  );
}
