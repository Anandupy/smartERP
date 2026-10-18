"use client";

import { LayoutDashboard } from "@/assets/icons";
import { ROUTES } from "@/constants";
import { SectionNav } from "@/shared/components/layout";

import { SETTINGS_SECTIONS } from "../constants";

export interface SettingsNavProps {
  className?: string;
}

/** System Settings' section navigation — see `SectionNav`. */
export function SettingsNav({ className }: SettingsNavProps) {
  return (
    <SectionNav
      label="Settings sections"
      className={className}
      items={[
        {
          id: "overview",
          label: "Overview",
          href: ROUTES.app.settings.root,
          icon: LayoutDashboard,
          match: "exact",
        },
        ...SETTINGS_SECTIONS.map((section) => ({
          id: section.id,
          label: section.label,
          href: section.href,
          icon: section.icon,
          backendPending: section.backendPending,
        })),
      ]}
    />
  );
}
