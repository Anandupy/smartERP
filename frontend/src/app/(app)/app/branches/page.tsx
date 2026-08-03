import type { Metadata } from "next";

import { AuditExplorer } from "@/features/audit";
import { BRANCH_AUDIT_MODULE, BranchDashboardScreen } from "@/features/branch";

export const metadata: Metadata = {
  title: "Branches",
};

/**
 * Branch management overview.
 *
 * Composes two features: the branch module owns the layout and the figures, the
 * audit module owns the activity trail. Branch events are recorded under the
 * `ORGANIZATION` audit module, so the trail is real — pinned here rather than
 * re-implemented, and wired at the route so neither feature imports the other.
 */
export default function BranchesPage() {
  return (
    <BranchDashboardScreen
      activityTrail={
        <AuditExplorer
          fixedFilters={{ module: BRANCH_AUDIT_MODULE }}
          lockedFilters={["module"]}
          showAnalytics={false}
          searchPlaceholder="Search branch activity…"
          emptyTitle="No branch activity recorded"
          emptyDescription="Creating, updating or deleting a branch will appear here."
        />
      }
    />
  );
}
