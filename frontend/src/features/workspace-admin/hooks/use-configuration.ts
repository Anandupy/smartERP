"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isApiError } from "@/core/api";

import { configurationKeys } from "../api/configuration.keys";
import { configurationService } from "../api/configuration.service";
import type {
  UpsertWorkspaceConfigurationRequest,
  WorkspaceScopeType,
} from "../types/configuration.dto";

/**
 * Read one configuration layer by its exact `(scopeType, scopeId)` key.
 *
 * `null` means the layer has not been defined yet — the backend answers 404,
 * which is the expected default state for most scopes, not an error. A real
 * failure (network, 500, permission) still rejects normally so the caller can
 * show it. Disabled for a non-PRODUCT scope with no `scopeId` chosen yet,
 * since that combination has no layer to look up.
 */
export function useConfiguration(
  scopeType: WorkspaceScopeType,
  scopeId: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: configurationKeys.detail(scopeType, scopeId),
    queryFn: async () => {
      try {
        return await configurationService.get(scopeType, scopeId);
      } catch (error) {
        if (isApiError(error) && error.kind === "notFound") return null;
        throw error;
      }
    },
    enabled:
      (options?.enabled ?? true) &&
      (scopeType === "PRODUCT" || Boolean(scopeId)),
  });
}

/**
 * Upsert a workspace configuration layer.
 *
 * Invalidates that scope's `useConfiguration` query on success so a screen
 * showing the layer picks up the persisted result rather than only its own
 * optimistic form state — the point of `GET /workspace/configuration/:scopeType`
 * existing at all.
 */
export function useUpsertConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: UpsertWorkspaceConfigurationRequest) =>
      configurationService.upsert(body),
    onSuccess: (_data, variables) => {
      toast.success("Configuration layer saved");
      void queryClient.invalidateQueries({
        queryKey: configurationKeys.detail(
          variables.scopeType,
          variables.scopeId ?? null,
        ),
      });
    },
  });
}
