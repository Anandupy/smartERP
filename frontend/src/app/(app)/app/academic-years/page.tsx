import type { Metadata } from "next";

import {
  ACADEMIC_YEAR_AUDIT_MODULE,
  AcademicYearDashboardScreen,
} from "@/features/academic-year";
import { AuditExplorer } from "@/features/audit";

export const metadata: Metadata = {
  title: "Academic Years",
};

/**
 * Academic year overview for the active branch.
 *
 * Composes two features: the academic year module owns the layout and the
 * figures, the audit module owns the activity trail. Academic year events are
 * recorded under the `ACADEMIC` audit module, so the trail is real — pinned
 * here rather than re-implemented, and wired at the route so neither feature
 * imports the other.
 *
 * The audit event map documents `academic_year.created`, `.updated` and
 * `.deleted` and **no event for the three lifecycle transitions**, so
 * activating, selecting or locking a year will not appear here. That gap is
 * recorded in `docs/backend-gaps.md`.
 */
export default function AcademicYearsPage() {
  return (
    <AcademicYearDashboardScreen
      activityTrail={
        <AuditExplorer
          fixedFilters={{ module: ACADEMIC_YEAR_AUDIT_MODULE }}
          lockedFilters={["module"]}
          showAnalytics={false}
          searchPlaceholder="Search academic activity…"
          emptyTitle="No academic activity recorded"
          emptyDescription="Creating, updating or deleting an academic year will appear here."
        />
      }
    />
  );
}
