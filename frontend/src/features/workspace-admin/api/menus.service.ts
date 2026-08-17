import { api } from "@/core/api";

import type {
  CreateMenuRequest,
  MenuDetailDto,
  MenuDto,
  MenuListItemDto,
  MoveMenuRequest,
  ReorderMenusRequest,
  UpdateMenuRequest,
  UpdateMenuStatusRequest,
} from "../types/menu.dto";
import type { NavigationActionResultDto } from "../types/module.dto";

const BASE = "/admin/navigation/menus";

/** Transport for `/admin/navigation/menus`. Written out — several actions have no plain-entity response. */
export const menuService = {
  /** `GET ?moduleId=` when provided — a documented, optional filter. */
  list: (moduleId?: string) =>
    api.get<MenuListItemDto[]>(BASE, {
      params: moduleId ? { moduleId } : undefined,
    }),
  get: (id: string) => api.get<MenuDetailDto>(`${BASE}/${id}`),
  create: (body: CreateMenuRequest) =>
    api.post<MenuDto, CreateMenuRequest>(BASE, body),
  update: (id: string, body: UpdateMenuRequest) =>
    api.patch<MenuDto, UpdateMenuRequest>(`${BASE}/${id}`, body),
  /** Rejected (400) when the move would create a cycle or exceed depth 3. */
  move: (id: string, body: MoveMenuRequest) =>
    api.patch<MenuDto, MoveMenuRequest>(`${BASE}/${id}/move`, body),
  reorder: (body: ReorderMenusRequest) =>
    api.put<NavigationActionResultDto, ReorderMenusRequest>(
      `${BASE}/reorder`,
      body,
    ),
  updateStatus: (id: string, body: UpdateMenuStatusRequest) =>
    api.patch<MenuDto, UpdateMenuStatusRequest>(`${BASE}/${id}/status`, body),
  /** Copies with a `_COPY_<ts>` code suffix and forced status `DISABLED`. */
  duplicate: (id: string) => api.post<MenuDto>(`${BASE}/${id}/duplicate`),
  /** Blocked (400) while the menu is system-owned or still has children. */
  remove: (id: string) =>
    api.delete<NavigationActionResultDto>(`${BASE}/${id}`),
} as const;
