"use client";

import { PageHeader } from "@/shared/components/layout";

import { MaintenanceSupportForm } from "./maintenance-support-form";
import { SettingsBoundary } from "./settings-boundary";

/**
 * Maintenance & Support: the installation-wide maintenance switch, the notice
 * that accompanies it, and the support channels.
 *
 * Fully wired — all four fields are part of the documented settings record.
 */
export function MaintenanceSupportScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance &amp; Support"
        description="Take the whole installation offline for planned work, and publish where users can get help."
      />

      <SettingsBoundary>
        {(settings) => <MaintenanceSupportForm settings={settings} />}
      </SettingsBoundary>
    </div>
  );
}
