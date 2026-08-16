import { PendingSettingsGroup } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

/**
 * Security Preferences — distinct from Communication Preferences, which
 * configures message channels, not account security behavior. No backend
 * endpoint documents a security-preferences record for this account.
 */
export function SecurityPreferencesScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Preferences"
        description="Notification and session-behavior preferences for this account."
      />

      <PendingSettingsGroup
        title="Alerts"
        description="Be notified about activity on this account."
        fields={[
          { label: "New sign-in notifications", kind: "switch" },
          { label: "Suspicious sign-in alerts", kind: "switch" },
          { label: "Security email alerts", kind: "switch" },
        ]}
        missing="there is no security-preferences endpoint, so none of these can be
        read or saved for this account."
      />

      <PendingSettingsGroup
        title="Sessions"
        description="How long a session stays signed in, and whether new devices need extra verification."
        fields={[
          {
            label: "Session timeout",
            kind: "select",
            placeholder: "Not configurable yet",
          },
          { label: "Verify new devices at sign-in", kind: "switch" },
        ]}
        missing="session lifetime is fixed by the backend's refresh-token policy and
        is not exposed as a per-account setting."
      />
    </div>
  );
}
