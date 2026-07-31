# Layouts

Two complementary layers: **Next.js route layouts** (`src/app/`) and **layout
shell components** (`src/components/layouts/`). Shells are presentational and
reusable; route layouts wire shells + guards into the router.

## Shell components (`components/layouts`)

| Shell             | Use                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `AuthLayout`      | Centered single-column for auth screens.                                                                     |
| `AppLayout`       | Authenticated shell: sidebar + sticky header + responsive content, with injectable `sidebar`/`header` slots. |
| `PublicLayout`    | Public/marketing shell (future).                                                                             |
| `WorkspaceLayout` | Specializes `AppLayout` with a workspace switcher slot (future).                                             |

Shells own **structure only** — navigation content is injected by features.

## Route groups (`src/app/`)

- `(auth)/layout.tsx` → `GuestRoute` + `AuthLayout`
- `(app)/layout.tsx` → `ProtectedRoute` + `AppLayout`
- `(public)/layout.tsx` → `PublicLayout`

Route groups `(name)` organize routes without affecting the URL. They currently
contain layouts but no pages (pages arrive with features) — the build correctly
emits no routes for empty groups.

## Responsive design

Mobile-first, no fixed widths. Breakpoints (`constants/breakpoints.ts`) cover
320 → 1920px and back the `useBreakpoint`/`useIsMobile` hooks. `Container` uses
fluid padding and max-width caps; layouts stack on mobile and expand on `lg`.
