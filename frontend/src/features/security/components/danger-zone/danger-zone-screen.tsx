"use client";

import { useState } from "react";

import { LogOut, Power, Trash2, UserX } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SignOutButton } from "@/features/auth";
import { BackendPendingBadge } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { SignOutAllDialog } from "../sessions/sign-out-dialog";

interface DangerActionProps {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
  action: React.ReactNode;
}

function DangerAction({ icon: Icon, title, description, action }: DangerActionProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span
          aria-hidden="true"
          className="bg-destructive/10 text-destructive flex size-10 shrink-0 items-center justify-center rounded-lg"
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-foreground text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Security Hub — Danger Zone.
 *
 * Only two of the four actions the Stitch design shows have a backend
 * behind them: sign out this device and sign out every device, both via
 * `POST /auth/logout` (see `docs/security-center-module.md` for why
 * "everywhere" also signs out this tab). Deactivating or deleting the
 * account has no documented endpoint, so both stay disabled rather than
 * simulating an irreversible action the backend cannot perform.
 */
export function DangerZoneScreen() {
  const [signOutAllOpen, setSignOutAllOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Danger Zone"
        description="Irreversible actions that affect your account or its sessions."
      />

      <div className="space-y-3">
        <DangerAction
          icon={Power}
          title="Sign out this device"
          description="End the session in this browser. You'll need to sign in again."
          action={<SignOutButton variant="outline" label="Sign out" />}
        />

        <DangerAction
          icon={LogOut}
          title="Sign out of every device"
          description="Revoke every session for this account, including this one, immediately."
          action={
            <Button
              type="button"
              variant="destructive"
              onClick={() => setSignOutAllOpen(true)}
            >
              Sign out everywhere
            </Button>
          }
        />

        <DangerAction
          icon={UserX}
          title="Deactivate account"
          description="Temporarily disable sign-in until an administrator reactivates it."
          action={<BackendPendingBadge />}
        />

        <DangerAction
          icon={Trash2}
          title="Delete account"
          description="Permanently remove this account and its data. This cannot be undone."
          action={<BackendPendingBadge />}
        />
      </div>

      <SignOutAllDialog open={signOutAllOpen} onOpenChange={setSignOutAllOpen} />
    </div>
  );
}
