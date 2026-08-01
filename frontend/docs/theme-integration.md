# Future Theme Integration

Dynamic (backend-driven / per-workspace) theming is **not implemented** — the
backend theme API isn't ready. What ships is an abstraction designed so it can be
turned on later without touching component code.

## What exists today

- **`ThemeProvider`** wraps `next-themes` for light/dark/system mode.
- **Design tokens** as CSS variables in `src/styles/design-tokens.css` + shadcn
  color variables in `src/app/globals.css`, exposed through Tailwind `@theme`.
- **Token interfaces** in `src/core/theme/types.ts` (`DesignTokens`, `ColorTokens`,
  `SurfaceTokens`, `TypographyTokens`, `SpacingTokens`, `RadiusTokens`,
  `ElevationTokens`, `AnimationTokens`).
- **Inter** as the design system's typeface, loaded in `app/layout.tsx` and
  exposed as `--font-sans`.
- **`themeRegistry`** with a built-in `baseTheme`.
- **`adaptWorkspaceTheme` / `registerWorkspaceTheme`** — the workspace adapter
  seam (pure transform, not yet wired to the provider).

## Brand surfaces

Ordinary chrome uses the shadcn color slots. Full-bleed **brand moments**
(splash, auth brand panels) use a separate family so a workspace theme can
restyle the brand canvas without touching component chrome:

| Token                                 | Tailwind                               | Purpose                                  |
| ------------------------------------- | -------------------------------------- | ---------------------------------------- |
| `--canvas`                            | `bg-canvas`                            | Warm "paper" backdrop for brand surfaces |
| `--canvas-accent`                     | `bg-canvas-accent`                     | Cool accent the canvas blends into       |
| `--panel` / `--panel-border`          | `bg-panel` / `border-panel-border`     | Glassmorphic overlay fill + hairline     |
| `--elevation-ambient` / `-ambient-lg` | `shadow-ambient` / `shadow-ambient-lg` | Diffused, ink-tinted brand elevation     |

Interfaces live in `core/theme/types.ts` (`SurfaceTokens`, and the `ambient`
steps on `ElevationTokens`); values live in `styles/design-tokens.css` with a
dark-mode block. Add both together.

## How dynamic theming will plug in

1. Backend returns a workspace theme payload.
2. `adaptWorkspaceTheme(payload)` converts it to a `ThemeDefinition`;
   `registerWorkspaceTheme` adds it to the registry.
3. The provider applies the active theme by writing its tokens to CSS variables
   on the document root (light/dark blocks already exist as the pattern).
4. Because components consume **semantic tokens** (`bg-primary`, `text-muted-
foreground`, `var(--elevation-md)`) — never hard-coded values — they restyle
   automatically.

## Guidance for contributors now

- Always style against semantic tokens, never literal colors/shadows.
- Add new token _interfaces_ to `src/core/theme/types.ts` and their values to
  `src/styles/design-tokens.css` together.
- Do not build theme-customization UI yet (out of scope).
