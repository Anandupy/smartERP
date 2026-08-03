"use client";

import { FormSkeleton } from "@/shared/components/feedback";
import { ApiErrorState } from "@/shared/components/feedback";

import {
  isNotInitialized,
  useSystemSettings,
} from "../hooks/use-system-settings";
import type { SystemSettingsDto } from "../types/system-settings.dto";
import { SettingsNotInitialized } from "./settings-not-initialized";

export interface SettingsBoundaryProps {
  /** Rendered only once the settings record exists. */
  children: (settings: SystemSettingsDto) => React.ReactNode;
  /** Skeleton shape while loading. Forms want fields; the overview wants cards. */
  fallback?: React.ReactNode;
}

/**
 * The four states of "we need the settings record", handled once.
 *
 * Every settings screen needs the same record and the same four answers —
 * loading, not initialized, failed, loaded — so they are resolved here and each
 * screen receives a `settings` that is guaranteed to exist. That is what keeps
 * five screens from each re-deciding what a `404` means.
 *
 * A render-prop rather than a context: the value is required, not optional, so
 * the type should say so at the call site instead of every consumer unwrapping
 * a nullable.
 */
export function SettingsBoundary({
  children,
  fallback,
}: SettingsBoundaryProps) {
  const query = useSystemSettings();

  if (query.isPending) {
    return (
      <>{fallback ?? <FormSkeleton fields={4} label="Loading settings" />}</>
    );
  }

  if (query.error) {
    if (isNotInitialized(query.error)) {
      return <SettingsNotInitialized />;
    }
    return (
      <ApiErrorState error={query.error} onRetry={() => query.refetch()} />
    );
  }

  return <>{children(query.data)}</>;
}
