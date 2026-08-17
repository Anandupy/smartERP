import { api } from "@/core/api";

import type {
  CreateModuleRequest,
  ModuleDetailDto,
  ModuleDto,
  ModuleListItemDto,
  NavigationActionResultDto,
  UpdateModuleRequest,
  UpdateModuleStatusRequest,
} from "../types/module.dto";

const BASE = "/admin/navigation/modules";

/**
 * Transport for `/admin/navigation/modules`.
 *
 * Written out rather than built from `createResourceService`: the list
 * endpoint takes no query parameters (confirmed against
 * `navigation-admin-module.controller.ts` — no `@Query` decorator), and the
 * status toggle and delete responses are not plain entities.
 */
export const moduleService = {
  list: () => api.get<ModuleListItemDto[]>(BASE),
  get: (id: string) => api.get<ModuleDetailDto>(`${BASE}/${id}`),
  create: (body: CreateModuleRequest) =>
    api.post<ModuleDto, CreateModuleRequest>(BASE, body),
  update: (id: string, body: UpdateModuleRequest) =>
    api.patch<ModuleDto, UpdateModuleRequest>(`${BASE}/${id}`, body),
  updateStatus: (id: string, body: UpdateModuleStatusRequest) =>
    api.patch<ModuleDto, UpdateModuleStatusRequest>(
      `${BASE}/${id}/status`,
      body,
    ),
  /** Blocked (400) while the module is system-owned or still has menus. */
  remove: (id: string) =>
    api.delete<NavigationActionResultDto>(`${BASE}/${id}`),
} as const;
