import { api } from "@/core/api";

import type { NavigationTreeDto } from "../types/navigation.dto";

/**
 * Transport for `GET /workspace/navigation` — the runtime, permission-filtered
 * tree for the **calling user**, not a management listing. Used in this module
 * only to show how much of the authored hierarchy currently reaches a real
 * navigation tree (`totalVisibleMenus`, `menuTreeDepth`); admin listings always
 * come from `/admin/navigation/*`, never from here (see §16 of the module brief
 * — this endpoint must not be mistaken for CRUD).
 */
export const navigationService = {
  getTree: () => api.get<NavigationTreeDto>("/workspace/navigation"),
} as const;
