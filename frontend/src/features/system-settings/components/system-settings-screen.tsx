"use client";

import { LinkCard } from "@/shared/components/data-display";
import { BackendPendingBadge } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { SETTINGS_SECTIONS } from "../constants";
import { SettingsBoundary } from "./settings-boundary";
import { SettingsStatusStrip } from "./settings-status-strip";

/**
 * The System Settings overview.
 *
 * A status strip answering "what is this deployment doing right now", then one
 * card per section. Sections whose backend contract is not documented carry the
 * marker here as well as inside, so the state is visible before the user
 * commits to a click.
 */
export function SystemSettingsScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Global configuration for this CampusFlow ERP installation."
      />

      <SettingsBoundary>
        {(settings) => <SettingsStatusStrip settings={settings} />}
      </SettingsBoundary>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_SECTIONS.map((section) => (
          <LinkCard
            key={section.id}
            icon={section.icon}
            title={section.label}
            description={section.description}
            href={section.href}
            badge={section.backendPending ? <BackendPendingBadge /> : undefined}
          />
        ))}
      </div>
    </div>
  );
}
