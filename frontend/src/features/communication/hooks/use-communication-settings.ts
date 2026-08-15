"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { communicationKeys } from "../api/communication.keys";
import { communicationService } from "../api/communication.service";
import type {
  CommunicationSettingsDto,
  CommunicationSettingsQuery,
  CommunicationSettingsWriteRequest,
} from "../types/settings.dto";

/**
 * Communication settings for the active organization/branch scope.
 *
 * Documented to answer with defaults rather than `404` when nothing has been
 * saved for a scope yet, so — unlike System Settings — this screen has no
 * "not initialized" state to branch on.
 */
export function useCommunicationSettings(query: CommunicationSettingsQuery | null) {
  return useQuery({
    queryKey: communicationKeys.settings.scope(query ?? {}),
    queryFn: () => communicationService.settings.get(query ?? {}),
    enabled: query !== null,
    meta: { skipErrorToast: true },
  });
}

/**
 * Update communication settings for a scope.
 *
 * The write returns the saved record, so the cache is seeded directly rather
 * than re-fetched — the same convention System Settings uses for its own
 * singleton resource.
 */
export function useUpdateCommunicationSettings(
  query: CommunicationSettingsQuery | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: CommunicationSettingsWriteRequest) =>
      communicationService.settings.update(query ?? {}, body),
    onSuccess: (settings: CommunicationSettingsDto) => {
      queryClient.setQueryData(
        communicationKeys.settings.scope(query ?? {}),
        settings,
      );
      toast.success("Communication settings saved");
    },
  });
}
