# Dashboard Shell

The chrome every authenticated ERP screen renders inside. Built once, in two
halves that stay separate on purpose:

| Half          | Owner                          | Responsibility                                              |
| ------------- | ------------------------------ | ----------------------------------------------------------- |
| **Structure** | `components/layouts/AppLayout` | Sidebar column, sticky header, content, footer. No content. |
| **Content**   | `features/navigation`          | The menu, breadcrumbs, search, account affordances.         |

That split is what lets the shell stay a generic, business-free layout while the
navigation grows.

---

## Structure

```tsx
<AppLayout
  sidebar={<AppSidebar workspaceSwitcher={<WorkspaceSwitcher />} />}
  header={<AppHeader signOut={<SignOutButton />} />}
  footer={<AppFooter />}
>
  {children}
</AppLayout>
```

`AppLayout` stays a **Server Component**. The interactive seam is
`AppShellProvider`, a small client boundary that binds the sidebar primitive's
open state to `useUiStore` — an event handler cannot cross the server/client
seam, but that component can.

### One source of truth for the sidebar

`SidebarProvider` keeps its own state and a cookie by default, which would make
`useUiStore.isSidebarOpen` a second, silently diverging copy. The store already
declares navigation chrome as its responsibility, so the primitive is driven
_from_ it. Anything that needs to open or collapse the sidebar — a keyboard
shortcut, a deep link, a future guided tour — has one place to say so.

---

## Responsive behaviour

No fixed layout widths anywhere between 320 and 1920px. What changes, and where:

| Breakpoint | Sidebar               | Header                                                      |
| ---------- | --------------------- | ----------------------------------------------------------- |
| `< tablet` | Overlay drawer        | Breadcrumbs collapse to the current page; search is an icon |
| `tablet`+  | Collapsible icon rail | Full breadcrumb trail                                       |
| `lg`+      | Rail or full column   | Workspace switcher joins the bar                            |

Priority under pressure is set by what drops first. The sidebar toggle and the
profile menu are **never** dropped: on a phone they are the only routes to
navigation and to sign-out. The workspace switcher hides below `lg` because the
sidebar footer still carries it.

Selecting a destination on mobile closes the drawer, so the user is not left
staring at the menu they just used.

---

## Navigation is static, and honest about it

`NAV_SECTIONS` in `features/navigation/constants.ts` is the whole menu. The
backend publishes a navigation tree (`GET /workspace/navigation`) that is not
wired yet, and inventing a shape for it would be worse than a list that admits
being fixed. Shipped modules sit in the first section; the second advertises
what is coming, rendered inert with a "Soon" marker rather than as links that
go nowhere.

The types in `features/navigation/types.ts` are shaped so that swapping the
source later is a change to one module — nothing renders a raw wire shape.

---

## Breadcrumbs derive from the URL

`resolveBreadcrumbs(pathname)` is a pure function over the path. Nothing is
passed down from a page: a route that follows the registry gets breadcrumbs for
free, and a route needing a nicer word for a segment adds one to
`BREADCRUMB_LABELS`. Unlisted segments are title-cased, which is correct for
record ids and harmless otherwise.

The last crumb carries no `href` — linking a crumb to the page it is already on
is a dead control for keyboard and screen-reader users.

---

## What is a placeholder, and why

| Affordance      | State                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| Command palette | **Works** for navigation; record search is `Backend Pending`                |
| Global search   | A _button_, not an input — it raises the palette                            |
| Notifications   | Placeholder with an honest empty state, and **no unread badge**             |
| Profile menu    | Wired: identity from `useAuth`, appearance via `next-themes`, sign-out slot |

Search is a button because typing into a box that cannot answer would be a worse
lie than a control that opens the palette and says what it can do. The
notification bell carries no dot and no count, because a badge over an unwired
feed is a false alarm.

---

## Workspace switcher

Reads and changes the active scope through `useWorkspace()` and nothing else:
`select` cascades the levels below whatever changed, `confirm` persists the
result and republishes the scope headers. Switching campus here therefore has
exactly the effect it has on the selection screen, without this component
knowing how either works.

Only levels with a real alternative are offered — a user with one campus gets no
campus list, because a menu whose every option is already chosen is noise.
Re-running the full selection stays available as an explicit escape.

---

## Routes

| Path                                                                      | Screen                   |
| ------------------------------------------------------------------------- | ------------------------ |
| `/app`                                                                    | Dashboard                |
| `/app/settings`                                                           | System Settings overview |
| `/app/settings/{general,branding,maintenance,system-information,history}` | Settings sections        |
| `/app/maintenance`                                                        | Maintenance rules        |
| `/app/maintenance/new`                                                    | Create rule              |
| `/app/maintenance/[id]/edit`                                              | Edit rule                |
| `/app/audit`                                                              | Audit logs               |

Declared in `constants/routes.ts` so navigation, guards and breadcrumbs share
one contract. A maintenance rule has no read-only screen: the editor **is** the
detail view, so opening one always lands somewhere it can be changed.

`(app)/layout.tsx` gates the whole group with `ProtectedRoute` (is the visitor
signed in) and `RequireWorkspace` (_where_ are they signed in) — see
[Workspace](./workspace.md).
