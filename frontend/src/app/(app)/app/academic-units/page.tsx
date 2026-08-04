import type { Metadata } from "next";

import {
  ACADEMIC_UNIT_AUDIT_MODULE,
  AcademicUnitDashboardScreen,
} from "@/features/academic-unit";
import { AuditExplorer } from "@/features/audit";

export const metadata: Metadata = {
  title: "Academic Units",
};

/**
 * Academic unit overview for the active branch and academic year.
 *
 * Academic unit events are recorded under the `ACADEMIC` audit module, so the
 * trail is real — pinned here rather than re-implemented, and wired at the
 * route so neither feature imports the other.
 *
 * The event map documents `academic_unit.created`, `.updated` and `.deleted`
 * and **no event for the move or status endpoints**, which the screen states.
 */
export default function AcademicUnitsPage() {
  return (
    <AcademicUnitDashboardScreen
      activityTrail={
        <AuditExplorer
          fixedFilters={{ module: ACADEMIC_UNIT_AUDIT_MODULE }}
          lockedFilters={["module"]}
          showAnalytics={false}
          searchPlaceholder="Search academic activity…"
          emptyTitle="No academic activity recorded"
          emptyDescription="Creating, updating or deleting an academic unit will appear here."
        />
      }
    />
  );
}
