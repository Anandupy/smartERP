import type { Metadata } from "next";

import {
  ACADEMIC_YEAR_AUDIT_MODULE,
  AcademicYearDetailsScreen,
} from "@/features/academic-year";
import { AuditExplorer } from "@/features/audit";

export const metadata: Metadata = {
  title: "Academic Year",
};

/**
 * One academic year in full.
 *
 * `params` is a promise in the App Router and is awaited here, in the Server
 * Component, so the client screen receives a plain id.
 *
 * The audit trail is scoped to this record: `aggregateId` is a documented audit
 * filter, so the timeline is narrowed on the server rather than in the browser.
 */
export default async function AcademicYearDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AcademicYearDetailsScreen
      id={id}
      activityTrail={
        <AuditExplorer
          fixedFilters={{ module: ACADEMIC_YEAR_AUDIT_MODULE, aggregateId: id }}
          lockedFilters={["module"]}
          showAnalytics={false}
          searchPlaceholder="Search this year's activity…"
          emptyTitle="No activity recorded"
          emptyDescription="Changes to this academic year will appear here."
        />
      }
    />
  );
}
