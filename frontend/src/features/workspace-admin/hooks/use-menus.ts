"use client";

import type { QueryKey } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";
import { buildTree, collectDescendantIds } from "@/utils";

import { menuKeys } from "../api/menus.keys";
import { menuService } from "../api/menus.service";
import { moduleKeys } from "../api/modules.keys";
import { navigationKeys } from "../api/navigation.keys";
import type {
  CreateMenuRequest,
  MenuDto,
  MenuListItemDto,
  MoveMenuRequest,
  ReorderMenuItem,
  UpdateMenuRequest,
  UpdateMenuStatusRequest,
} from "../types/menu.dto";

/** The maximum depth the backend's `MenuHierarchyValidator` allows — three levels. */
export const MAX_MENU_DEPTH = 3;

/** Every menu, or every menu of one module when `moduleId` is given. */
export function useMenus(moduleId?: string) {
  const query = useQuery({
    queryKey: moduleId ? menuKeys.byModule(moduleId) : menuKeys.lists(),
    queryFn: () => menuService.list(moduleId),
    meta: { skipErrorToast: true },
  });

  const menus = useMemo(() => {
    if (!query.data) return [];
    return [...query.data].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [query.data]);

  return { ...query, menus };
}

/** One menu, with its module, parent and children hydrated. */
export function useMenu(id: string) {
  return useQuery({
    queryKey: menuKeys.detail(id),
    queryFn: () => menuService.get(id),
    enabled: Boolean(id),
    meta: { skipErrorToast: true },
  });
}

/**
 * Candidate parents for a menu within one module.
 *
 * Narrows the picker so the two rules the backend enforces — no cycles, max
 * depth {@link MAX_MENU_DEPTH} — cannot be broken from the UI at all, rather
 * than being validated after a rejected request (the same pattern Program and
 * Academic Unit use for their own hierarchy pickers). Excludes the menu itself,
 * every one of its descendants, and any menu already at the deepest allowed
 * level (attaching a child beneath it would exceed the limit).
 */
export function eligibleParents(
  menusInModule: readonly MenuListItemDto[],
  excludeId?: string,
): MenuListItemDto[] {
  const { roots } = buildTree(menusInModule, {
    getId: (menu) => menu.id,
    getParentId: (menu) => menu.parentId,
  });

  const depthById = new Map<string, number>();
  const stamp = (nodes: typeof roots) => {
    for (const node of nodes) {
      depthById.set(node.id, node.depth);
      stamp(node.children);
    }
  };
  stamp(roots);

  const descendants = excludeId
    ? collectDescendantIds(menusInModule, {
        getId: (menu) => menu.id,
        getParentId: (menu) => menu.parentId,
      }, excludeId)
    : new Set<string>();

  return menusInModule.filter((menu) => {
    if (menu.id === excludeId) return false;
    if (descendants.has(menu.id)) return false;
    const depth = depthById.get(menu.id) ?? 0;
    return depth < MAX_MENU_DEPTH - 1;
  });
}

async function invalidateMenuCaches(
  client: ReturnType<typeof useQueryClient>,
  moduleIds: readonly string[],
  id?: string,
) {
  const keys: QueryKey[] = [
    menuKeys.lists(),
    navigationKeys.tree(),
    ...moduleIds.flatMap((moduleId) => [
      menuKeys.byModule(moduleId),
      moduleKeys.detail(moduleId),
    ]),
  ];
  if (id) keys.push(menuKeys.detail(id));
  await invalidateKeys(client, keys);
}

/** Create a menu. */
export function useCreateMenu() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: CreateMenuRequest) => menuService.create(body),
    onSuccess: async (menu: MenuDto) => {
      await invalidateMenuCaches(queryClient, [menu.moduleId]);
      toast.success(`${menu.displayName} created`);
    },
  });
}

/** Update a menu. A genuine partial update. */
export function useUpdateMenu(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: UpdateMenuRequest) => menuService.update(id, body),
    onSuccess: async (menu: MenuDto) => {
      await invalidateMenuCaches(queryClient, [menu.moduleId], id);
      toast.success("Menu updated");
    },
  });
}

/** Move a menu to a new parent and/or module. Rejected (400) on a cycle or depth violation. */
export function useMoveMenu() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: ({ id, body }: { id: string; body: MoveMenuRequest }) =>
      menuService.move(id, body),
    onSuccess: async (menu: MenuDto, { body }) => {
      const moduleIds = body.targetModuleId
        ? [menu.moduleId, body.targetModuleId]
        : [menu.moduleId];
      await invalidateMenuCaches(queryClient, moduleIds, menu.id);
      toast.success(`${menu.displayName} moved`);
    },
  });
}

/**
 * Reorder siblings under one parent.
 *
 * Used for the tree's "Move up"/"Move down" controls — a full drag-and-drop
 * reorder is not implemented (see `docs/workspace-admin-module.md`), but the
 * primitive the backend documents (`PUT /reorder`) is wired for the one case
 * this UI offers: swapping a node's `displayOrder` with an adjacent sibling.
 */
export function useReorderMenus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { items: ReorderMenuItem[]; moduleId: string }) =>
      menuService.reorder({ items: input.items }),
    onSuccess: async (_result, { moduleId }) => {
      await invalidateMenuCaches(queryClient, [moduleId]);
    },
  });
}

/** Change a menu's status. */
export function useUpdateMenuStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMenuStatusRequest }) =>
      menuService.updateStatus(id, body),
    onSuccess: async (menu: MenuDto) => {
      await invalidateMenuCaches(queryClient, [menu.moduleId], menu.id);
      toast.success("Menu status updated");
    },
  });
}

/** Duplicate a menu. The copy is created `DISABLED`, so it never appears live by accident. */
export function useDuplicateMenu() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => menuService.duplicate(id),
    onSuccess: async (menu: MenuDto) => {
      await invalidateMenuCaches(queryClient, [menu.moduleId]);
      toast.success(`Duplicated as “${menu.displayName}”, disabled`);
    },
  });
}

/** Delete a menu. The backend blocks this (400) while children still exist. */
export function useDeleteMenu() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; moduleId: string }) =>
      menuService.remove(id),
    onSuccess: async (_result, { id, moduleId }) => {
      await invalidateMenuCaches(queryClient, [moduleId], id);
      toast.success("Menu deleted");
    },
  });
}
