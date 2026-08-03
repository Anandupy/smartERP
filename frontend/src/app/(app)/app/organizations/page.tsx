import type { Metadata } from "next";

import { AuditExplorer } from "@/features/audit";
import {
  ORGANIZATION_AUDIT_MODULE,
  OrganizationDashboardScreen,
} from "@/features/organization";

export const metadata: Metadata = {
  title: "Organizations",
};

/**
 * Organization management overview.
 *
 * Composes two features: the organization module owns the layout and the
 * figures, the audit module owns the activity trail. The audit contract
 * records organization events under the `ORGANIZATION` module, so the trail is
 * the real one — pinned here rather than re-implemented, and wired at the
 * route so neither feature imports the other.
 */
export default function OrganizationsPage() {
  return (
    <OrganizationDashboardScreen
      activityTrail={
        <AuditExplorer
          fixedFilters={{ module: ORGANIZATION_AUDIT_MODULE }}
          lockedFilters={["module"]}
          showAnalytics={false}
          searchPlaceholder="Search organization activity…"
          emptyTitle="No organization activity recorded"
          emptyDescription="Creating, updating or deactivating an organization will appear here."
        />
      }
    />
  );
}
