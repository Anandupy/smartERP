"use client";

import { useState } from "react";

import { Laptop, LogOut } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { type AuthSessionDto, useSessions } from "@/features/auth";
import {
  ApiErrorState,
  EmptyState,
  LoadingState,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { sessionDeviceIcon, sortSessionsByRecency } from "../../utils/session-display";
import { RevokeSessionDialog } from "./revoke-session-dialog";
import { SessionCard } from "./session-card";
import { SessionDetailsDrawer } from "./session-details-drawer";
import { SignOutAllDialog } from "./sign-out-dialog";

/**
 * Active Sessions — `GET /auth/sessions`.
 *
 * No session is marked "current": the backend's `AuthSessionDto` carries no
 * such flag (confirmed against `auth.controller.ts`/`auth.service.ts`), so
 * every card is presented the same way rather than guessing from the browser.
 */
export function ActiveSessionsScreen() {
  const { data, isPending, error, refetch } = useSessions();
  const [selected, setSelected] = useState<AuthSessionDto | null>(null);
  const [revoking, setRevoking] = useState<AuthSessionDto | null>(null);
  const [signOutAllOpen, setSignOutAllOpen] = useState(false);

  const sessions = sortSessionsByRecency(data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active Sessions"
        description="Every device currently signed in to your account."
        actions={
          sessions.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setSignOutAllOpen(true)}
            >
              <LogOut aria-hidden="true" />
              Sign out of all devices
            </Button>
          ) : undefined
        }
      />

      {isPending ? <LoadingState message="Loading sessions…" /> : null}

      {error ? <ApiErrorState error={error} onRetry={() => refetch()} /> : null}

      {!isPending && !error && sessions.length === 0 ? (
        <EmptyState
          icon={Laptop}
          title="No active sessions"
          description="You're not signed in anywhere right now."
        />
      ) : null}

      {!isPending && !error && sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              icon={sessionDeviceIcon(session.device)}
              onViewDetails={setSelected}
              onRevoke={setRevoking}
            />
          ))}
        </div>
      ) : null}

      <SessionDetailsDrawer
        session={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onRevoke={(session) => {
          setSelected(null);
          setRevoking(session);
        }}
      />

      <RevokeSessionDialog
        session={revoking}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
      />

      <SignOutAllDialog open={signOutAllOpen} onOpenChange={setSignOutAllOpen} />
    </div>
  );
}
