import type { Metadata } from "next";

import { AuditExplorer } from "@/features/audit";
import { PageHeader } from "@/shared";

export const metadata: Metadata = {
  title: "Settings History & Audit",
};

/**
 * Configuration history.
 *
 * Composed rather than implemented: configuration history *is* the audit trail,
 * so this page is the audit module's explorer pinned to the `SYSTEM` module —
 * the one the backend records `system_settings.updated` under. Joining the two
 * features here is what keeps System Settings from importing Audit.
 *
 * Analytics are hidden: distribution tiles and a daily chart answer questions
 * about platform-wide activity, not about a handful of settings changes.
 */
export default function SettingsHistoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="History &amp; Audit"
        description="Every change made to this installation's configuration, and who made it."
      />

      <AuditExplorer
        fixedFilters={{ module: "SYSTEM" }}
        lockedFilters={["module"]}
        showAnalytics={false}
        searchPlaceholder="Search configuration changes…"
        emptyTitle="No configuration changes recorded"
        emptyDescription="Changes to system settings will appear here once they are made."
      />
    </div>
  );
}
