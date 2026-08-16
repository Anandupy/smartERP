"use client";

import type { LucideIcon } from "@/assets/icons";
import { LogOut } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AuthSessionDto } from "@/features/auth";
import { formatDateTime } from "@/utils";

import { sessionDeviceLabel } from "../../utils/session-display";

export interface SessionCardProps {
  session: AuthSessionDto;
  /** Resolved by the caller via `sessionDeviceIcon` — components are never
   * created inside a render body, only referenced. */
  icon: LucideIcon;
  onViewDetails: (session: AuthSessionDto) => void;
  onRevoke: (session: AuthSessionDto) => void;
  isRevoking?: boolean;
}

/**
 * One active session, as `GET /auth/sessions` returned it.
 *
 * Only `device`, `ipAddress`, `userAgent` and `createdAt` are real — the
 * backend marks no session as "this device" (see `use-sessions.ts` in the
 * auth feature), so no card ever claims to be the current one.
 */
export function SessionCard({
  session,
  icon: Icon,
  onViewDetails,
  onRevoke,
  isRevoking = false,
}: SessionCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span
          aria-hidden="true"
          className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg"
        >
          <Icon className="size-5" />
        </span>

        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-foreground text-sm font-medium">
            {sessionDeviceLabel(session.device)}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {session.ipAddress ?? "IP address unavailable"} · Signed in{" "}
            {formatDateTime(session.createdAt)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(session)}
          >
            Details
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRevoking}
            onClick={() => onRevoke(session)}
          >
            <LogOut aria-hidden="true" />
            Revoke
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
