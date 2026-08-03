"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isApiError } from "@/core/api";

import {
  GLOBAL_SETTINGS,
  systemSettingsKeys,
} from "../api/system-settings.keys";
import { systemSettingsService } from "../api/system-settings.service";
import type {
  InitSystemSettingsRequest,
  SystemSettingsDto,
  UpdateSystemSettingsRequest,
} from "../types/system-settings.dto";

const SETTINGS_KEY = systemSettingsKeys.detail(GLOBAL_SETTINGS);

/**
 * The global configuration.
 *
 * Every settings screen reads this one query, so the record is fetched once and
 * shared: the dashboard, the two forms and System Information all render from
 * the same cache entry and cannot show different values for the same field.
 *
 * The toast is suppressed because every screen renders the failure inline
 * through `ApiErrorState` — including the `notFound` case, which is not really
 * an error but the installation's "not initialized yet" state.
 */
export function useSystemSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: systemSettingsService.get,
    meta: { skipErrorToast: true },
  });
}

/**
 * Whether a settings query failed because the record does not exist yet.
 *
 * Initialization is a documented one-time endpoint, so "no settings" is a state
 * the UI can act on rather than an error to apologise for.
 */
export function isNotInitialized(error: unknown): boolean {
  return isApiError(error) && error.kind === "notFound";
}

/**
 * Update the global configuration.
 *
 * The body is always complete — see `types/system-settings.dto.ts` — so callers
 * pass a request built by the mapper rather than raw form values. On success
 * the response seeds the cache directly: the write returns the record, so
 * re-fetching it would only spend a round trip to learn what is already known.
 *
 * Failures stay inline (`skipErrorToast`) so field errors land on the field
 * that caused them instead of in a toast the form cannot point at.
 */
export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: UpdateSystemSettingsRequest) =>
      systemSettingsService.update(body),
    onSuccess: (settings: SystemSettingsDto) => {
      queryClient.setQueryData(SETTINGS_KEY, settings);
      toast.success("Settings saved");
    },
  });
}

/**
 * Initialize the global configuration.
 *
 * Documented as allowed once, ever, so there is no retry and no optimistic
 * update: the mutation either establishes the record or it does not, and the
 * screen re-reads the truth from the response.
 */
export function useInitializeSystemSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: InitSystemSettingsRequest) =>
      systemSettingsService.initialize(body),
    onSuccess: (settings: SystemSettingsDto) => {
      queryClient.setQueryData(SETTINGS_KEY, settings);
      toast.success("System settings initialized");
    },
  });
}
