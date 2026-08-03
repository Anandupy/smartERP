"use client";

import { CircleCheckBig, Server, Tag, Wrench } from "@/assets/icons";
import { StatusBadge } from "@/shared/components/data-display";

import { ENVIRONMENT_PRESENTATION } from "../constants";
import type { SystemSettingsDto } from "../types/system-settings.dto";

export interface SettingsStatusStripProps {
  settings: SystemSettingsDto;
}

/**
 * The three facts an operator checks first: what this deployment is, which
 * release it runs, and whether it is currently in maintenance.
 *
 * Every value comes from the settings record — nothing is derived from uptime,
 * health probes or build metadata, none of which this module has a documented
 * contract for.
 */
export function SettingsStatusStrip({ settings }: SettingsStatusStripProps) {
  const environment = ENVIRONMENT_PRESENTATION[settings.environment];

  return (
    <div className="border-border bg-card flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <Server aria-hidden="true" className="text-muted-foreground size-4" />
        <span className="text-muted-foreground text-xs tracking-wide uppercase">
          Environment
        </span>
        <StatusBadge tone={environment.tone} dot>
          {environment.label}
        </StatusBadge>
      </div>

      <div className="flex items-center gap-2">
        <Tag aria-hidden="true" className="text-muted-foreground size-4" />
        <span className="text-muted-foreground text-xs tracking-wide uppercase">
          Version
        </span>
        <span className="text-foreground text-sm font-medium">
          {settings.version}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Wrench aria-hidden="true" className="text-muted-foreground size-4" />
        <span className="text-muted-foreground text-xs tracking-wide uppercase">
          Maintenance
        </span>
        {settings.maintenanceMode ? (
          <StatusBadge tone="warning" icon={Wrench}>
            Active
          </StatusBadge>
        ) : (
          <StatusBadge tone="success" icon={CircleCheckBig}>
            Online
          </StatusBadge>
        )}
      </div>
    </div>
  );
}
