/**
 * Canonical responsive breakpoints for the platform. These mirror the target
 * device widths the UI must support and are the single source of truth for
 * media-query hooks. Values are min-widths in pixels (mobile-first).
 */
export const BREAKPOINTS = Object.freeze({
  xs: 320,
  sm: 375,
  md: 425,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
  wide: 1440,
  xwide: 1600,
  ultra: 1920,
});

export type Breakpoint = keyof typeof BREAKPOINTS;

/** Ordered from smallest to largest for range logic. */
export const BREAKPOINT_ORDER: readonly Breakpoint[] = Object.freeze([
  "xs",
  "sm",
  "md",
  "tablet",
  "laptop",
  "desktop",
  "wide",
  "xwide",
  "ultra",
]);

export const mediaQuery = {
  up: (bp: Breakpoint) => `(min-width: ${BREAKPOINTS[bp]}px)`,
  down: (bp: Breakpoint) => `(max-width: ${BREAKPOINTS[bp] - 0.02}px)`,
} as const;
