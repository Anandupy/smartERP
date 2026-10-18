"use client";

import { LayoutDashboard } from "@/assets/icons";
import { ROUTES } from "@/constants";
import { SectionNav } from "@/shared/components/layout";

import { BRANCH_SETTINGS_SECTIONS } from "./settings-sections";

export interface BranchSettingsNavProps {
  branchId: string;
  className?: string;
}

/** A branch's settings navigation — see `SectionNav`. */
export function BranchSettingsNav({
  branchId,
  className,
}: BranchSettingsNavProps) {
  return (
    <SectionNav
      label="Branch settings sections"
      className={className}
      items={[
        {
          id: "overview",
          label: "Overview",
          href: ROUTES.app.branches.settings.root(branchId),
          icon: LayoutDashboard,
          match: "exact",
        },
        ...BRANCH_SETTINGS_SECTIONS.map((section) => ({
          id: section.id,
          label: section.label,
          href: section.href(branchId),
          icon: section.icon,
          backendPending: section.backendPending,
        })),
      ]}
    />
  );
}
