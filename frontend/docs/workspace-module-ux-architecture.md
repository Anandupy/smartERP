# Workspace Module — Product & UX Architecture Report

**Status:** analysis only. No code was changed to produce this.
**Sources:** `backend/docs/core/workspace/{overview,module,navigation,configuration}.md` · `backend/docs/core/{workspace.md,workspace-bootstrap.md,execution-context.md,guard-pipeline.md,context.md}` · `backend/src/modules/workspace/**` (6 controllers) · `backend/src/modules/context/**` · `backend/src/modules/health/**` · `backend/prisma/modules/workspace/workspace.prisma` (4 models, 2 enums) · `backend/postman/erp.postman_collection.json` (25 Workspace/Navigation/Health requests) · the shipped frontend `src/core/workspace/**` and `src/features/workspace/**`.

---

## 0. Executive summary — the three things called "Workspace"

The word means three different things in this codebase, and conflating them is how a Workspace UI goes wrong.

| # | Name | Owns | Lives in | Has UI today? |
| :-- | :-- | :-- | :-- | :-- |
| 1 | **Workspace Platform** (backend) | Presentation orchestration: navigation tree + layered configuration + client metadata | `src/modules/workspace` | **No** |
| 2 | **Execution Context** | *Which* organization / branch / academic year a request runs in | `src/modules/context` | Indirectly (headers) |
| 3 | **Workspace scope** (frontend) | The selection screen, the scope store, the scope headers | `src/core/workspace`, `src/features/workspace` | **Yes** |

**The single most important finding:** `GET /v1/workspace` is fully implemented — it returns a permission-filtered, database-driven navigation tree, a 5-layer merged configuration, the active contexts and the client platform — **and the frontend does not call it.** The sidebar is built from a hard-coded array in `src/features/navigation/constants.ts`. An entire navigation platform exists server-side, unused.

**Second finding:** the **Navigation Administration API is complete and has no UI whatsoever** — 15 endpoints covering module and menu CRUD, move-with-cycle-validation, bulk reorder, duplicate, and status lifecycle. This is the largest genuinely greenfield surface in the module.

**Third finding, and a hard constraint on Part 7:** `WorkspaceConfiguration` has exactly **one endpoint — `POST /v1/workspace/configuration`, `SUPER_ADMIN` + `Settings.Manage` only.** There is no `GET`, no `list`, no `DELETE`. A normal user therefore **cannot save their own theme, density or sidebar state through this API.** Any "My Preferences" screen is either client-local or must be designed as Future Enhancement.

---

# PART 1 — Workspace Overview

## What it is

The **presentation orchestration layer**. It answers one question for an authenticated user: *"given who you are and where you are operating, what does your application shell look like?"* — navigation tree, UI preferences, active scope, client platform.

It is explicitly **not** the tenant resolver. That is the Execution Context platform, and the two meet only at `RequestContextService.getContext()`.

## Why it exists

1. **Navigation must be data, not code.** A 100+ page ERP cannot hard-code menus per role; menu visibility is a permission decision that must live next to permissions.
2. **Preferences must be layered.** A product default, an organization's override, a branch's override, a role's override and a user's override must merge deterministically.
3. **Zero duplicate security logic.** Navigation never evaluates a permission itself — it calls `AuthorizationService.canUserAccess()`.
4. **A fresh installation must be reachable.** Bootstrap has its own sub-module so an empty database is not a locked door.

## Responsibilities

| Owns | Does **not** own |
| :-- | :-- |
| Navigation tree resolution + caching | Deciding *which* org/branch/year is active (Context) |
| Module & menu lifecycle administration | Permission evaluation (Authorization) |
| Layered workspace configuration | Business data of any kind |
| Bootstrap/setup state | Theme rendering (client) |
| Client platform detection surface | Widgets, dashboards (do not exist) |

## Dependencies (unidirectional)

`Workspace → Navigation → Authorization → PermissionResolver`, plus `Workspace → RequestContext` for scope and client metadata, and `Workspace → Prisma` for `Module`, `Menu`, `WorkspaceConfiguration`, `WorkspaceState`.

## Relationships

| With | Relationship |
| :-- | :-- |
| **Authentication** | `/auth/me` is the bootstrap read: identity, permissions, **`availableOrganizations/Branches/AcademicYears`**, and `setup`. The workspace selection screen is built entirely from this one response. |
| **Authorization** | Menu visibility delegates to `AuthorizationService.canUserAccess()` with `permissions[]` + `permissionMode` (`ALL`/`ANY`). |
| **Organization / Branch / Academic Year** | Supply the three scope levels. Setup requires one of each to exist. |
| **Navigation** | A sub-module of Workspace, not a peer. |
| **Dashboard** | No backend dashboard/widget API exists. The frontend dashboard is a shell. |
| **Theme** | `clientPreferences.theme` is stored and returned; nothing else. No theme entity, no branding endpoint. |
| **Notifications / Communication** | Independent. The bell reads `/communication/notifications`; workspace scope only tags rows. |
| **Settings** | System settings are a separate module; workspace configuration is UI preference only. |
| **Health** | Independent infrastructure probes (`/live`, `/ready`, `/health`) — usable as a Workspace admin panel (see Part 6.4). |

---

# PART 2 — Execution Context

## What identifies a workspace

A **triple**: `organizationId` · `branchId` · `academicYearId`. There is no `Workspace` entity, no workspace id, no workspace name. A "workspace" is a *coordinate*, not a record. This is the single most consequential fact for the UI: **you cannot list workspaces, name them, favourite them, or share them** — you can only compose one from three lists.

## How it is resolved (verified, in order)

```
RequestContextMiddleware   → requestId, clientApp, clientVersion, platform; scope = null
JwtAuthGuard               → req.user (full User row)
ExecutionContextGuard      → THE ONLY WRITER of scope onto the context
  ├─ @Public()? → skip
  ├─ workspace not initialized? → resolveBootstrapContext (best effort, never throws)
  └─ initialized → resolveContext(input, { selectionRequired })
        Priority 1  Headers: x-organization-id (alias x-tenant-id) ·
                    x-branch-id · x-academic-year-id (alias x-academic-year)
                    → levels above the most specific header are DERIVED
        Priority 2  Automatic: exactly one candidate at each level → auto-select
        Priority 3  Ambiguous (>1) → 409 CONTEXT_SELECTION_REQUIRED with the
                    candidate lists, unless the route declares
                    @AllowUnresolvedContext()
RolesGuard → PermissionGuard → MaintenanceGuard → BranchGuard → AcademicYearGuard
```

**Absence ≠ ambiguity.** An organization with zero branches resolves to an organization-only scope; only a count greater than one is a selection problem.

## What is persisted, and where

| Item | Where | Notes |
| :-- | :-- | :-- |
| The selection (3 ids) | **Browser only** — `core/workspace/workspace-storage.ts` seam | The backend is **stateless**: it never stores an active workspace |
| Scope headers | Sent per request, only when status is `ready` | A half-made selection never reaches the wire |
| `initializedAt` | `WorkspaceState` singleton | The only persisted workspace fact server-side |
| Preferences | `WorkspaceConfiguration` | Write-only via one Super-Admin endpoint |

## Lifecycle after login

```
login → tokens → GET /auth/me (identity + availability + setup)
  ├─ setup.setupRequired → SETUP WIZARD
  ├─ role ∉ {SUPER_ADMIN, ORG_ADMIN} → backend-scoped → straight to app
  └─ role ∈ {SUPER_ADMIN, ORG_ADMIN} → WORKSPACE SELECTION
        seed order: remembered selection → backend `context` default → nothing
        always clamped to what is currently offered
        `alwaysShowSelection: true` today → even a single-workspace user confirms
  → status "ready" → headers flow → app
```

## Switching

Client-side and instantaneous: change the ids in the store → the header providers read the new values on the *next* request → invalidate all scoped queries. The backend has no switch endpoint and nothing to invalidate. **Sign-out must clear the scope** — it is persisted and would otherwise carry to the next user on that machine.

---

# PART 3 — Workspace Data Model

### 3.1 `Module` (table `modules`)
`id · code(unique) · name · description? · icon? · displayOrder=0 · isSystem=true · isActive=true · createdAt · updatedAt` · relation `menus: Menu[]`

- **Lifecycle:** ACTIVE ⇄ INACTIVE → ARCHIVED → delete (**blocked while any menu exists**).
- **Cascade:** `isActive=false` hides every menu beneath it, for every user, immediately.
- `isSystem=true` blocks code modification and hard delete.
- **Note:** the docs describe an `ARCHIVED` module state; the schema has only the boolean `isActive`. Design a two-state toggle, not three.

### 3.2 `Menu` (table `menus`) — 21 fields, all UI-relevant
`id · code(unique, /^[A-Z0-9_]+$/) · moduleId · parentId? · route · componentIdentifier? · permissions[]=[] · permissionMode="ALL" (ALL|ANY) · displayName · icon? · tooltip? · description? · displayOrder=0 · badge? · searchKeywords[]=[] · helpUrl? · documentationUrl? · status=ACTIVE · isSystem=true · createdAt · updatedAt`

- **Hierarchy invariants** (`MenuHierarchyValidator`): no cycles (DFS ancestor check) · no self-parenting · **max depth 3** · route uniqueness · system protection.
- `searchKeywords[]` exists specifically to feed a **command palette** — the schema anticipates it.
- `badge` is free text (e.g. `NEW`, `BETA`).
- Cascade deletes: module→menus, parent→children.

### 3.3 `WorkspaceConfiguration` (table `workspace_configurations`)
`id · scopeType · scopeId? · navigationPreferences Json={} · clientPreferences Json={} · isActive=true · createdById? · timestamps` · unique `(scopeType, scopeId)`

- Both JSON blobs are **schemaless** — the documented keys are examples, not a contract: `navigationPreferences: {sidebarCollapsed, themeMode, defaultRoute, denseMode}`, `clientPreferences: {theme, locale}`.
- Merge order: `PRODUCT → ORGANIZATION → BRANCH → ROLE → USER`, later wins.
- `scopeId` for `ROLE` is the **role name string** (`"STAFF"`), not a UUID.

### 3.4 `WorkspaceState` (table `workspace_state`)
`id · scope="GLOBAL"(unique) · initializedAt? · initializedById? · timestamps`
Singleton. Progress is **derived** from real resources; only the terminal transition is stored, so completion is attributable and cannot silently reverse.

### 3.5 Enums (exact)
- `MenuStatus`: ACTIVE · DISABLED · COMING_SOON · BETA · HIDDEN · DEPRECATED — **only ACTIVE and BETA render**; the other four are authoring states.
- `WorkspaceScopeType`: PRODUCT · ORGANIZATION · BRANCH · ROLE · USER
- `WorkspaceSetupStage`: ORGANIZATION · BRANCH · ACADEMIC_YEAR · FINALIZE · COMPLETED
- `SetupResource`: ORGANIZATION · BRANCH · ACADEMIC_YEAR

---

# PART 4 — Workspace Navigation

## Visibility pipeline (exact, from the source)

```
fetch menus → module.isActive? ─no→ EXCLUDE
            → status ∈ {ACTIVE, BETA}? ─no→ EXCLUDE
            → permissions[] empty? ─yes→ INCLUDE
            → AuthorizationService.canUserAccess(permissions, permissionMode) → INCLUDE / EXCLUDE
```

Sorted by `displayOrder`, assembled into a ≤3-level tree, cached under `workspace:nav:user:<userId>:<role>` (in-memory Map + TTL), invalidated wholesale on any module/menu mutation.

## Endpoints (16 total)

**Consumer (1)** — `GET /v1/workspace/navigation` → the user's tree. Also embedded in `GET /v1/workspace`.

**Admin — Modules (6)**, all `SUPER_ADMIN` + `Settings.Manage`:
`GET /v1/admin/navigation/modules` (with menu counts) · `GET /:id` · `POST` · `PATCH /:id` · `PATCH /:id/status {isActive}` · `DELETE /:id` (blocked if menus exist)

**Admin — Menus (8)**, same guards:
`GET /v1/admin/navigation/menus?moduleId=` · `GET /:id` · `POST` · `PATCH /:id` · `PATCH /:id/move {targetParentId, targetModuleId, displayOrder}` · `PUT /reorder {items:[{id,displayOrder}]}` · `PATCH /:id/status {status}` · `POST /:id/duplicate` · `DELETE /:id` (blocked if children exist)

## How navigation *should* behave in the UI

1. **The shell renders the server tree** — not a constant. Icons arrive as **strings** (`"users"`), so the client needs a name→component map with a neutral fallback for an unknown icon.
2. **`BETA` renders with a badge**; `COMING_SOON`, `DISABLED`, `HIDDEN`, `DEPRECATED` never reach the client — so the admin UI is the *only* place they are visible, and it must show them clearly.
3. **`searchKeywords` powers a command palette** (⌘K) — the field exists for exactly this.
4. **Favourites, pinned items and recent items have no backend.** Client-local or Future.
5. **Role-based navigation is emergent, not configured** — there is no role field on `Menu`; visibility is permissions-only.

---

# PART 5 — Workspace Switching

| Step | What happens | Backed by |
| :-- | :-- | :-- |
| Login | Tokens issued | `POST /auth/login` |
| Bootstrap read | Identity, permissions, availability, setup state | `GET /auth/me` |
| Setup branch | Wizard if `setupRequired` | `/workspace/setup/*` |
| Selection | Org → Branch → Year, each cascading | client-side from availability |
| Confirm | Store + persist + status `ready` | client storage seam |
| Requests | Three scope headers attached | `headerRegistry` |
| Switch | Change ids → invalidate queries | client only |

**What changes on switch:** scope headers · every scoped query · the resolved navigation tree (permissions can differ by scope) · the merged configuration (ORGANIZATION and BRANCH layers change) · dashboard content.
**What stays constant:** identity, tokens, role, the browser session, the shell chrome itself.

**Design rule:** treat a switch as a **soft reload of the data plane, not the app** — keep the shell mounted, invalidate queries, show a brief inline "Switching to …" state. A full page reload loses the user's place and is the single worst thing this flow can do.

**Confirmation:** required only when unsaved work exists. Otherwise a switch is reversible and cheap — do not confirm it.

---

# PART 6 — Dashboard Integration

## 6.1 What exists
**No dashboard, widget, statistic, chart, quick-action or announcement endpoint exists anywhere in the backend.** The only workspace-adjacent aggregate is `metadata: { resolvedAt, totalVisibleMenus, menuTreeDepth }` on the layout response.

## 6.2 What is workspace-scoped
Everything that reads `req.context`: admissions, academic units, academic years, branches, delivery logs, audit rows. The scope decides *what data*, never *which widgets*.

## 6.3 What a dashboard can honestly show today
- Active scope summary (org / branch / year names) — from `/auth/me`
- Setup progress — from `/workspace/setup/status`
- Navigation reach (`totalVisibleMenus`) — from `/workspace`
- Counts already reachable per module (organizations, branches, programs, academic units) — each from its own list endpoint
- **System health** — see below

## 6.4 System Health as a Workspace panel  *(the user's request — and it is fully backed)*

Three **public, unversioned, throttle-exempt** probes:

| Path | Checks | Answer |
| :-- | :-- | :-- |
| `GET /live` | nothing — process only | `{status:"ok", uptimeSeconds}` |
| `GET /ready` | database | terminus `HealthCheckResult`, **503** when unreachable |
| `GET /health` | database + heap (512 MB ceiling) | terminus result, 503 on failure |

`HealthCheckResult` = `{ status: "ok"|"error", info: {…}, error: {…}, details: { database: {status}, memoryHeap: {status} } }`, wrapped in the standard envelope.

**UI recommendation — a "System Health" card in Workspace Overview, admin-only:** three status dots (Process / Database / Memory), uptime as a humanised duration, last-checked timestamp, 30 s polling, and a `Retry` on failure. Because the probes are public and unthrottled, this panel keeps working when the rest of the API is failing — which is exactly when someone looks at it. Design the failure state first.

---

# PART 7 — Workspace Preferences

## Current backend support — and its hard limit

**One endpoint: `POST /v1/workspace/configuration`, `SUPER_ADMIN` + `Settings.Manage`.**
There is **no read endpoint, no list, no delete.** The merged result comes back only as part of `GET /v1/workspace`.

| Preference | Backend today | Where a UI could live |
| :-- | :-- | :-- |
| Theme (light/dark/system) | `clientPreferences.theme` — writable by Super Admin only | Client-local today (`next-themes`) |
| Locale | `clientPreferences.locale` | Same |
| Sidebar collapsed | `navigationPreferences.sidebarCollapsed` | Client-local |
| Dense mode | `navigationPreferences.denseMode` (documented example) | Client-local |
| Default route | `navigationPreferences.defaultRoute` (documented example) | Client-local |
| Default workspace / branch / year | **Not modelled at all** | Client-local "remember my selection" |
| Timezone · accessibility · font size · favourites · recent pages | **Not modelled** | Future |

**Consequence for design:** ship **two distinct screens**, and label them honestly.
1. **My Preferences** (every user) — theme, density, sidebar, remembered workspace. State plainly: *stored on this device*.
2. **Workspace Configuration** (Super Admin) — the layered editor: pick `scopeType` + `scopeId`, edit the two JSON blobs, upsert. Because there is no GET, the editor **cannot pre-fill an existing layer** — design it as "define this layer" with an explicit warning that it merges into any existing one for the same scope.

---

# PART 8 — Workspace Security

| Boundary | Enforced by | Verdict |
| :-- | :-- | :-- |
| Tenant / organization | `ContextValidatorService.validateOrganization` — non-SUPER_ADMIN requesting another org → **403** | Solid |
| Branch | `validateBranch` — role below ORG_ADMIN outside its assigned branch → **403** | Solid |
| Academic year | `validateAcademicYear` — must belong to the branch | Solid |
| Menu visibility | `AuthorizationService.canUserAccess`, `ALL`/`ANY` | Solid, single source |
| Context ownership | `ExecutionContextGuard` is the **only** writer; `RequestContext` is `readonly` — a second writer fails to compile | Excellent |
| Navigation admin | `SUPER_ADMIN` + `Settings.Manage` on both controllers | Solid |
| Setup routes | `@AllowDuringSetup()` narrows, never widens | Solid |

**Risks worth surfacing in the UI**

1. **Navigation is security-relevant.** Hiding a menu is not access control — the route still exists. The admin UI must say so, or an administrator will believe removing a menu revokes access.
2. **`POST /v1/workspace/configuration` accepts arbitrary JSON** into both blobs with no schema. A malformed layer silently degrades every user in that scope. The editor should validate known keys client-side and warn on unknown ones.
3. **Cascade blast radius.** `PATCH /modules/:id/status {isActive:false}` hides an entire module for every user in the product. This needs a confirm dialog naming the menu count.
4. **The scope lives in browser storage.** Sign-out must clear it.
5. **Health probes are public.** `/health` exposes database reachability and heap status unauthenticated — correct for orchestrators, worth knowing.

---

# PART 9 — Workspace UX Flows

**F1 — Fresh install (no data).** login → `/auth/me` → `setupRequired: true` → **Setup Wizard**: stepper Organization → Branch → Academic Year → Finalize, driven by `setupStage` + `missingResources`, with the permitted calls listed by `allowedActions` → `POST /workspace/setup/complete` → success → app.

**F2 — Backend-scoped role** (STAFF/STUDENT/PARENT/BRANCH_ADMIN). login → `/auth/me` → no selection screen → straight to dashboard. Scope shown read-only in the top bar.

**F3 — One org, one branch, one year (privileged user).** Selection screen renders with all three pre-selected; the user presses **Continue**. (`alwaysShowSelection: true` — a deliberate choice: the alternative saves a click and never shows the user the scope every later request runs in.)

**F4 — One org, many branches.** Org pre-selected and locked-looking → Branch required → Year cascades → Continue.

**F5 — Many orgs, many branches.** Organization → (branch list repopulates) → Branch → (year list repopulates) → Year → Continue. Downstream selections **must clear** when a parent changes.

**F6 — Switching from inside the app.** Scope pill in the top bar → popover with three cascading selects → Apply → inline "Switching…" → queries invalidate → same page re-renders in the new scope. Confirm **only** if unsaved work exists.

**F7 — 409 `CONTEXT_SELECTION_REQUIRED`.** A scoped request without a resolvable scope returns the candidate lists in `error.details`. The shell should intercept this specific code and open the switcher pre-populated with those candidates — never show a raw error.

**F8 — Organization with no branches.** Resolves to an organization-only scope. Branch-required screens must say *"this organization has no branches yet"* and link to branch creation — not show an error.

**F9 — Unavailable.** Privileged user with zero organizations → `WorkspaceUnavailable` explaining what an administrator must create.

---

# PART 10 — Workspace Screen Inventory

### Backed by real endpoints (design these)

| # | Screen / surface | Endpoint(s) | Role |
| :-- | :-- | :-- | :-- |
| 1 | Workspace Selection | `/auth/me` | SUPER/ORG admin |
| 2 | Workspace Switcher (top-bar popover) | client store | privileged |
| 3 | Setup Wizard (4 steps) | `/workspace/setup/status`, `/complete`, org/branch/year creates | SUPER/ORG admin |
| 4 | Workspace Overview | `/workspace`, `/auth/me`, `/health` | admins |
| 5 | Navigation — Modules list | `GET /admin/navigation/modules` | SUPER_ADMIN |
| 6 | Navigation — Module create/edit | `POST`/`PATCH /modules` | SUPER_ADMIN |
| 7 | Navigation — Menu tree editor | `GET /menus`, `move`, `reorder` | SUPER_ADMIN |
| 8 | Navigation — Menu create/edit | `POST`/`PATCH /menus` | SUPER_ADMIN |
| 9 | Navigation — Menu detail drawer | `GET /menus/:id` | SUPER_ADMIN |
| 10 | Workspace Configuration (layer editor) | `POST /workspace/configuration` | SUPER_ADMIN |
| 11 | My Preferences (device-local) | none | every user |
| 12 | System Health panel | `/live`, `/ready`, `/health` | admins |
| 13 | Workspace Unavailable | `/auth/me` | privileged |

### Dialogs / drawers / overlays
D1 Deactivate module (names affected menu count) · D2 Delete module (blocked-state explainer) · D3 Delete menu (blocked while children exist) · D4 Move menu (parent+module picker, depth/cycle rules stated) · D5 Duplicate menu confirm · D6 Menu status change · D7 Switch-with-unsaved-changes guard · D8 Complete-setup confirm · D9 Config layer upsert warning (merge semantics) · D10 Command palette (⌘K, from `searchKeywords`).

### States (every screen)
Loading (skeleton) · Empty · Error (`ApiErrorState`, branches on `ApiError.kind`) · Forbidden · Offline · Setup-required · Scope-unresolved (409 interception).

### Not designable — no endpoint
Workspace Members · Workspace Activity · Workspace-scoped Audit · Theme Builder · Widget gallery · Workspace templates/cloning/import/export/backup · Workspace analytics/usage/health-per-workspace.

---

# PART 11 — Future-Ready Architecture

## Current backend capabilities (exhaustive — 25 endpoints)
`GET /v1/workspace` · `POST /v1/workspace/configuration` · `GET /v1/workspace/navigation` · `GET /v1/workspace/setup/status` · `POST /v1/workspace/setup/complete` · 6 module admin · 8 menu admin · 3 health probes · plus `GET /auth/me` as the bootstrap read.

## Future enhancements — **none of these exist; do not design as functional**

| Capability | What is missing |
| :-- | :-- |
| Widget engine / dashboard builder / marketplace | No widget entity, no endpoint |
| Theme builder, accent colours, white-label branding | No theme entity; only a `theme` string in a JSON blob |
| Layout presets, compact mode as a saved setting | No schema |
| User-writable preferences | Config write is Super-Admin-only; **no GET at all** |
| Favourites, pinned, recent items | No schema |
| Workspace templates / cloning / import / export / backup | No workspace entity to clone |
| Workspace analytics, usage, health, insights | No endpoint |
| Workspace members & roles per workspace | Membership is a User field, not a workspace relation |
| Menu builder drag-and-drop persistence beyond reorder/move | `PUT /reorder` + `PATCH /move` are the primitives — a full visual builder is UI work on top, not new API |
| Named workspaces | **A workspace is a coordinate, not a record** — this is a schema change, not a UI feature |

**Design so these drop in later:** keep the navigation renderer driven by the server tree (icons by name, badges by string, status by enum) so a menu builder needs no shell change; keep preference reads behind the existing `workspace-settings` seam so a future server-owned settings endpoint is a one-line swap; keep widgets as a grid of typed components fed by a data shape, not by an endpoint.

---

# PART 12 — Design Recommendations

**References that fit this problem:** Azure/AWS Console for the scope switcher (a persistent, always-visible scope pill — never a hidden setting), Linear for the command palette and switching speed, Atlassian for the admin/product split, Microsoft 365 for the setup wizard.

1. **The scope is chrome, not a page.** A persistent pill in the top bar — `Org › Branch › Year` — that opens the switcher. It is the answer to "where am I?", which in a multi-tenant ERP must never require navigation to discover.
2. **Switch without unmounting.** Invalidate, don't reload.
3. **Cascade forward, clear backward.** Changing organization clears branch and year, visibly.
4. **Admin navigation is a tree, not a table.** Use the existing `TreeView` (it already owns the four states and the `role="tree"` wiring) with drag-to-reorder mapping to `PUT /reorder`, and an explicit **Move** dialog for cross-parent moves — because the server validates cycles and depth, and a rejected drag is a worse experience than a dialog that states the rules up front.
5. **Show the pipeline in the admin UI.** Each menu row should show *why* it is or is not visible: module active? status? permissions? That is the whole mental model, and it is invisible otherwise.
6. **Setup is a stepper, driven by the server.** `setupStage` selects the step; `allowedActions` is a route table the client must not hard-code.
7. **Responsive:** switcher becomes a bottom sheet under `md`; the menu tree becomes a single-column list with an explicit "Move" action instead of drag.
8. **Accessibility:** the switcher is a `Popover` with a labelled combobox per level; announce scope changes via an `aria-live` region; the tree keeps arrow-key traversal.
9. **Motion:** 150–200 ms fades only. A scope switch should feel like a filter, not a navigation.
10. **Never a dead control.** Anything unbacked ships with `BackendPendingNote`.

---

# PART 13 — Workspace Module — Stitch UI Specification

## Design language (inherit; do not invent)
Soft Enterprise: `Card`-grouped sections with `border-b` headers · shadcn/Radix primitives · semantic tokens only (`bg-primary`, `text-muted-foreground`, `var(--elevation-md)`) · Tailwind v4 · mobile-first 320→1920 · sidebar + top-nav shell · `DataTable`/`TreeView` for collections · `DetailDrawer` for records · `ConfirmDialog` for consequence · `StatCard` for metrics · `StatusBadge` for enums · `EmptyState`/`LoadingState`/`ApiErrorState` for the three non-happy states.

## Navigation hierarchy to design

```
App Shell
├─ Top bar: [Logo] [Scope pill ▾] [⌘K search] [Health dot] [Bell] [Avatar ▾]
│   ├─ Scope pill      → Workspace Switcher popover  (S2)
│   ├─ ⌘K              → Command palette             (S13)
│   └─ Avatar          → My Preferences              (S11)
├─ Sidebar: server-driven tree (GET /workspace/navigation)
└─ Administration ▸ Workspace
    ├─ Overview            (S4)
    ├─ Navigation ▸ Modules (S5, S6)
    ├─ Navigation ▸ Menus   (S7, S8, S9)
    ├─ Configuration        (S10)
    └─ System Health        (S12)

Pre-app (outside the shell)
├─ Workspace Selection      (S1)
├─ Setup Wizard             (S3)
└─ Workspace Unavailable    (S14)
```

## Screens — design in this exact order

### Phase 1 — the entry path (design first; nothing works without it)

**S1 · Workspace Selection** — centred card on a brand panel; three cascading `SelectField`s (Organization → Branch → Academic Year) with counts per option; a summary strip showing the composed scope; `Continue` (disabled until valid); `Sign out` secondary. States: loading skeleton · no organizations (→ S14) · org with no branches (inline note + link) · error.

**S2 · Workspace Switcher popover** — anchored to the scope pill: current scope header, three cascading selects, recent scopes list *(client-local — label it)*, `Apply` / `Cancel`. Under `md`: bottom sheet. Include the "switching…" inline state and the unsaved-changes guard (D7).

**S3 · Setup Wizard** — 4-step stepper (Organization · Branch · Academic Year · Finalize) driven by `setupStage`; left rail shows `completedResources` ticked and `missingResources` pending; each step embeds the module's own create form; Finalize summarises all three and calls `/setup/complete`; blocked state explains `SETUP_INCOMPLETE`. Success screen → Enter workspace.

**S4 · Workspace Overview** — page header with scope caption; row of `StatCard`s (Organizations · Branches · Academic Years · Visible menus from `metadata.totalVisibleMenus`); Active Scope `DescriptionList`; **System Health card** (S12 condensed); Setup status card (hidden once complete); client metadata strip (`clientApp` / `clientVersion` / `platform`).

### Phase 2 — navigation administration (the largest greenfield surface)

**S5 · Modules list** — `DataTable`: Order · Icon · Code · Name · Menu count · System badge · Active switch · row menu (Edit / Toggle / Delete). Toolbar: search + active filter. Delete disabled with reason when menus exist.

**S6 · Module create / edit** — `Form` card: `code` (uppercase-underscore validated), `name`, `description`, `icon` (icon picker), `displayOrder`. System modules render code read-only.

**S7 · Menu tree editor** — the centrepiece. Left: `TreeView` of modules → menus (≤3 levels), drag-to-reorder within a parent (→ `PUT /reorder`), depth ruler, status chips. Right: selected-node summary + actions (Edit · Move · Duplicate · Status · Delete). Toolbar: module filter, status filter, search. Each row shows a **visibility indicator** with a tooltip naming the reason (module inactive / status not renderable / permission required).

**S8 · Menu create / edit** — cards: Identity (`code`, `displayName`, `route`, `componentIdentifier`) · Placement (`moduleId`, `parentId`, `displayOrder`) · Presentation (`icon`, `tooltip`, `description`, `badge`) · Access (`permissions[]` multi-select, `permissionMode` ALL/ANY radio) · Discovery (`searchKeywords[]` chips, `helpUrl`, `documentationUrl`) · Status. Inline rule notes: max depth 3, unique route, system-protected.

**S9 · Menu detail drawer** — full `DescriptionList`, resolved ancestry breadcrumb, children count, permission chips, and a "who sees this" explainer.

**S10 · Workspace Configuration (layer editor)** — scope picker (`scopeType` select + contextual `scopeId` picker: org list / branch list / role enum / user id / none for PRODUCT); two JSON editors with known-key helpers (`sidebarCollapsed`, `themeMode`, `defaultRoute`, `denseMode`, `theme`, `locale`); a **merge-order diagram** showing where this layer sits; prominent `Banner`: *no read endpoint exists — this upserts and merges into any existing layer for this scope*.

### Phase 3 — personal and operational

**S11 · My Preferences** — theme (light/dark/system), density, sidebar default, remembered workspace toggle. Caption: *stored on this device*. Every control that maps to a Super-Admin-only server layer is marked.

**S12 · System Health** — three probe cards (Process `/live` with uptime · Database `/ready` · Memory `/health` heap), status dots, last-checked, 30 s polling, manual `Refresh`, and a designed **degraded/503 state** — this panel matters most when everything else is broken.

**S13 · Command palette (⌘K)** — searches the navigation tree by `displayName` + `searchKeywords`, grouped by module, keyboard-first, with recent items *(client-local)*.

**S14 · Workspace Unavailable** — explains that no organization is available and what an administrator must create.

## Shared components

**Reuse (exist today):** `DataTable` + toolbar + pagination + column header · `TreeView` · `StatCard` · `StatusBadge` · `DescriptionList` · `DetailDrawer` · `ConfirmDialog` · `EmptyState` · `LoadingState` · `ApiErrorState` · `ForbiddenState` · `OfflineState` · `Banner` · `BackendPendingNote` · `Skeletons` · `Form` + `TextField`/`SelectField`/`SwitchField`/`TextareaField` · `Tabs` · `Sheet` · `Popover` · `DropdownMenu` · `Command` · `Breadcrumb` · `Progress` · `Avatar` · `Badge`.

**New for this module (7):**
1. `ScopePill` — top-bar `Org › Branch › Year` trigger
2. `WorkspaceSwitcher` — cascading three-level popover / bottom sheet
3. `MenuStatusBadge` — 6 states, tone-mapped (ACTIVE success · BETA info · COMING_SOON/DISABLED neutral · HIDDEN/DEPRECATED muted)
4. `MenuVisibilityIndicator` — renders the pipeline verdict + reason
5. `IconPicker` — name→component map with unknown-name fallback
6. `SetupStepper` — server-stage-driven progress rail
7. `HealthProbeCard` — probe status + uptime + failure state

## Screen count
**14 screens · 10 overlays · 7 new components.** Screens 1–10 and 12–14 are endpoint-backed; S11 is explicitly device-local and labelled as such.

## User journeys to storyboard
1. First-ever login on an empty system → wizard → first dashboard.
2. Super Admin with 3 orgs → selection → switch to another org mid-session.
3. Super Admin adds a "Hostel" module + 3 menus → sees them appear in their own sidebar.
4. Branch Admin logs in → no selection screen → scope shown read-only.
5. Database goes down → health card degrades → `/ready` 503 → user sees a truthful state, not a spinner.

---

## Appendix — endpoint verification table

| Endpoint | Method | Guards | Exists |
| :-- | :-- | :-- | :-- |
| `/v1/workspace` | GET | JWT + context | ✅ |
| `/v1/workspace/configuration` | POST | SUPER_ADMIN + `Settings.Manage` | ✅ |
| `/v1/workspace/navigation` | GET | JWT | ✅ |
| `/v1/workspace/setup/status` | GET | SUPER/ORG admin, `@AllowDuringSetup` | ✅ |
| `/v1/workspace/setup/complete` | POST | SUPER_ADMIN, `@AllowDuringSetup` | ✅ |
| `/v1/admin/navigation/modules` | GET·POST | SUPER_ADMIN + `Settings.Manage` | ✅ |
| `/v1/admin/navigation/modules/:id` | GET·PATCH·DELETE | ″ | ✅ |
| `/v1/admin/navigation/modules/:id/status` | PATCH | ″ | ✅ |
| `/v1/admin/navigation/menus` | GET·POST | ″ | ✅ |
| `/v1/admin/navigation/menus/:id` | GET·PATCH·DELETE | ″ | ✅ |
| `/v1/admin/navigation/menus/:id/move` | PATCH | ″ | ✅ |
| `/v1/admin/navigation/menus/:id/status` | PATCH | ″ | ✅ |
| `/v1/admin/navigation/menus/:id/duplicate` | POST | ″ | ✅ |
| `/v1/admin/navigation/menus/reorder` | PUT | ″ | ✅ |
| `/live` · `/ready` · `/health` | GET | `@Public`, `@SkipThrottle`, version-neutral | ✅ |
| Workspace GET configuration / list / delete | — | — | ❌ does not exist |
| Widgets · themes · members · activity · favourites | — | — | ❌ do not exist |
