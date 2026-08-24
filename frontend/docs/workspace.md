# Workspace Scope Platform

Every ERP screen operates inside a scope: one **organization**, one **branch**
("campus"), one **academic year**. This page documents where that scope comes
from, who decides it, and how every other module reads it.

> **Status.** Wired to `GET /auth/me`. The selection screen, the resolution
> policy, the persisted scope and the request headers all ship. The workspace
> _switcher_ (changing scope from inside the app) is not built yet — but it
> needs no new platform, only a new surface onto the one described here.

## The split that matters

| Layer                | Owns                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `core/workspace`     | _Which_ scope is active, and whether the user gets to choose.    |
| `features/workspace` | _Fetching_ `/auth/me`, normalizing it, and rendering the choice. |

Everything downstream consumes the core layer and never the feature:

```ts
import { useWorkspace } from "@/core/workspace";

const { organization, branch, academicYear } = useWorkspace();
```

That is the whole consumer API. No fetching, no props, no prop-drilling from the
selection screen — which is what lets the future switcher, the dashboard, the
dynamic menu and module filtering all agree on one answer.

## Flow

```
login  →  /workspace  →  GET /auth/me  →  resolveWorkspaceAccess()
                                             ├── ready       → /app
                                             ├── selecting   → selection screen  → Continue → /app
                                             └── unavailable → empty state
```

`useLogin` does **not** decide this. It calls `resolvePostAuthRoute()`, which at
sign-in returns `/workspace` because the scope is still `idle`. The workspace
route resolves it, and the app is entered the moment the scope becomes `ready` —
immediately for a backend-scoped role, and on **Continue** for everyone who is
entitled to choose.

There is exactly one navigation owner per step, and no step decides twice:

| Step                       | Decided by                              |
| -------------------------- | --------------------------------------- |
| where sign-in leads        | `resolvePostAuthRoute()`                |
| whether the scope is ready | `resolveWorkspaceAccess()`              |
| when to leave the screen   | `useWorkspaceRedirect` (on `ready`)     |
| guarding `(app)`           | `RequireWorkspace` (back to the screen) |

## Resolution policy

`core/workspace/workspace-policy.ts` is pure, total, and the only place these
rules exist. In order:

1. **Nothing to enter.** No organizations and no default scope → `unavailable`,
   with a reason naming the level that came up empty
   (`no-organizations` · `no-branches` · `no-academic-years`).
2. **Not the user's decision.** Roles outside `ROLES_REQUIRING_SELECTION`
   (`SUPER_ADMIN`, `ORG_ADMIN`) are scoped by the backend: their `context` is
   taken as-is and they go straight to the app. A teacher does not pick which
   campus they teach at.
3. **Nothing worth asking.** Only when `canSkipSelection()` says so — see
   [the setting](#the-always-show-setting) below. Under the shipped policy it
   never does.
4. **Otherwise** — `selecting`.

### The always-show setting

`workspace-settings.ts` holds the one flag that governs rule 3:

```ts
alwaysShowSelection: true; // shipped default
```

**On (today).** Everyone entitled to choose sees the screen, including a
single-tenant user whose organization, campus and year are all pre-answered for
them. They read the scope they are about to work in and press **Continue**. The
login experience is then identical for every such user, and the scope every
subsequent request carries is something they were shown rather than something
that happened to them.

**Off.** Rule 3 restores the pass-through: one organization, one campus and one
year resolve to `ready` and the screen is never rendered.

The flag governs _only_ the case with a single possible answer. It can never
choose on behalf of a user who has alternatives, and it does not reach
backend-scoped roles at all — rule 2 settles those first, so turning it on does
not start asking teachers which campus they teach at.

It is read through a get/set seam (`getWorkspaceSelectionPolicy` /
`setWorkspaceSelectionPolicy`) rather than a constant, so when workspace settings
become server-owned the bootstrap sets it once from the backend response and no
call site moves. The resolver itself stays pure — it takes the policy as an
argument; the **store** is the impure edge that reads the seam, exactly as it
already does for `WorkspaceStorage`.

Because publishing availability no longer resolves anything by itself, `confirm()`
is now the only path to `ready` for a choosing user — and therefore the only
thing that persists a selection. An offer is not a choice.

### Seeding

The selection is seeded in priority order, then clamped to what is actually on
offer:

```
remembered selection  →  backend `context`  →  nothing
```

The backend's `context` is a **default, not a command**: with two organizations
available, a complete default still leads to the selection screen, because the
user is entitled to pick the other one. A remembered id that the backend no
longer offers is discarded rather than trusted — permissions change.

### Cascading

`narrowSelection` is the single filtering implementation. Changing organization
re-settles branch and year beneath it, dropping anything that belonged to the
previous organization. Any level with exactly one option auto-fills.

A branch or year with a `null` scope link is treated as **in scope everywhere**,
so a backend that already filtered server-side and omitted the link still
renders its options instead of an empty list.

## State

| Where                | What                                                   | Lifetime    |
| -------------------- | ------------------------------------------------------ | ----------- |
| TanStack Query       | the `/auth/me` payload                                 | cache       |
| `useWorkspaceStore`  | normalized entities + the three selected ids + status  | session     |
| `WorkspaceStorage`   | the three ids only                                     | Web Storage |
| `workspace-settings` | `alwaysShowSelection`                                  | process     |
| `SessionContext`     | a mirror of the active ids, for its existing consumers | session     |

The store is deliberately **module-level rather than React state**, because two
different consumers need the same value: components (via `useWorkspace`) and the
API layer's header providers, which are plain functions with no component
context. One store means those cannot disagree about which branch a request
belongs to.

Only the three ids are persisted. The entities behind them are server-owned and
re-fetched on every sign-in, so a renamed branch or a revoked organization can
never be served from a stale cache.

### Status

| Status            | Meaning                                                    |
| ----------------- | ----------------------------------------------------------- |
| `idle`            | nothing loaded; the app cannot decide anything yet          |
| `setup-required`  | the installation has not finished initial bootstrap         |
| `selecting`       | a real choice exists and the user has not resolved it       |
| `ready`           | a complete scope is active; scoped screens may render       |
| `unavailable`     | authenticated, but no scope can be formed at all             |

`setup-required` is decided by `setAvailability` before `resolveWorkspaceAccess`
ever runs, and only for a role entitled to run setup (`ROLES_REQUIRING_SELECTION`
— the same two roles that choose their own scope here). A fresh install has zero
organizations, which `resolveWorkspaceAccess` would otherwise read as
`unavailable`; that reading is only correct once bootstrap is done. Every other
role falls through to ordinary resolution unchanged, setup or not. See
[`workspace-setup-module.md`](./workspace-setup-module.md) for the wizard this
status routes to.

## Headers

`registerWorkspaceHeaders()` points the platform's placeholders at the active
scope:

| Header            | Source                     |
| ----------------- | -------------------------- |
| `X-Tenant-Id`     | `selection.organizationId` |
| `X-Branch-Id`     | `selection.branchId`       |
| `X-Academic-Year` | `selection.academicYearId` |

Scope headers are sent **only once the scope is `ready`**. A half-made selection
is a UI state, not an operating scope, so letting it reach the wire would have
requests answered against a branch the user never confirmed.

`X-Workspace-Id` is deliberately left as the platform's `null` placeholder — the
backend's scope is the organization/branch/year triple, and there is no fourth
id to send.

## Providers and guards

```
SessionProvider
  AuthProvider
    PermissionProvider
      WorkspaceProvider   ← headers + session mirroring
```

`WorkspaceProvider` holds no state of its own. It registers the headers, mirrors
the active scope into `SessionContext`, and renders its children.

| Guard                     | Question                          | Group                          |
| ------------------------- | ---------------------------------- | ------------------------------- |
| `ProtectedRoute`          | is the visitor signed in?          | `(app)`, `(workspace)`, `(setup)` |
| `RequireWorkspace`        | signed in _where_?                 | `(app)` only                    |
| `RequireSetupIncomplete`  | is bootstrap genuinely in progress? | `(setup)/setup/(wizard)` only  |

The `(workspace)` group is guarded by `ProtectedRoute` **only** — gating the
screen that resolves the scope behind the scope would send it to itself. The
same reasoning keeps `RequireSetupIncomplete` out of `(setup)`'s outer layout —
see [`workspace-setup-module.md`](./workspace-setup-module.md).

## The identity endpoint

`GET /auth/me` carries three things at once: who the user is, what they may do,
and which scopes they may operate in.

```jsonc
{
  "user": { "id": "…", "fullName": "…", "role": "SUPER_ADMIN" },
  "permissions": [ … ],
  "context": { "organizationId": "…", "branchId": "…", "academicYearId": "…" },
  "availableOrganizations": [ … ],
  "availableBranches": [ … ],
  "availableAcademicYears": [ … ]
}
```

Only `user.id` and each entity's `id` are treated as guaranteed. Everything else
is optional in `types/identity.dto.ts` and defaulted in the mapper, because the
payload is shaped by the caller's role: a branch administrator's response
legitimately omits the organization list a super administrator gets. Typing
those as required would turn a normal response into a runtime crash.

### What it fixes

Login returns only tokens, so before this endpoint `AuthUser` was built from the
access token's claims with two honest gaps — `name` fell back to the email, and
`permissions` was empty, so every `can()` check failed closed. `/auth/me` closes
both: `useWorkspaceBootstrap` publishes the real user into `core/auth` and the
scopes into `core/workspace`.

`email` is the one field the endpoint may not carry, so the mapper falls back to
the claim-derived user rather than blanking it.

Permissions are read tolerantly — plain strings, or objects carrying the value
under `code`/`name`/`permission`. Anything unreadable is dropped, leaving
`can()` failing closed, which is the safe direction.

## Screen

`/workspace` renders one of five outcomes:

| Outcome     | UI                                                     |
| ----------- | ------------------------------------------------------ |
| loading     | `SelectionSkeleton`                                    |
| failed      | `ApiErrorState` — retry only when retrying could work  |
| unavailable | `EmptyState` naming the empty level + contact an admin |
| ready       | `LoadingState` while the redirect is in flight         |
| selecting   | the three-step form                                    |

The card's heading is the page `<h1>` ("Choose your workspace"). The greeting on
the brand panel is `lg`-and-up only, and a heading that disappears on a phone is
not a heading.

### The three steps

| Step          | Control     | Why                                                      |
| ------------- | ----------- | -------------------------------------------------------- |
| Organization  | `Select`    | one line of text is all it needs                         |
| Campus        | radio cards | the choice with the most consequence, so it shows detail |
| Academic year | `Select`    | same shape as organization, so it shares the component   |

Campus cards are `<label>`s wrapping visually hidden `<input type="radio">`s
inside a `<fieldset>`. That buys roving focus, arrow-key navigation and correct
group announcement from the platform, none of which a grid of `<button>`s would
have without re-implementing them.

Continue stays **enabled** while the selection is incomplete: a disabled button
says something is wrong without saying what. Pressing it names the missing level
and moves focus to it.

### No React Hook Form

The other forms in the app own their values; this one does not — the selection
lives in the store, and cross-field validity is decided by the resolution
policy. So the Zod schema validates (`validateWorkspaceSelection`, checked
against the offered options and reporting only the first gap) and nothing binds.

## Shared state platform

Workspace selection is the first consumer of a set of states every ERP module
will need. They live in `shared/components/feedback` and carry no domain:

| Component                                                                                | Use                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| `StatusState`                                                                            | the primitive all of the below compose      |
| `EmptyState` · `ErrorState`                                                              | no data · something broke                   |
| `ApiErrorState`                                                                          | **the** `ApiError.kind` → UI mapping        |
| `InlineError`                                                                            | a failure inside a region, not replacing it |
| `ForbiddenState` · `OfflineState`                                                        | refused · unreachable                       |
| `PageSkeleton` · `CardSkeleton` · `TableSkeleton` · `FormSkeleton` · `SelectionSkeleton` | loading shapes                              |
| `SkeletonRegion`                                                                         | the a11y wrapper for a bespoke skeleton     |

`ApiErrorState` is the only place the platform decides what a 403 looks like as
opposed to a network failure — including whether retry is offered at all, since
re-running a refused request only produces the same refusal. Modules render
`<ApiErrorState error={query.error} onRetry={query.refetch} />` rather than each
re-deciding.

Skeletons put a single `role="status"` with `aria-busy` on the region and hide
the bars, so a screen reader announces "Loading students" once instead of
reading out a dozen meaningless boxes.

`BrandMark` and `BrandCanvas` were promoted from `features/auth` into
`shared/components/brand` when workspace selection became the second surface to
open on them — cross-feature needs move up, they are never imported sideways.

## Sign-out

The scope is cleared with the session in three places, because it outlives the
session in storage and would otherwise hand the next person to sign in on that
machine the previous user's campus:

- `useLogout` (explicit sign-out),
- `AuthIntegration`'s session-lost path (unrecoverable 401),
- `useWorkspaceStore.clear()` directly.

`SignOutButton` ships from `features/auth` and is composed into the workspace
screen's `sessionActions` slot **by the route** — the two features may not
import each other, but a route may import both.

## Responsive behavior

Mobile-first, no fixed layout widths, no horizontal scroll from 320 → 1920px.
The screen reuses `AuthSplitLayout` with a widened content cap (`max-w-2xl`) so
the campus grid has room.

| Width          | Layout                                                      |
| -------------- | ----------------------------------------------------------- |
| 320–639        | Single column; brand panel not rendered; campus cards stack |
| 640 (`sm`)–up  | Campus cards pair up; card padding steps up                 |
| 1024 (`lg`)–up | Two columns: brand panel + content column, 50/50            |

## Accessibility

- One `<h1>` naming the page's task.
- Select triggers use `aria-labelledby="<label> <trigger>"`, so the accessible
  name resolves to "Organization, Universal Educational Trust" — the field _and_
  its current answer.
- The campus group is a real `<fieldset>`/`<legend>` over native radios.
- The context summary is `aria-live="polite"`: it changes as a _consequence_ of
  each choice rather than in response to it, which is exactly the kind of change
  a screen-reader user would otherwise never learn about.
- An incomplete Continue moves focus to the level that needs answering.
- Empty results carry no `role="alert"` (nothing happened); failures do.

## Tests

| File                                             | Covers                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `tests/unit/workspace-policy.test.ts`            | filtering, cascading, every resolution branch, both settings, post-auth route    |
| `tests/unit/workspace-store.test.ts`             | seeding, cascade, confirm/persist, clear, both settings                          |
| `tests/unit/identity-mapper.test.ts`             | normalization, tolerance, permission and name fallbacks                          |
| `tests/unit/workspace-selection-schema.test.ts`  | validation order and membership re-checking                                      |
| `tests/integration/workspace-selection.test.tsx` | loading, cascade, guard, single-workspace confirmation, skip, unavailable, retry |
| `tests/integration/feedback.test.tsx`            | the shared state platform, including `ApiErrorState` kinds                       |
| `tests/integration/workspace-setup-redirect.test.tsx` | `setup-required` routing from this screen, and the no-setup-authority/regression cases |

`GET /auth/me` is mocked at the network boundary in
`tests/mocks/workspace-handlers.ts`; identities are built with
`tests/fixtures/workspace.ts`.

## What has landed since

1. **Workspace switcher** — shipped in `features/navigation`, calling `select()`
   - `confirm()` exactly as anticipated. It required **no platform change**,
     which was the point of the seam. It appears in the sidebar footer and, from
     `lg` up, in the header. See [Dashboard Shell](./dashboard-shell.md).
2. **Dashboard** — `features/dashboard` replaces the `/app` placeholder, reading
   its scope through `useWorkspace()` and nothing else.
3. **Initial setup wizard** — `setup-required` status and `features/workspace-setup`,
   covering the fresh-install case this module's own `unavailable`/
   `no-organizations` outcome could not distinguish from a genuinely
   misconfigured account. See [`workspace-setup-module.md`](./workspace-setup-module.md).

## What lands next

1. **Server-side scope enforcement** — `RequireWorkspace` is a client
   convenience; the backend is the authority via the headers above.
2. **Impersonation** — a second seed source ahead of the remembered selection.
