"use client";

import { LayoutDashboard } from "@/assets/icons";
import { ROUTES } from "@/constants";
import { SectionNav } from "@/shared/components/layout";

import { SECURITY_SECTIONS } from "../constants";

export interface SecurityNavProps {
  className?: string;
}

/** Account & Security's section navigation — see `SectionNav`. */
export function SecurityNav({ className }: SecurityNavProps) {
  return (
    <SectionNav
      label="Security sections"
      className={className}
      items={[
        {
          id: "overview",
          label: "Overview",
          href: ROUTES.app.security.root,
          icon: LayoutDashboard,
          match: "exact",
        },
        ...SECURITY_SECTIONS.map((section) => ({
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
