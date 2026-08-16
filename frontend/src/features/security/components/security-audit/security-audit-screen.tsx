"use client";

import { ScrollText } from "@/assets/icons";
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PendingScreen } from "../pending-screen";

/**
 * Security Activity Audit.
 *
 * Not the generic Audit Logs module (`/audit-logs`), which records domain
 * mutations via an event listener — `auth.service.ts` never emits to it, so
 * it contains no login, logout or session-revoke events and cannot stand in
 * for a security-activity feed without misrepresenting what it holds.
 */
export function SecurityAuditScreen() {
  return (
    <PendingScreen
      icon={ScrollText}
      title="Security Activity Audit"
      description="Security-relevant events on this account: sign-ins, password changes, session revocations."
      filters={
        <>
          <Select disabled>
            <SelectTrigger className="w-40" aria-label="Filter by category">
              <SelectValue placeholder="Any category" />
            </SelectTrigger>
          </Select>
          <Select disabled>
            <SelectTrigger className="w-40" aria-label="Filter by severity">
              <SelectValue placeholder="Any severity" />
            </SelectTrigger>
          </Select>
          <Select disabled>
            <SelectTrigger className="w-40" aria-label="Filter by date range">
              <SelectValue placeholder="Any date" />
            </SelectTrigger>
          </Select>
        </>
      }
      emptyTitle="No security activity available"
      emptyDescription="A record of security-relevant events isn't available for this account yet."
      missing="the auth API emits no events to the generic audit-log system
      (`/audit-logs`), which itself only records domain data mutations — so
      this account has no security-activity feed distinct from Active
      Sessions."
    />
  );
}
