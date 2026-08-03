import type { Metadata } from "next";

import { AuditExplorer } from "@/features/audit";
import { BRANCH_AUDIT_MODULE } from "@/features/branch";
import { PageHeader } from "@/shared";

export const metadata: Metadata = {
  title: "Branch Settings History",
};

/**
 * A branch's change history.
 *
 * The one settings section with a real contract behind it. Configuration
 * history *is* the audit trail, so this page is the audit module's explorer
 * pinned to this branch's record — `module` narrows to the audit module that
 * records branch events, and `aggregateId` narrows to this branch, both
 * documented filter parameters resolved on the server.
 *
 * Composed at the route, so neither feature imports the other. Analytics are
 * hidden: distribution tiles answer questions about platform-wide activity, not
 * about one campus's configuration changes.
 */
export default async function BranchSettingsHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="History &amp; Audit"
        description="Every recorded change to this branch, and who made it."
      />

      <AuditExplorer
        fixedFilters={{ module: BRANCH_AUDIT_MODULE, aggregateId: id }}
        lockedFilters={["module"]}
        showAnalytics={false}
        searchPlaceholder="Search this branch's history…"
        emptyTitle="No changes recorded"
        emptyDescription="Updates to this branch will appear here once they are made."
      />
    </div>
  );
}
