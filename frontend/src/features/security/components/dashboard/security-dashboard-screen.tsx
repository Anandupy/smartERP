"use client";

import { LinkCard } from "@/shared/components/data-display";
import { BackendPendingBadge } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { SECURITY_SECTIONS } from "../../constants";
import { AccountOverviewCard } from "./account-overview-card";

/**
 * Account & Security Center — overview.
 *
 * Mirrors the System Settings dashboard: a status card built from real data,
 * then one card per section. There is no security score here — the backend
 * exposes no such metric, and the Stitch design's "84 Excellent" badge is not
 * reproduced (see `docs/security-center-module.md`).
 */
export function SecurityDashboardScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Account & Security"
        description="Manage your sessions, password, and account protection."
      />

      <AccountOverviewCard />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SECURITY_SECTIONS.map((section) => (
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
