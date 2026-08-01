/**
 * Static copy and timings for the authentication screens. Centralized here so
 * the screens stay layout-only and the strings are trivial to localize later.
 */

/** Status lines shown by the splash boot sequence, in order. */
export const SPLASH_BOOT_STEPS = [
  "Establishing secure connection…",
  "Verifying workspace configuration…",
  "Loading workspace modules…",
  "Ready.",
] as const;

/** How long each boot step is displayed before advancing. */
export const SPLASH_STEP_DURATION_MS = 1_200;

/** Compliance signals shown on the welcome brand panel. */
export const AUTH_TRUST_BADGES = [
  { id: "soc2", label: "SOC 2 Certified" },
  { id: "iso27001", label: "ISO 27001" },
] as const;

/**
 * How long before a one-time code can be requested again. Mirrors the throttle
 * the backend applies to `POST /auth/resend-otp`; the UI only reflects it.
 */
export const RESEND_COOLDOWN_SECONDS = 120;

/**
 * How long an account stays locked after too many failed attempts. Display
 * only — the backend owns the real lockout window.
 */
export const ACCOUNT_LOCKOUT_SECONDS = 900;

/** Guidance shown on the account-locked screen. */
export const ACCOUNT_LOCKED_TIPS = [
  "Make sure you are using your institutional credentials.",
  "Check that caps lock is off before trying again.",
  "If you have forgotten your password, reset it instead of retrying.",
] as const;

/** Support mailbox surfaced on auth screens. */
export const SUPPORT_EMAIL = "support@campusflow.example";

/**
 * Enterprise identity providers offered on the login screen. They are rendered
 * disabled until the backend federation endpoints ship — the UI advertises the
 * capability without pretending it works.
 */
export const LOGIN_SSO_PROVIDERS = [
  { id: "azure-ad", label: "Azure AD" },
  { id: "google-workspace", label: "Google WS" },
] as const;
