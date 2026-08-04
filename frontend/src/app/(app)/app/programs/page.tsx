import type { Metadata } from "next";

import { AuditExplorer } from "@/features/audit";
import {
  PROGRAM_AUDIT_MODULE,
  ProgramDashboardScreen,
} from "@/features/program";

export const metadata: Metadata = {
  title: "Programs",
};

/**
 * Program overview for the active branch.
 *
 * Composes two features: the program module owns the layout and the figures,
 * the audit module owns the activity trail — wired at the route so neither
 * feature imports the other.
 *
 * The audit event map documents **no `program.*` event**, so the trail pinned
 * here is the `ACADEMIC` module's and may contain nothing from this one. The
 * screen says so rather than letting an empty trail read as "no activity".
 */
export default function ProgramsPage() {
  return (
    <ProgramDashboardScreen
      activityTrail={
        <AuditExplorer
          fixedFilters={{ module: PROGRAM_AUDIT_MODULE }}
          lockedFilters={["module"]}
          showAnalytics={false}
          searchPlaceholder="Search academic activity…"
          emptyTitle="No academic activity recorded"
          emptyDescription="Academic events appear here as they are recorded."
        />
      }
    />
  );
}
