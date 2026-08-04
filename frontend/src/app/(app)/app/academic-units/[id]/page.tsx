import type { Metadata } from "next";

import { ACADEMIC_UNIT_AUDIT_MODULE } from "@/features/academic-unit";
import { AuditExplorer } from "@/features/audit";

import { AcademicUnitDetailsRoute } from "../program-composition";

export const metadata: Metadata = {
  title: "Academic Unit",
};

/**
 * One academic unit in full.
 *
 * `params` is a promise in the App Router and is awaited here, in the Server
 * Component, so the client screen receives a plain id.
 *
 * The audit trail is scoped to this record: `aggregateId` is a documented audit
 * filter, so the timeline is narrowed on the server rather than in the browser.
 */
export default async function AcademicUnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AcademicUnitDetailsRoute
      id={id}
      activityTrail={
        <AuditExplorer
          fixedFilters={{ module: ACADEMIC_UNIT_AUDIT_MODULE, aggregateId: id }}
          lockedFilters={["module"]}
          showAnalytics={false}
          searchPlaceholder="Search this unit's activity…"
          emptyTitle="No activity recorded"
          emptyDescription="Changes to this academic unit will appear here. Moves and status changes are not recorded as events."
        />
      }
    />
  );
}
