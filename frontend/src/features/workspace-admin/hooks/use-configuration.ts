"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { configurationService } from "../api/configuration.service";
import type { UpsertWorkspaceConfigurationRequest } from "../types/configuration.dto";

/**
 * Upsert a workspace configuration layer.
 *
 * No cache to invalidate here beyond what `core/workspace` already owns: this
 * module does not fetch `GET /workspace` (no screen in it needs the merged
 * result), so there is nothing local to refresh. If a future screen reads the
 * merged configuration, it should invalidate `core/workspace`'s own query keys
 * on success — not duplicate its cache here.
 */
export function useUpsertConfiguration() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: UpsertWorkspaceConfigurationRequest) =>
      configurationService.upsert(body),
    onSuccess: () => {
      toast.success("Configuration layer saved");
    },
  });
}
