"use client";

import { History } from "@/assets/icons";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PendingScreen } from "../pending-screen";

/**
 * Login History — distinct from Active Sessions (currently-live devices) and
 * from Security Activity Audit (the generic audit trail). No endpoint
 * documents historical sign-in attempts for this account, so nothing is
 * derived from sessions or the audit log to fill the gap.
 */
export function LoginHistoryScreen() {
  return (
    <PendingScreen
      icon={History}
      title="Login History"
      description="Past sign-in attempts for this account."
      filters={
        <>
          <Input disabled placeholder="Search by IP or device…" className="w-56" />
          <Select disabled>
            <SelectTrigger className="w-40" aria-label="Filter by status">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
          </Select>
          <Select disabled>
            <SelectTrigger className="w-40" aria-label="Filter by date range">
              <SelectValue placeholder="Any date" />
            </SelectTrigger>
          </Select>
        </>
      }
      emptyTitle="Login history is not available"
      emptyDescription="This account's past sign-in attempts aren't shown here yet."
      missing="the auth API documents active sessions (`GET /auth/sessions`) but no separate
      login-history endpoint, so past sign-in attempts — including failed
      ones — cannot be listed here."
    />
  );
}
