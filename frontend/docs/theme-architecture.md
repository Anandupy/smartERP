# EduOS — Theme Engine Architecture

## Design Philosophy

The theme system is built on CSS custom properties. This means:
- Theme changes are instant (no re-render)
- Organizations can have unique branding
- Dark mode works without style duplication
- Themes are injectable from any level (global, org, branch)

---

## CSS Variable Layers

```
Layer 1: Default design tokens (globals.css)
Layer 2: Dark mode overrides (.dark class)
Layer 3: Organization theme (injected via ThemeStudioProvider)
Layer 4: Branch theme (future — overrides org theme)
```

---

## Theme Dimensions

### Colors
- `--color-primary` + `--color-primary-foreground`
- `--color-secondary` + `--color-secondary-foreground`
- `--color-accent` + `--color-accent-foreground`
- `--color-success`, `--color-warning`, `--color-error`
- `--color-background`, `--color-surface`, `--color-surface-2`
- `--color-border`, `--color-border-strong`

### Typography
- `--font-display` — headings (overridable by Theme Studio)
- `--font-body` — body text
- `--font-mono` — code, IDs

### Layout
- `--sidebar-width` (240px) / `--sidebar-collapsed-width` (56px)
- `--topbar-height` (56px)
- `--contextbar-height` (40px)

### Data Density
Three density presets modify table row height, card padding, and font size:

| Mode | Row Height | Card Padding | Font Size |
|---|---|---|---|
| `erp-dense` | 40px | 12px | 13px |
| `compact` | 44px | 14px | 13px |
| `comfortable` | 52px | 20px | 14px |

Density is applied via a `data-density` attribute on `<html>`.

### Color Mode
- `light` — default
- `dark` — inverted surface/text colors
- `system` — follows OS preference

Managed by `next-themes`.

---

## ThemeStudioProvider

The `ThemeStudioProvider` component:
1. Reads the current org theme from the API (or local defaults)
2. Applies it to `document.documentElement` CSS variables
3. Watches for draft changes (live preview in Theme Studio)
4. Responds to dark/light mode changes from `next-themes`

```typescript
// Applying a theme
applyTheme({
  primaryColor: '#0A0A0A',
  secondaryColor: '#4B41E1',
  fontFamily: 'Inter',
  density: 'erp-dense',
});
```

---

## SSR Safety

CSS variable injection happens **client-side only** after mount. The server renders with default tokens from globals.css. On the client, the theme is applied in a `useLayoutEffect` to avoid flash.

```typescript
// SSR-safe theme application
useLayoutEffect(() => {
  applyTheme(currentTheme);
}, [currentTheme]);
```

---

## Future Extensions

- **Branch Branding**: Override org theme variables at the branch level
- **White Labeling**: Complete logo + color replacement per org
- **Theme Presets**: Named presets (Professional, Modern, Classic)
- **Font Presets**: Google Fonts integration
- **Custom CSS Injection**: Per-org custom CSS (sandboxed)
