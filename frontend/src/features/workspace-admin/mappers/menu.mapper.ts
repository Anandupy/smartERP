import { NO_PARENT, type MenuFormValues } from "../schemas/menu.schema";
import type { CreateMenuRequest, MenuDto } from "../types/menu.dto";

/** `"a, b,,c"` → `["a", "b", "c"]`. Blank entries and surrounding space are dropped. */
function parseList(text: string): string[] {
  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Seed the form from a loaded menu. */
export function toMenuFormValues(menu: MenuDto): MenuFormValues {
  return {
    code: menu.code,
    moduleId: menu.moduleId,
    parentId: menu.parentId ?? NO_PARENT,
    route: menu.route,
    componentIdentifier: menu.componentIdentifier ?? "",
    displayName: menu.displayName,
    icon: menu.icon ?? "",
    tooltip: menu.tooltip ?? "",
    description: menu.description ?? "",
    permissionsText: menu.permissions.join(", "),
    permissionMode: menu.permissionMode,
    displayOrder: menu.displayOrder,
    badge: menu.badge ?? "",
    searchKeywordsText: menu.searchKeywords.join(", "),
    status: menu.status,
  };
}

/** Build the request body. `parentId` reverses the `NO_PARENT` sentinel to `null`. */
export function toMenuRequest(values: MenuFormValues): CreateMenuRequest {
  return {
    code: values.code,
    moduleId: values.moduleId,
    parentId: values.parentId === NO_PARENT ? null : values.parentId,
    route: values.route,
    componentIdentifier: values.componentIdentifier || undefined,
    displayName: values.displayName,
    icon: values.icon || undefined,
    tooltip: values.tooltip || undefined,
    description: values.description || undefined,
    permissions: parseList(values.permissionsText),
    permissionMode: values.permissionMode,
    displayOrder: values.displayOrder,
    badge: values.badge || undefined,
    searchKeywords: parseList(values.searchKeywordsText),
    status: values.status,
  };
}
