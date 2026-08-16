import {
  Ban,
  Clock,
  History,
  KeyRound,
  Laptop,
  ScrollText,
  Shield,
  SlidersHorizontal,
  type LucideIcon,
} from "@/assets/icons";
import { ROUTES } from "@/constants";

export interface SecuritySection {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /**
   * The section reads or writes data the backend has not documented. Its
   * screen ships, laid out and wired to whatever real query exists, but the
   * write stays disabled. See `docs/security-center-module.md`.
   */
  backendPending?: boolean;
}

/**
 * The Account & Security Center sections, declared once.
 *
 * Drives both the dashboard's quick-actions grid and the section
 * sub-navigation, so the two can never disagree about what exists — the same
 * arrangement `SETTINGS_SECTIONS` uses for System Settings.
 */
export const SECURITY_SECTIONS: readonly SecuritySection[] = Object.freeze([
  {
    id: "sessions",
    label: "Active Sessions",
    description:
      "Every device currently signed in, with the ability to sign one out.",
    href: ROUTES.app.security.sessions,
    icon: Laptop,
  },
  {
    id: "login-history",
    label: "Login History",
    description: "Past sign-in attempts for this account.",
    href: ROUTES.app.security.loginHistory,
    icon: History,
    backendPending: true,
  },
  {
    id: "change-password",
    label: "Change Password",
    description: "Update the password used to sign in.",
    href: ROUTES.app.security.changePassword,
    icon: KeyRound,
    backendPending: true,
  },
  {
    id: "two-factor",
    label: "Two-Factor Authentication",
    description: "An extra verification step beyond your password.",
    href: ROUTES.app.security.twoFactor,
    icon: Shield,
    backendPending: true,
  },
  {
    id: "preferences",
    label: "Security Preferences",
    description: "Notification and session-behavior preferences.",
    href: ROUTES.app.security.preferences,
    icon: SlidersHorizontal,
    backendPending: true,
  },
  {
    id: "audit",
    label: "Security Activity Audit",
    description: "A record of security-relevant events on this account.",
    href: ROUTES.app.security.audit,
    icon: ScrollText,
    backendPending: true,
  },
  {
    id: "trusted-devices",
    label: "Trusted Devices",
    description: "Devices you've marked as recognized.",
    href: ROUTES.app.security.trustedDevices,
    icon: Clock,
    backendPending: true,
  },
  {
    id: "danger-zone",
    label: "Danger Zone",
    description: "Sign out of this device, or every device at once.",
    href: ROUTES.app.security.dangerZone,
    icon: Ban,
  },
]);
