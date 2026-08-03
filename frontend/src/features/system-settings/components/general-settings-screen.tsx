"use client";

import { PageHeader } from "@/shared/components/layout";

import { GeneralSettingsForm } from "./general-settings-form";
import { SettingsBoundary } from "./settings-boundary";

/**
 * General Settings: product identity and deployment environment.
 *
 * Fully wired — `GET` and `PATCH /system-settings` are both documented, and
 * every field on this screen appears in the documented data structure.
 */
export function GeneralSettingsScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="General Settings"
        description="Product identity and the environment this deployment reports itself as."
      />

      <SettingsBoundary>
        {(settings) => <GeneralSettingsForm settings={settings} />}
      </SettingsBoundary>
    </div>
  );
}
