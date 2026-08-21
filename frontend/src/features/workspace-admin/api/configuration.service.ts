import { api } from "@/core/api";

import type {
  UpsertWorkspaceConfigurationRequest,
  WorkspaceConfigurationDto,
  WorkspaceScopeType,
} from "../types/configuration.dto";

/**
 * Transport for `/workspace/configuration`.
 *
 * `POST /workspace/configuration` (SUPER_ADMIN + `settings.manage`) upserts a
 * layer. `GET /workspace/configuration/:scopeType` (same guard, added
 * 2026-08-21) reads one back by its exact `(scopeType, scopeId)` key — not the
 * merged view `GET /workspace` resolves. There is still no `list`/`DELETE`;
 * `workspace.controller.ts`'s only handlers on this path are `upsertConfiguration`
 * and `getConfiguration`.
 */
export const configurationService = {
  upsert: (body: UpsertWorkspaceConfigurationRequest) =>
    api.post<WorkspaceConfigurationDto, UpsertWorkspaceConfigurationRequest>(
      "/workspace/configuration",
      body,
    ),

  /**
   * Throws a `notFound` `ApiError` when no layer has been defined for this
   * scope yet — the backend's `getConfiguration` returns 404 rather than an
   * empty layer, since "no layer" and "a layer with no keys set" are
   * different states. `useConfiguration` translates that 404 into `null`.
   */
  get: (scopeType: WorkspaceScopeType, scopeId?: string | null) =>
    api.get<WorkspaceConfigurationDto>(
      `/workspace/configuration/${scopeType}`,
      { params: scopeId ? { scopeId } : undefined },
    ),
} as const;
