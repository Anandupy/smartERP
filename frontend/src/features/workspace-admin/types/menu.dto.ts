/**
 * Wire shapes for `/admin/navigation/menus`.
 *
 * Transcribed from the backend source — `navigation-response.dto.ts`,
 * `create-menu.dto.ts`, `update-menu.dto.ts`, `move-menu.dto.ts`,
 * `reorder-menu.dto.ts`, `menu-status.dto.ts`, the Prisma `MenuStatus` enum and
 * `navigation-admin-menu.controller.ts`. SUPER_ADMIN + `settings.manage` on
 * every endpoint.
 *
 * Two invariants the backend enforces and this module never re-decides on the
 * client as if it were authoritative: max nesting depth 3, and no cycles
 * (`MenuHierarchyValidator`). The UI narrows choices to make the common mistake
 * unrepresentable (see `eligibleParents` in `hooks/use-menus.ts`), but the
 * server's rejection is still the real answer.
 */

/** Every status the schema allows. Only `ACTIVE` and `BETA` ever reach a real user's tree. */
export const MENU_STATUSES = [
  "ACTIVE",
  "DISABLED",
  "COMING_SOON",
  "BETA",
  "HIDDEN",
  "DEPRECATED",
] as const;

export type MenuStatus = (typeof MENU_STATUSES)[number];

export const PERMISSION_MODES = ["ALL", "ANY"] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];

/** A menu as the backend returns it. */
export interface MenuDto {
  id: string;
  code: string;
  moduleId: string;
  parentId: string | null;
  route: string;
  componentIdentifier: string | null;
  /** Permission keys checked before the menu is shown. Empty means everyone. */
  permissions: string[];
  permissionMode: PermissionMode;
  displayName: string;
  icon: string | null;
  tooltip: string | null;
  description: string | null;
  displayOrder: number;
  badge: string | null;
  /** Extra terms that match this menu in a command palette. */
  searchKeywords: string[];
  helpUrl: string | null;
  documentationUrl: string | null;
  status: MenuStatus;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The module reference carried on an admin menu list row. */
export interface MenuModuleRefDto {
  id: string;
  code: string;
  name: string;
}

/** The parent reference carried on an admin menu list row. */
export interface MenuParentRefDto {
  id: string;
  code: string;
  displayName: string;
}

/** `GET /admin/navigation/menus` row — the menu with its module and parent named. */
export interface MenuListItemDto extends MenuDto {
  module: MenuModuleRefDto;
  parent: MenuParentRefDto | null;
}

/** `GET /admin/navigation/menus/:id` — module, parent and children fully hydrated. */
export interface MenuDetailDto extends MenuDto {
  module: import("./module.dto").ModuleDto;
  parent: MenuDto | null;
  children: MenuDto[];
}

/** Body for `POST /admin/navigation/menus`. */
export interface CreateMenuRequest {
  code: string;
  moduleId: string;
  parentId?: string | null;
  route: string;
  componentIdentifier?: string;
  displayName: string;
  icon?: string;
  tooltip?: string;
  description?: string;
  permissions?: string[];
  permissionMode?: PermissionMode;
  displayOrder?: number;
  badge?: string;
  searchKeywords?: string[];
  status?: MenuStatus;
}

/** Body for `PATCH /admin/navigation/menus/:id` — a genuine partial update. */
export type UpdateMenuRequest = Partial<CreateMenuRequest>;

/** Body for `PATCH /admin/navigation/menus/:id/move`. */
export interface MoveMenuRequest {
  /** `null` promotes the menu to root level within its (possibly new) module. */
  targetParentId?: string | null;
  targetModuleId?: string;
  displayOrder?: number;
}

/** One row of `PUT /admin/navigation/menus/reorder`. */
export interface ReorderMenuItem {
  id: string;
  displayOrder: number;
}

/** Body for `PUT /admin/navigation/menus/reorder`. */
export interface ReorderMenusRequest {
  items: ReorderMenuItem[];
}

/** Body for `PATCH /admin/navigation/menus/:id/status`. */
export interface UpdateMenuStatusRequest {
  status: MenuStatus;
}
