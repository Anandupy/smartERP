import type { Metadata } from "next";

import { AuditExplorer } from "@/features/audit";
import { PROGRAM_AUDIT_MODULE, ProgramDetailsScreen } from "@/features/program";

export const metadata: Metadata = {
  title: "Program",
};

/**
 * One program in full.
 *
 * `params` is a promise in the App Router and is awaited here, in the Server
 * Component, so the client screen receives a plain id.
 */
export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ProgramDetailsScreen
      id={id}
      activityTrail={
        <AuditExplorer
          fixedFilters={{ module: PROGRAM_AUDIT_MODULE, aggregateId: id }}
          lockedFilters={["module"]}
          showAnalytics={false}
          searchPlaceholder="Search this program's activity…"
          emptyTitle="No activity recorded"
          emptyDescription="Changes to this program will appear here once program events are recorded."
        />
      }
    />
  );
}
