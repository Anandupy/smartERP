import type { Metadata } from "next";

import { AuditExplorer } from "@/features/audit";
import { BRANCH_AUDIT_MODULE, BranchDetailsScreen } from "@/features/branch";

export const metadata: Metadata = {
  title: "Branch",
};

/**
 * One branch in full.
 *
 * `params` is a promise in the App Router and is awaited here, in the Server
 * Component, so the client screen receives a plain id.
 *
 * The audit trail is scoped to this record: `aggregateId` is a documented audit
 * filter, so the timeline is narrowed on the server rather than in the browser.
 */
export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <BranchDetailsScreen
      id={id}
      activityTrail={
        <AuditExplorer
          fixedFilters={{ module: BRANCH_AUDIT_MODULE, aggregateId: id }}
          lockedFilters={["module"]}
          showAnalytics={false}
          searchPlaceholder="Search this branch's activity…"
          emptyTitle="No activity recorded"
          emptyDescription="Changes to this branch will appear here."
        />
      }
    />
  );
}
