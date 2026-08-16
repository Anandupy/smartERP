"use client";

import { toast } from "sonner";

import { type AuthSessionDto, useRevokeSession } from "@/features/auth";
import { getErrorMessage } from "@/lib";
import { ConfirmDialog } from "@/shared/components/overlay";

import { sessionDeviceLabel } from "../../utils/session-display";

export interface RevokeSessionDialogProps {
  /** The session awaiting confirmation, or `null` when nothing is pending. */
  session: AuthSessionDto | null;
  onOpenChange: (open: boolean) => void;
  /** Fires after a successful revoke, so a caller can also close a drawer. */
  onRevoked?: () => void;
}

/**
 * Confirmation before revoking one session — `DELETE /auth/sessions/:id`.
 */
export function RevokeSessionDialog({
  session,
  onOpenChange,
  onRevoked,
}: RevokeSessionDialogProps) {
  const revokeSession = useRevokeSession();

  return (
    <ConfirmDialog
      open={session !== null}
      onOpenChange={onOpenChange}
      destructive
      title="Revoke this session?"
      description={
        session
          ? `The ${sessionDeviceLabel(session.device)} session will be signed out immediately and will need to sign in again.`
          : ""
      }
      confirmLabel="Revoke session"
      isPending={revokeSession.isPending}
      onConfirm={() => {
        if (!session) return;
        revokeSession.mutate(session.id, {
          onSuccess: () => {
            toast.success("Session revoked");
            onOpenChange(false);
            onRevoked?.();
          },
          onError: (error) => {
            toast.error(getErrorMessage(error));
          },
        });
      }}
    />
  );
}
