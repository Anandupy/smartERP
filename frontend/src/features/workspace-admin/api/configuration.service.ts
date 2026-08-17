import { api } from "@/core/api";

import type {
  UpsertWorkspaceConfigurationRequest,
  WorkspaceConfigurationDto,
} from "../types/configuration.dto";

/**
 * Transport for `/workspace/configuration`.
 *
 * One method, because one endpoint exists: `POST /workspace/configuration`,
 * SUPER_ADMIN + `settings.manage`. No `GET`, no `list`, no `DELETE` —
 * `workspace-config.controller.ts`'s only handler is `upsertConfiguration`.
 */
export const configurationService = {
  upsert: (body: UpsertWorkspaceConfigurationRequest) =>
    api.post<WorkspaceConfigurationDto, UpsertWorkspaceConfigurationRequest>(
      "/workspace/configuration",
      body,
    ),
} as const;
