"use client";

import { useLogout } from "@/features/auth";
import { ConfirmDialog } from "@/shared/components/overlay";

export interface SignOutAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmation before `POST /auth/logout?allDevices=true` — shared by the
 * Active Sessions bulk action and the Danger Zone, since both offer the same
 * operation.
 *
 * The backend's `allDevices` revocation has no per-session exclusion (see
 * `docs/security-center-module.md`), so this signs out the current device
 * too. `useLogout` clears local state and redirects once the request
 * settles, so the current tab never ends up "signed out server-side but
 * still rendering the app" — which is why this is the action wired here
 * rather than `DELETE /auth/sessions`.
 */
export function SignOutAllDialog({ open, onOpenChange }: SignOutAllDialogProps) {
  const logout = useLogout();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      destructive
      title="Sign out of every device?"
      description="Every device signed in to this account — including this one — will be signed out immediately and must sign in again."
      confirmLabel="Sign out everywhere"
      isPending={logout.isPending}
      onConfirm={() => logout.mutate(true)}
    />
  );
}
