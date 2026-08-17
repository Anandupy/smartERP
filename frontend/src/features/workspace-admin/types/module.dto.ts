/**
 * Wire shapes for `/admin/navigation/modules`.
 *
 * Transcribed from the backend source directly — `navigation-response.dto.ts`,
 * `create-module.dto.ts`, `update-module.dto.ts`, `module-status.dto.ts` and
 * `navigation-admin-module.controller.ts` — not from the Postman collection,
 * whose response bodies are auto-generated placeholder schemas for every field
 * except the name. SUPER_ADMIN + `settings.manage` on every endpoint.
 *
 * `UpdateModuleRequest` is a real partial (`PartialType(CreateModuleDto)` on
 * the backend), unlike Branch/Organization's full-body PATCH — an edit here
 * sends only the changed fields.
 */

/** A module as the backend returns it. */
export interface ModuleDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  /** System modules ship with the product: code is fixed, hard delete is blocked. */
  isSystem: boolean;
  /** An inactive module contributes nothing to any user's navigation tree. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `GET /admin/navigation/modules` row — the module plus its menu count. */
export interface ModuleListItemDto extends ModuleDto {
  _count: { menus: number };
}

/** `GET /admin/navigation/modules/:id` — the module with every menu beneath it. */
export interface ModuleDetailDto extends ModuleDto {
  menus: import("./menu.dto").MenuDto[];
}

/** Body for `POST /admin/navigation/modules`. */
export interface CreateModuleRequest {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
}

/** Body for `PATCH /admin/navigation/modules/:id` — a genuine partial update. */
export type UpdateModuleRequest = Partial<CreateModuleRequest>;

/** Body for `PATCH /admin/navigation/modules/:id/status`. */
export interface UpdateModuleStatusRequest {
  isActive: boolean;
}

/** Acknowledgement from the delete endpoint. */
export interface NavigationActionResultDto {
  success: boolean;
}
