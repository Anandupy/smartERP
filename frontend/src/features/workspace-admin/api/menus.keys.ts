import { createQueryKeys } from "@/core/query";

const base = createQueryKeys("workspace-admin-menus");

/**
 * Query keys for `/admin/navigation/menus`.
 *
 * `byModule` is a distinct key from `lists()` — `GET ?moduleId=` is a genuinely
 * different server response (a filtered list), not a client-side view over the
 * same cache entry, so it must not share one.
 */
export const menuKeys = {
  ...base,
  byModule: (moduleId: string) =>
    ["workspace-admin-menus", "list", "module", moduleId] as const,
} as const;
