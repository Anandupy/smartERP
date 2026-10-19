# Layouts

Two complementary layers: **Next.js route layouts** (`src/app/`) and **layout
shell components** (`src/components/layouts/`). Shells are presentational and
reusable; route layouts wire shells + guards into the router.

## Shell components (`components/layouts`)

| Shell              | Use                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `AuthLayout`       | Centered single-column for auth screens.                                                                              |
| `AuthSplitLayout`  | Two-column auth screens: brand panel (`lg`+) beside a centered content column, with a `footer` slot.                  |
| `AppLayout`        | Authenticated shell: collapsible sidebar + sticky header + responsive content + footer, all injectable slots.         |
| `AppShellProvider` | Client seam under `AppLayout`: binds the sidebar primitive's open state to `useUiStore`, keeping one source of truth. |
| `PublicLayout`     | Public/marketing shell (future).                                                                                      |

`AppLayout` renders a **"Skip to main content"** link as its first focusable
element (visually hidden until focused) targeting `<main id="main-content"
tabIndex={-1}>`, so keyboard users can bypass the sidebar and header.

Shells own **structure only** — navigation content is injected by features. What
goes into `AppLayout`'s slots is the navigation feature's business; see
[Dashboard Shell](./dashboard-shell.md).

`AuthSplitLayout`'s brand panel is `hidden lg:flex` and `overflow-hidden`, so
small screens never lay out the decoration and bleeding artwork can never cause
horizontal page scroll.

> `WorkspaceLayout` has been removed. It existed to prepend a workspace switcher
> to the sidebar; the switcher now lives inside `AppSidebar`'s footer and in the
> header, both supplied by `features/navigation`, so the specialization had
> nothing left to specialize.

## Route groups (`src/app/`)

- `(auth)/layout.tsx` → `GuestRoute` only
- `(app)/layout.tsx` → `ProtectedRoute` + `AppLayout`
- `(public)/layout.tsx` → `PublicLayout`

Route groups `(name)` organize routes without affecting the URL.

The auth group intentionally wires **no shell**: its screens legitimately differ
(splash is full-bleed, welcome/login are two-column, recovery screens are
centered), so each page picks its own — see
[Authentication Screens](./authentication.md).

`(app)` now carries the dashboard, System Settings, Maintenance and Audit
routes. `(public)` still contains a layout but no pages; the build correctly
emits no routes for it.

## Responsive design

Mobile-first, no fixed widths. Breakpoints (`constants/breakpoints.ts`) cover
320 → 1920px and back the `useBreakpoint`/`useIsMobile` hooks. `Container` uses
fluid padding and max-width caps; layouts stack on mobile and expand on `lg`.

## One persistent sidebar

CampusFlow has one persistent primary application sidebar: `AppSidebar`, in
`AppLayout`. Feature-specific layouts must not render a second persistent
vertical navigation sidebar. Related pages use the existing overview cards,
contextual links, or compact horizontal tabs where appropriate.

- A nested route layout must not exist only to wrap its pages in navigation,
  and must not reserve a grid track, width or margin for one.
- A module's sections are reached from its overview page (`LinkCard`s built
  from the module's sections constant) and left through the header's
  breadcrumbs, which link every parent level.
- Before adding a nested layout or a new navigation pattern, inspect
  `AppLayout` and the shared layout components.

System Settings (`SETTINGS_SECTIONS`), Account & Security
(`SECURITY_SECTIONS`) and Branch Settings (`BRANCH_SETTINGS_SECTIONS`) follow
this: each overview links every section, and no layout under `app/(app)/app`
adds navigation.
