"use client";

import type { QueryKey } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";

import { moduleKeys } from "../api/modules.keys";
import { moduleService } from "../api/modules.service";
import { menuKeys } from "../api/menus.keys";
import { navigationKeys } from "../api/navigation.keys";
import type {
  CreateModuleRequest,
  ModuleDto,
  ModuleListItemDto,
  UpdateModuleRequest,
} from "../types/module.dto";

/** Every module. Sorted by `displayOrder` — the field the design itself sorts by. */
export function useModules() {
  const query = useQuery({
    queryKey: moduleKeys.lists(),
    queryFn: moduleService.list,
    meta: { skipErrorToast: true },
  });

  const modules = useMemo(() => {
    if (!query.data) return [];
    return [...query.data].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [query.data]);

  return { ...query, modules };
}

/** One module, with the menus beneath it. */
export function useModule(id: string) {
  return useQuery({
    queryKey: moduleKeys.detail(id),
    queryFn: () => moduleService.get(id),
    enabled: Boolean(id),
    meta: { skipErrorToast: true },
  });
}

export interface ModuleFilters {
  search: string;
  activeOnly: boolean;
}

/**
 * Narrow the loaded modules **in the client**.
 *
 * `GET /admin/navigation/modules` documents no query parameters
 * (`navigation-admin-module.controller.ts` has no `@Query` decorator), so
 * search and the active filter both run over the full returned list.
 */
export function filterModules(
  modules: readonly ModuleListItemDto[],
  filters: ModuleFilters,
): ModuleListItemDto[] {
  const needle = filters.search.trim().toLowerCase();

  return modules.filter((module) => {
    if (filters.activeOnly && !module.isActive) return false;
    if (needle.length === 0) return true;
    return [module.name, module.code, module.description ?? ""].some(
      (field) => field.toLowerCase().includes(needle),
    );
  });
}

async function invalidateModuleCaches(
  client: ReturnType<typeof useQueryClient>,
  id?: string,
) {
  const keys: QueryKey[] = [moduleKeys.lists(), navigationKeys.tree()];
  if (id) {
    keys.push(moduleKeys.detail(id), menuKeys.byModule(id));
  }
  await invalidateKeys(client, keys);
}

/** Create a module. */
export function useCreateModule() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: CreateModuleRequest) => moduleService.create(body),
    onSuccess: async (module: ModuleDto) => {
      await invalidateModuleCaches(queryClient);
      toast.success(`${module.name} created`);
    },
  });
}

/** Update a module. A genuine partial update — only changed fields are sent. */
export function useUpdateModule(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: UpdateModuleRequest) => moduleService.update(id, body),
    onSuccess: async (module: ModuleDto) => {
      queryClient.setQueryData(moduleKeys.detail(id), (current: unknown) =>
        current ? { ...(current as object), ...module } : current,
      );
      await invalidateModuleCaches(queryClient, id);
      toast.success("Module updated");
    },
  });
}

/**
 * Toggle a module's active flag to an explicit target value.
 *
 * Unlike Branch's status toggle, this endpoint's body is `{ isActive }` — a
 * real target, not a flip — so it is idempotent and safe to retry.
 * Deactivating hides every menu beneath it for every user immediately
 * (`workspace-module-ux-architecture.md`, Part 8, risk 3), which is why the
 * confirmation dialog names the affected menu count before calling this.
 */
export function useUpdateModuleStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      moduleService.updateStatus(id, { isActive }),
    onSuccess: async (module: ModuleDto) => {
      await invalidateModuleCaches(queryClient, module.id);
      toast.success(
        module.isActive ? "Module activated" : "Module deactivated",
      );
    },
  });
}

/** Delete a module. The backend blocks this (400) while menus still exist. */
export function useDeleteModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => moduleService.remove(id),
    onSuccess: async (_result, id) => {
      await invalidateModuleCaches(queryClient, id);
      toast.success("Module deleted");
    },
  });
}
