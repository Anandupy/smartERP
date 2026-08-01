# Layouts

Two complementary layers: **Next.js route layouts** (`src/app/`) and **layout
shell components** (`src/components/layouts/`). Shells are presentational and
reusable; route layouts wire shells + guards into the router.

## Shell components (`components/layouts`)

| Shell             | Use                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `AuthLayout`      | Centered single-column for auth screens.                                                                     |
| `AuthSplitLayout` | Two-column auth screens: brand panel (`lg`+) beside a centered content column, with a `footer` slot.         |
| `AppLayout`       | Authenticated shell: sidebar + sticky header + responsive content, with injectable `sidebar`/`header` slots. |
| `PublicLayout`    | Public/marketing shell (future).                                                                             |
| `WorkspaceLayout` | Specializes `AppLayout` with a workspace switcher slot (future).                                             |

Shells own **structure only** — navigation content is injected by features.
`AuthSplitLayout`'s brand panel is `hidden lg:flex` and `overflow-hidden`, so
small screens never lay out the decoration and bleeding artwork can never cause
horizontal page scroll.

## Route groups (`src/app/`)

- `(auth)/layout.tsx` → `GuestRoute` only
- `(app)/layout.tsx` → `ProtectedRoute` + `AppLayout`
- `(public)/layout.tsx` → `PublicLayout`

Route groups `(name)` organize routes without affecting the URL.

The auth group intentionally wires **no shell**: its screens legitimately differ
(splash is full-bleed, welcome/login are two-column, recovery screens are
centered), so each page picks its own — see
[Authentication Screens](./authentication.md). `(app)` and `(public)` still
contain layouts but no pages; the build correctly emits no routes for them.

## Responsive design

Mobile-first, no fixed widths. Breakpoints (`constants/breakpoints.ts`) cover
320 → 1920px and back the `useBreakpoint`/`useIsMobile` hooks. `Container` uses
fluid padding and max-width caps; layouts stack on mobile and expand on `lg`.
