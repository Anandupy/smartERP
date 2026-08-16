import { Info } from "@/assets/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PendingSettingsGroup } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

/**
 * Two-Factor Authentication.
 *
 * The `User` model carries `isTwoFactorEnabled`/`twoFactorSecret` columns,
 * but the schema itself documents them as unimplemented placeholders — never
 * written by any code path — and neither field is selected into any API
 * response the client can read. So this screen never claims 2FA is on or
 * off; it says the status is unavailable, and every management control is
 * disabled rather than persisting a toggle the backend cannot honor.
 *
 * `send-otp`/`verify-otp` with `purpose: "MFA"` exist, but that is
 * login-time verification, not account-level enrollment — enabling it here
 * would misrepresent a login mechanic as "you have turned on 2FA."
 */
export function TwoFactorScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Two-Factor Authentication"
        description="An extra verification step beyond your password."
      />

      <Alert>
        <Info aria-hidden="true" />
        <AlertTitle>Status unavailable</AlertTitle>
        <AlertDescription>
          Whether two-factor authentication is on or off for this account
          isn&apos;t reported by the API, so it can&apos;t be shown here. A
          one-time code can already be requested at sign-in for accounts the
          backend requires it for — that login step is separate from the
          enrollment below.
        </AlertDescription>
      </Alert>

      <PendingSettingsGroup
        title="Authenticator app"
        description="Generate codes from an app like Google Authenticator instead of receiving them by email or SMS."
        fields={[
          { label: "Enable two-factor authentication", kind: "switch" },
          {
            label: "Verification method",
            kind: "select",
            placeholder: "Not configurable yet",
            wide: true,
          },
        ]}
        missing="there is no enrollment endpoint — no way to generate a QR code or
        authenticator secret, verify it, issue backup codes, or turn 2FA on
        or off for this account."
      />
    </div>
  );
}
