/**
 * Design-token contracts.
 *
 * These interfaces describe the *vocabulary* of the design system. Concrete
 * values live in CSS custom properties (see `styles/`) and in theme definitions
 * registered with the theme registry. Dynamic (backend-driven) theming is NOT
 * implemented — these types are the seam that makes it possible later.
 */

export type ColorScale = {
  DEFAULT: string;
  foreground: string;
};

/** Semantic color slots. Values are CSS color strings (e.g. oklch(...)). */
export interface ColorTokens {
  background: string;
  foreground: string;
  card: ColorScale;
  popover: ColorScale;
  primary: ColorScale;
  secondary: ColorScale;
  muted: ColorScale;
  accent: ColorScale;
  destructive: string;
  border: string;
  input: string;
  ring: string;
}

/**
 * Branded full-bleed surfaces used by brand moments (splash, auth visual
 * panel) rather than by ordinary chrome. Kept separate from `ColorTokens` so a
 * workspace theme can restyle the brand canvas without touching component
 * chrome. Values live in `styles/design-tokens.css`.
 */
export interface SurfaceTokens {
  /** Warm "paper" backdrop for full-bleed brand surfaces. */
  canvas: string;
  /** Cool accent the canvas blends into for mesh gradients. */
  canvasAccent: string;
  /** Glassmorphic overlay fill. */
  panel: string;
  /** Glassmorphic overlay hairline. */
  panelBorder: string;
  /** Full-page scrim behind a focused overlay (e.g. the guide walkthrough). */
  overlayScrim: string;
}

export interface TypographyScaleToken {
  fontSize: string;
  lineHeight: string;
  fontWeight?: number;
  letterSpacing?: string;
}

export interface TypographyTokens {
  fontFamily: {
    sans: string;
    mono: string;
    heading: string;
  };
  scale: {
    xs: TypographyScaleToken;
    sm: TypographyScaleToken;
    base: TypographyScaleToken;
    lg: TypographyScaleToken;
    xl: TypographyScaleToken;
    "2xl": TypographyScaleToken;
    "3xl": TypographyScaleToken;
    "4xl": TypographyScaleToken;
  };
}

/** Spacing scale in rem-based CSS lengths, keyed by step. */
export type SpacingTokens = Record<
  "0" | "1" | "2" | "3" | "4" | "5" | "6" | "8" | "10" | "12" | "16",
  string
>;

export type RadiusTokens = Record<
  "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full",
  string
>;

/**
 * `ambient` / `ambientLg` are the design system's diffused, ink-tinted shadows
 * used by branded surfaces; the numbered steps remain the neutral UI ramp.
 */
export type ElevationTokens = Record<
  "none" | "sm" | "md" | "lg" | "xl" | "ambient" | "ambientLg",
  string
>;

export interface AnimationTokens {
  duration: Record<"fast" | "normal" | "slow", string>;
  easing: Record<
    "standard" | "emphasized" | "decelerate" | "accelerate",
    string
  >;
}

export interface DesignTokens {
  colors: ColorTokens;
  surfaces: SurfaceTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  radius: RadiusTokens;
  elevation: ElevationTokens;
  animation: AnimationTokens;
}

export type ColorMode = "light" | "dark";

/**
 * A registrable theme. `cssClass` is the class applied to the document root so
 * the corresponding CSS variable block activates. `tokens` mirrors those
 * variables in JS for consumers that need token values programmatically.
 */
export interface ThemeDefinition {
  id: string;
  name: string;
  /** Root class that activates this theme's CSS variables (e.g. "dark"). */
  cssClass?: string;
  supportedModes: ColorMode[];
  tokens: Partial<DesignTokens>;
}
