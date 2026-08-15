"use client";

import { ApiErrorState, FormSkeleton } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { useCommunicationScope } from "../../hooks/use-communication-scope";
import { useCommunicationSettings } from "../../hooks/use-communication-settings";
import { CommunicationNoScopeState } from "../communication-scope-gate";
import { CommunicationSettingsForm } from "./communication-settings-form";

/**
 * Communication Settings — `GET`/`PATCH /communication/settings`.
 *
 * Unlike System Settings, this endpoint is documented to answer with defaults
 * rather than `404` when nothing has been saved for a scope yet — so this
 * screen has no "not initialized" branch, only loading, error and loaded.
 */
export function CommunicationSettingsScreen() {
  const scope = useCommunicationScope();
  const { data: settings, isPending, error, refetch } = useCommunicationSettings(
    scope,
  );

  if (!scope) {
    return (
      <div className="space-y-6">
        <PageHeader title="Communication Settings" />
        <CommunicationNoScopeState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication Settings"
        description="Channels, operations and default providers for the active organization and branch."
      />

      {isPending ? <FormSkeleton fields={8} /> : null}

      {error ? <ApiErrorState error={error} onRetry={() => refetch()} /> : null}

      {settings && !error ? (
        <CommunicationSettingsForm settings={settings} scope={scope} />
      ) : null}
    </div>
  );
}
