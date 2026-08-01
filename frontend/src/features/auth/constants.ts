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
 * Enterprise identity providers offered on the login screen. They are rendered
 * disabled until the backend federation endpoints ship — the UI advertises the
 * capability without pretending it works.
 */
export const LOGIN_SSO_PROVIDERS = [
  { id: "azure-ad", label: "Azure AD" },
  { id: "google-workspace", label: "Google WS" },
] as const;
