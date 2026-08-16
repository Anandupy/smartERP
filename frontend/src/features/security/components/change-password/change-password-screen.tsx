import { PendingSettingsGroup } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

/**
 * Change Password.
 *
 * The only password-change endpoint the backend documents is
 * `POST /auth/reset-password`, which requires the single-use token from a
 * `forgot-password` email — that is account **recovery**, not an
 * authenticated user changing a password they already know, and using it
 * here would mean fabricating a token. No `PATCH`/`POST /auth/change-password`
 * exists, so the form ships and the write stays disabled.
 */
export function ChangePasswordScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Change Password"
        description="Update the password used to sign in."
      />

      <PendingSettingsGroup
        title="Update password"
        description="Confirm your current password, then choose a new one."
        fields={[
          { label: "Current password", placeholder: "••••••••" },
          { label: "New password", placeholder: "••••••••" },
          { label: "Confirm new password", placeholder: "••••••••" },
        ]}
        missing="there is no authenticated change-password endpoint. `POST
        /auth/reset-password` exists but is the token-based recovery flow
        triggered by `forgot-password`, not this form."
      />
    </div>
  );
}
