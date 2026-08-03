"use client";

import { Cpu, Database, Server, Tag } from "@/assets/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiConfig, appConfig } from "@/config";
import { DescriptionList, StatusBadge } from "@/shared/components/data-display";
import {
  BackendPendingBadge,
  BackendPendingNote,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { ENVIRONMENT_PRESENTATION } from "../constants";
import { SettingsBoundary } from "./settings-boundary";
import type { SystemSettingsDto } from "../types/system-settings.dto";

/** The half of this screen that has a documented source. */
function ConfiguredSystem({ settings }: { settings: SystemSettingsDto }) {
  const environment = ENVIRONMENT_PRESENTATION[settings.environment];

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Tag aria-hidden="true" className="size-4" />
          Configured system
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <DescriptionList
          columns={2}
          items={[
            { key: "product", label: "Product", value: settings.productName },
            { key: "code", label: "Product code", value: settings.productCode },
            { key: "version", label: "Version", value: settings.version },
            {
              key: "environment",
              label: "Environment",
              value: (
                <StatusBadge tone={environment.tone} dot>
                  {environment.label}
                </StatusBadge>
              ),
            },
            {
              key: "maintenance",
              label: "Maintenance mode",
              value: settings.maintenanceMode ? "On" : "Off",
            },
            {
              key: "support-email",
              label: "Support email",
              value: settings.supportEmail,
            },
            {
              key: "support-phone",
              label: "Support phone",
              value: settings.supportPhone,
            },
            {
              key: "maintenance-message",
              label: "Maintenance message",
              value: settings.maintenanceMessage || "—",
              wide: true,
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

/**
 * System Information — a read-only view of what this deployment is.
 *
 * Split deliberately into what is *known* and what is *not*. The configured
 * system comes from the settings record; the client build comes from validated
 * app config. Everything the design also shows — uptime, build id, database
 * latency, node health, license tier — has no documented endpoint in the System
 * Settings, Maintenance or Audit contracts, so it is named as pending rather
 * than filled with plausible numbers. A fabricated "99.98% uptime" is the kind
 * of figure an operator would act on.
 */
export function SystemInformationScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Information"
        description="Technical parameters and configured values for this installation."
      />

      <SettingsBoundary>
        {(settings) => <ConfiguredSystem settings={settings} />}
      </SettingsBoundary>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Cpu aria-hidden="true" className="size-4" />
            Client build
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList
            columns={2}
            items={[
              { key: "app", label: "Application", value: appConfig.name },
              { key: "edition", label: "Edition", value: appConfig.edition },
              {
                key: "client-version",
                label: "Frontend version",
                value: appConfig.version,
              },
              {
                key: "api",
                label: "API base",
                value: (
                  <code className="bg-muted rounded px-1 py-0.5 text-xs break-all">
                    {apiConfig.baseURL}
                  </code>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Server aria-hidden="true" className="size-4" />
            Infrastructure
            <BackendPendingBadge className="ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Server, label: "Uptime & availability" },
              { icon: Database, label: "Database health & latency" },
              { icon: Cpu, label: "Node inventory & throughput" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="border-border text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {label}
              </div>
            ))}
          </div>
          <BackendPendingNote>
            uptime, build identifiers, deployment region, database metrics,
            infrastructure nodes and license tier are not part of the System
            Settings, Maintenance or Audit contracts, and no response shape is
            documented for them.
          </BackendPendingNote>
        </CardContent>
      </Card>
    </div>
  );
}
