import { api } from "@/core/api";

import type { WorkspaceSetupStatusDto } from "../types/setup.dto";

/**
 * Transport for `/workspace/setup`.
 *
 * `getStatus` is `SUPER_ADMIN`/`ORG_ADMIN`, `@AllowDuringSetup()` (readable
 * even before bootstrap completes). `complete` is used nowhere in this module
 * — a full setup wizard is out of scope for the six screens shipped here (see
 * `docs/workspace-admin-module.md`); `getStatus` backs a small non-blocking
 * banner only.
 */
export const setupService = {
  getStatus: () => api.get<WorkspaceSetupStatusDto>("/workspace/setup/status"),
} as const;
