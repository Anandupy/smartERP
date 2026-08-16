/**
 * Public surface of the Account & Security Center feature.
 *
 * Session management (`GET/DELETE /auth/sessions`, `POST /auth/logout`) is
 * not re-implemented here — every screen below imports those hooks and types
 * from `@/features/auth`'s public surface, the feature that already owns
 * `core/auth` integration. This module adds the screens, not a second
 * session layer. See `docs/security-center-module.md` for the full contract.
 */

export { SECURITY_SECTIONS, type SecuritySection } from "./constants";

export { SecurityNav } from "./components/security-nav";

export { SecurityDashboardScreen } from "./components/dashboard/security-dashboard-screen";
export { ActiveSessionsScreen } from "./components/sessions/active-sessions-screen";
export { DangerZoneScreen } from "./components/danger-zone/danger-zone-screen";
export { LoginHistoryScreen } from "./components/login-history/login-history-screen";
export { ChangePasswordScreen } from "./components/change-password/change-password-screen";
export { TwoFactorScreen } from "./components/two-factor/two-factor-screen";
export { SecurityPreferencesScreen } from "./components/security-preferences/security-preferences-screen";
export { SecurityAuditScreen } from "./components/security-audit/security-audit-screen";
export { TrustedDevicesScreen } from "./components/trusted-devices/trusted-devices-screen";

export {
  sessionDeviceIcon,
  sessionDeviceLabel,
  sortSessionsByRecency,
} from "./utils/session-display";
