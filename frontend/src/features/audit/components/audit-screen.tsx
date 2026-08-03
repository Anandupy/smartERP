"use client";

import { PageHeader } from "@/shared/components/layout";

import { AuditExplorer } from "./audit-explorer";

/**
 * Audit Logs.
 *
 * The full trail, unpinned. What a given user can actually see is decided by
 * the backend, which scopes every query to their role's boundary — a branch
 * admin's "all records" is their branch's records. The frontend deliberately
 * does not pre-filter to match; doing so would let a client-side mistake look
 * like an authorization boundary.
 */
export function AuditScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Every recorded action across the platform — what changed, who changed it, and when."
      />

      <AuditExplorer />
    </div>
  );
}
