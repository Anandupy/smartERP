import type { Metadata } from "next";

import { AuditExplorer } from "@/features/audit";
import {
  ORGANIZATION_AUDIT_MODULE,
  OrganizationDetailsScreen,
} from "@/features/organization";

export const metadata: Metadata = {
  title: "Organization",
};

/**
 * One organization in full.
 *
 * `params` is a promise in the App Router and is awaited here, in the Server
 * Component, so the client screen receives a plain id.
 *
 * The activity trail is the audit explorer pinned to this organization's
 * record: `aggregateId` is a documented audit filter, so the trail is scoped
 * to this tenant on the server rather than filtered in the browser.
 */
export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <OrganizationDetailsScreen
      id={id}
      activityTrail={
        <AuditExplorer
          fixedFilters={{
            module: ORGANIZATION_AUDIT_MODULE,
            aggregateId: id,
          }}
          lockedFilters={["module"]}
          showAnalytics={false}
          searchPlaceholder="Search this organization's activity…"
          emptyTitle="No activity recorded"
          emptyDescription="Changes to this organization will appear here."
        />
      }
    />
  );
}
