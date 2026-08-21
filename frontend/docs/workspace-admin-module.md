# Workspace Admin Module

The ERP's presentation/control plane — navigation modules, the menu hierarchy
inside each one, the workspace configuration layer editor, and the system
health monitor. `src/features/workspace-admin`, wired from
`backend/src/modules/workspace` and `backend/src/modules/health` (backend
source, not the Postman collection — see [Naming](#naming) and
[Sources](#sources) below) and the pre-implementation analysis in
`docs/workspace-module-ux-architecture.md`.

Related: [Backend Contract Gaps](./backend-gaps.md) ·
[Workspace Scope Platform](./workspace.md) ·
[Administration Modules](./administration-modules.md)

---

## Naming

**This is not `src/features/workspace`.** That feature already existed for a
different concept — resolving `GET /auth/me` and rendering the
organization/branch/academic-year **scope selection** screen
(`docs/workspace.md`). This module is the backend's own "Workspace Platform"
(`src/modules/workspace` on the backend): navigation administration,
configuration, setup status and (via `src/modules/health`) the three health
probes. The two modules never call each other; a super admin using this
module is gated entirely by **role** (`SUPER_ADMIN`), never by workspace
scope, since navigation administration and health probing are not
scope-specific operations.

## Sources

Nearly every response body in the Postman collection's Workspace, Navigation
and Health folders is an auto-generated placeholder schema — every field
value is the literal string `"<Error: Too many levels of nesting to fake this
schema>"` except in the two `/health`/`/ready` success examples. Field
**names** and top-level shape (object vs. array) from Postman are reliable;
field **types** are not. Every DTO in this module was therefore verified
against backend source directly: `navigation-response.dto.ts`, the six
`create`/`update`/`move`/`reorder`/`status` DTOs under
`navigation/dto/{module,menu}/`, `workspace-config.dto.ts`,
`workspace-setup-status.dto.ts`, `health-response.dto.ts`, the three
controllers, and `workspace.prisma`.

---

## Endpoints

| Endpoint                                         | Method       | Status  | Note                                                            |
| ------------------------------------------------- | ------------ | ------- | ---------------------------------------------------------------- |
| `/admin/navigation/modules`                       | GET, POST    | Wired   | SUPER_ADMIN + `settings.manage`. List takes no query parameters. |
| `/admin/navigation/modules/:id`                   | GET, PATCH   | Wired   | `PATCH` is a genuine partial update (`PartialType`).             |
| `/admin/navigation/modules/:id/status`            | PATCH        | Wired   | Body is `{ isActive }` — a real target, unlike Branch's toggle.  |
| `/admin/navigation/modules/:id`                   | DELETE       | Wired   | Blocked (400) while system-owned or menus still exist.           |
| `/admin/navigation/menus`                         | GET, POST    | Wired   | `GET ?moduleId=` is a documented optional filter.                |
| `/admin/navigation/menus/:id`                     | GET, PATCH   | Wired   | Partial update.                                                  |
| `/admin/navigation/menus/:id/move`                | PATCH        | Wired   | Rejected (400) on a cycle or exceeding depth 3.                  |
| `/admin/navigation/menus/:id/status`              | PATCH        | Wired   |                                                                    |
| `/admin/navigation/menus/:id/duplicate`           | POST         | Wired   | Forces the copy's status to `DISABLED`.                         |
| `/admin/navigation/menus/reorder`                 | PUT          | Wired   | Exposed via `useReorderMenus`; not used by any of the six screens (no drag-and-drop reorder ships — see [Screens](#screens)). |
| `/admin/navigation/menus/:id`                     | DELETE       | Wired   | Blocked (400) while system-owned or children still exist.        |
| `/workspace/navigation`                           | GET          | Wired   | **Runtime** tree for the caller only — never used for admin listings ([§ below](#the-runtime-navigation-endpoint-is-not-a-listing-api)). |
| `/workspace/configuration`                        | POST         | Wired   | SUPER_ADMIN + `settings.manage`. No `list`/`DELETE`.             |
| `/workspace/configuration/:scopeType`             | GET          | Wired   | Same guard. Added 2026-08-21 — see [gap L1](./backend-gaps.md#k-workspace-admin) (now resolved). Reads one layer by its exact `(scopeType, scopeId)` key; 404 when none exists yet. |
| `/workspace/setup/status`                         | GET          | Wired   | SUPER_ADMIN/ORG_ADMIN. Backs a small banner only — no setup wizard ships. |
| `/workspace/setup/complete`                       | POST         | Not used | Out of scope for the six screens this module ships.             |
| `/live`, `/ready`, `/health`                      | GET          | Wired   | Public, unversioned, unauthenticated, throttle-exempt.           |
| `GET /workspace`                                  | —            | Not used | No screen in this module needs the merged layout/configuration payload. |

---

## Three facts that shape the whole module

**1. Module and Menu CRUD are fully real.** This was the one open question
going in — whether the Navigation Admin API existed at all, or only the
runtime tree. It exists in full: 15 endpoints, all wired, all `SUPER_ADMIN` +
`settings.manage`.

**2. Workspace configuration has exactly one endpoint.** `POST
/workspace/configuration` — no `GET`, no `list`, no `DELETE`. Every save in
the Configuration Layer Editor is "define this layer," never "edit this
layer," and the screen states this with a `Banner` before any field is
touched. The two preference blobs
(`navigationPreferences`/`clientPreferences`) are shallow-merged on the
backend, one level deep, into whatever already exists for the scope — so
every preference control is **tri-state** (`Leave unchanged` / `On` / `Off`,
or an empty string for text/select fields), and `mappers/configuration.mapper.ts`
drops every untouched field before building the request body. Sending `false`
for a field the user never touched would silently overwrite it.

**3. Liveness, readiness and dependency health are three independent
dimensions, never collapsed.** `/live` checks no dependencies at all — a
database outage never fails it. `/ready` checks only `database`. `/health`
checks `database` and `memoryHeap`. `mapHealthStatus()` in
`mappers/health.mapper.ts` is the single place a backend outcome becomes a
frontend health state, called with an explicit `"live" | "ready" | "health"`
discriminant so the three answers can never be compared as if they meant the
same thing. `httpStatus: null` (no response ever arrived — network error,
timeout, cancellation) always maps to `"unknown"`, never to any specific
subsystem being down.

---

## The runtime navigation endpoint is not a listing API

`GET /workspace/navigation` resolves the **calling user's own** navigation
tree, filtered by role and effective permissions
(`navigation.service.ts`) — it is not a management endpoint and this module
never treats it as one. It is used in exactly one place: a small "reach"
line on the Navigation Modules screen (`Your own navigation currently
resolves N menus across N levels`), sourced from `totalVisibleMenus` and
`menuTreeDepth`. Every admin listing (`ModulesTable`, `MenuTree`) is built
from `/admin/navigation/*` instead.

## Menu visibility is a diagnostic, not an access decision

`MenuVisibilityIndicator` shows the three-step pipeline `navigation.service.ts`
evaluates — module active? status renderable (`ACTIVE`/`BETA` only)?
permissions required? — for exactly the reason the design brief asks: "show
the pipeline in the admin UI." It never claims to know whether the current
user, or any specific user, can see a menu; permission evaluation is
server-side and this component cannot reproduce it. `MenuDetailDrawer` pairs
it with an explicit line: hiding a menu here does not revoke access to its
route — the route still exists.

---

## Screens

| Screen                      | Route                                       | Backend                                              |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| Navigation Modules           | `/app/workspace-admin/modules`               | `GET /admin/navigation/modules`, `GET /workspace/navigation` (reach line) |
| Module Details                | `/app/workspace-admin/modules/[id]`          | `GET /admin/navigation/modules/:id`                     |
| Create/Edit Module            | `/app/workspace-admin/modules/new`, `/[id]/edit` | `POST`/`PATCH /admin/navigation/modules`             |
| Menu Details                  | `/app/workspace-admin/menus`, `/menus/[id]`  | `GET /admin/navigation/menus`, full CRUD + move/duplicate/status |
| Configuration Layer Editor    | `/app/workspace-admin/configuration`         | `POST /workspace/configuration`                         |
| System Health Monitor         | `/app/workspace-admin/health`                | `GET /live`, `/ready`, `/health`                        |

Menu Details is one screen, not two — a `TreeView` of one module's menus on
the left, a `DetailDrawer` on the right for whatever is selected, and create
is a dialog rather than a route, since no separate "menu list" screen exists
in the six-screen brief. A module must be selected first: a menu's `parentId`
only ever names another menu **within its own module**, so there is no
cross-module hierarchy to render as a single tree.

**Not built:** Workspace Selection, Workspace Switcher, Setup Wizard,
Workspace Overview, My Preferences, Command Palette and Workspace Unavailable
— all real screens the UX architecture doc identifies (S1–S3, S4, S11, S13,
S14), but outside this module's six-screen scope. `useSetupStatus` and
`useNavigationTree` are wired as small supporting hooks (a banner, a reach
line) rather than full screens, so the endpoints are not idle but nothing
here pretends to be a setup wizard.

---

## Reuse

- **Table** — `DataTable` + `DataTableToolbar` + `DataTableColumnHeader` for
  the module registry.
- **Tree** — `TreeView` and `utils/tree` (`buildTree`, `collectDescendantIds`,
  `ancestorPath`) for the menu hierarchy — reused as-is, per the design
  brief's own recommendation ("it already owns the four states and the
  `role=\"tree\"` wiring").
- **Forms** — `useZodForm`, `TextField`/`SelectField`/`TextareaField`,
  `applyServerFieldErrors`.
- **States** — `FormSkeleton`, `PageSkeleton`, `EmptyState`, `ApiErrorState`,
  `ForbiddenState`, `Banner`, `BackendPendingNote` from `shared/components/feedback`.
- **Overlays** — `ConfirmDialog`, `DetailDrawer`, and plain `Dialog` for the
  create/edit/move menu forms (a drawer would sit awkwardly over a tree the
  user is actively browsing).
- **Display** — `StatusBadge`, `StatCard`, `DescriptionList`.

New, genuinely domain-specific: `ModuleStatusBadge`, `MenuStatusBadge` (six
tone-mapped states), `MenuVisibilityIndicator`, `HealthProbeCard`,
`DependencyTable` (renders whatever indicator keys `/health` actually
returns — tolerant of a future `redis`/`storage` entry with no frontend
change), and `SetupStatusBanner`.

`eligibleParents()` (`hooks/use-menus.ts`) narrows the Move/Create parent
picker using `buildTree`/`collectDescendantIds` so the backend's two hard
rules — no cycles, max depth 3 — are unrepresentable from the UI, the same
pattern Program and Academic Unit use for their own hierarchy pickers. The
server (`MenuHierarchyValidator`) remains the authoritative check.

---

## Health semantics

| Probe    | Checks                     | Success | HTTP failure                      | No response at all |
| -------- | --------------------------- | ------- | ----------------------------------- | --------------------- |
| `/live`  | Nothing — process only      | `live`  | `down`                              | `unknown`             |
| `/ready` | `database`                  | `ready` | `not-ready`                         | `unknown`             |
| `/health`| `database`, `memoryHeap`    | `healthy` (`data.status === "ok"`) or `degraded` | `degraded`         | `unknown`             |

`deriveOverallState()` combines the three into one headline word for the page
header — `healthy` only when all three agree, `unavailable` when the process
itself is down, `degraded` when traffic or dependencies are the problem, and
`unknown` only when every probe was unreachable. The three probe cards remain
independently visible regardless of what the headline says; the headline
never replaces them.

Latency shown on each card is measured in the browser (`performance.now()`
round the request) and labelled "Response time," never "backend execution
time." Auto-refresh polls every 30 seconds via TanStack Query's
`refetchInterval` — no hand-rolled `setInterval` — and Refresh fires all
three probes independently via `queryClient.invalidateQueries`.
