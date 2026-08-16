"use client";

import { LogOut } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import type { AuthSessionDto } from "@/features/auth";
import {
  DescriptionList,
  type DescriptionItem,
} from "@/shared/components/data-display";
import { BackendPendingNote } from "@/shared/components/feedback";
import { DetailDrawer } from "@/shared/components/overlay";
import { formatDateTime } from "@/utils";

import { sessionDeviceLabel } from "../../utils/session-display";

export interface SessionDetailsDrawerProps {
  session: AuthSessionDto | null;
  onOpenChange: (open: boolean) => void;
  onRevoke: (session: AuthSessionDto) => void;
}

/**
 * Session Details Drawer.
 *
 * Built entirely from the row `GET /auth/sessions` already returned — there
 * is no `GET /auth/sessions/:id` to call for more. `userAgent` is shown as
 * the raw string the backend recorded, not decomposed into a browser/OS
 * guess the response never carried.
 */
export function SessionDetailsDrawer({
  session,
  onOpenChange,
  onRevoke,
}: SessionDetailsDrawerProps) {
  if (!session) return null;

  const items: DescriptionItem[] = [
    { key: "device", label: "Device", value: sessionDeviceLabel(session.device) },
    { key: "ip", label: "IP address", value: session.ipAddress ?? "—" },
    {
      key: "signedIn",
      label: "Signed in",
      value: formatDateTime(session.createdAt),
    },
    { key: "id", label: "Session ID", value: session.id, wide: true },
    {
      key: "userAgent",
      label: "User agent",
      value: session.userAgent ?? "—",
      wide: true,
    },
  ];

  return (
    <DetailDrawer
      open={session !== null}
      onOpenChange={onOpenChange}
      title="Session details"
      description={sessionDeviceLabel(session.device)}
      footer={
        <Button
          type="button"
          variant="destructive"
          onClick={() => onRevoke(session)}
        >
          <LogOut aria-hidden="true" />
          Revoke session
        </Button>
      }
    >
      <div className="space-y-6">
        <DescriptionList items={items} columns={2} />

        <BackendPendingNote>
          location, last-active time, and a &ldquo;this device&rdquo;
          indicator are not available — `GET /auth/sessions` does not report
          them.
        </BackendPendingNote>
      </div>
    </DetailDrawer>
  );
}
