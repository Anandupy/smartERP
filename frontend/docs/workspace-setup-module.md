# Initial Setup Wizard

Scope: the first-run flow between authentication and ordinary workspace
resolution — `core/workspace`'s `"setup-required"` status, `features/workspace-setup`,
and the routes under `src/app/(setup)`. Orchestrates the existing System
Settings, Organization, Branch and Academic Year modules; owns no domain CRUD
of its own.

The backend contract this reads and writes is documented in
[`backend/docs/core/workspace-bootstrap.md`](../../backend/docs/core/workspace-bootstrap.md)
— that document is the source of truth for the lifecycle itself (stages,
idempotency, the `WorkspaceState` row, role authorization on each endpoint).
This document covers the frontend's integration with it.

## Why this exists

A fresh installation has no Organization, Branch or Academic Year, but the
existing `resolveWorkspaceAccess` policy (see [`workspace.md`](./workspace.md))
reads "zero organizations" as `unavailable` — the same outcome as an account
genuinely mapped to nothing. Before this module, a brand-new `SUPER_ADMIN`
landed on "No organizations assigned. Contact an administrator" with no way
forward, because nothing distinguished "this account has no access" from
"this installation has not been bootstrapped yet."

## The backend contract

`GET /auth/me` (and `GET /workspace/setup/status`) return a `setup` block:

```ts
interface WorkspaceSetupStatus {
  setupRequired: boolean;
  setupStage: "SYSTEM_SETTINGS" | "ORGANIZATION" | "BRANCH" | "ACADEMIC_YEAR" | "FINALIZE" | "COMPLETED";
  missingResources: SetupResource[];   // in creation order
  completedResources: SetupResource[];
  allowedActions: SetupActionDescriptor[];
  initializedAt: string | null;
}
```

Progress is **derived** by the backend from which resources exist; only the
terminal transition (`POST /workspace/setup/complete`) is persisted. The
frontend never computes readiness itself — every screen reads this block
(or, for routing, the `core/workspace` status it feeds — see below) and
nothing else.

**Mandatory foundation:** System Settings (`SUPER_ADMIN`-only), Organization,
one Branch, one Academic Year. **Explicitly not mandatory:** Programs and
Academic Units — the review screen and the completion screen both say so
rather than blocking on them.

## Where the decision is made

`toWorkspaceSetupStatus` (`features/workspace/mappers/identity.mapper.ts`)
normalizes the wire block into `core/workspace`'s `WorkspaceSetupStatus` type,
defensively: an unrecognized resource or stage is dropped rather than guessed,
and a missing/malformed `setupRequired` yields `null` — "no setup information
available," which falls through to ordinary resolution unchanged. This is what
keeps an older backend, or a response that genuinely omits the block, from
being a regression.

`useWorkspaceBootstrap` (`features/workspace`) publishes it into
`core/workspace`'s store in the same call as availability:

```ts
setAvailability(toWorkspaceAvailability(data), toWorkspaceSetupStatus(data));
```

`setAvailability` (`core/workspace/workspace-store.ts`) checks setup **first**,
ahead of `resolveWorkspaceAccess`:

```ts
if (setupStatus?.setupRequired && roleRequiresSelection(availability.role)) {
  // status: "setup-required" — resolveWorkspaceAccess never runs
}
```

`roleRequiresSelection` is the same `ROLES_REQUIRING_SELECTION` check the
workspace selection screen already used (`SUPER_ADMIN`, `ORG_ADMIN`) — the two
roles with initial-setup authority are exactly the two that choose their own
workspace scope. Every other role falls through to ordinary resolution even
while setup is required, and sees the pre-existing `unavailable` outcome —
this status change is additive, not a new restriction on anyone else.

Selection is still narrowed (`narrowSelection`), not reset to empty, so the
sole organization/branch/year created earlier in the same session resolves
through `useWorkspace()` exactly like the existing selection screen's
single-choice case — **without** marking the scope `ready`, persisting it, or
sending scope headers, all three of which still require `confirm()`, which
setup never calls.

## Routing

```
resolvePostAuthRoute(status)
  "ready"           → /app
  "setup-required"  → /setup
  otherwise         → /workspace
```

`useWorkspaceRedirect` (used by `WorkspaceSelectionScreen`) now fires on both
`"ready"` and `"setup-required"` — a fresh install redirects away from
`/workspace` before the selection screen would ever render "unavailable."

Route groups:

```
src/app/(setup)/
  layout.tsx                    ProtectedRoute + useWorkspaceBootstrap
  setup/
    (wizard)/
      layout.tsx                RequireSetupIncomplete
      page.tsx                  Welcome            /setup
      system-settings/page.tsx  SUPER_ADMIN only   /setup/system-settings
      organization/page.tsx     SUPER_ADMIN only   /setup/organization
      branch/page.tsx           SUPER_ADMIN|ORG_ADMIN  /setup/branch
      academic-year/page.tsx    SUPER_ADMIN|ORG_ADMIN  /setup/academic-year
      review/page.tsx                              /setup/review
    complete/page.tsx           outside (wizard)   /setup/complete
```

`RequireSetupIncomplete` sits on the **nested** `(wizard)` group, not the outer
`(setup)` layout, for one reason: completing setup flips `core/workspace`'s
status to `"ready"` while the user is still looking at `/setup/complete`. If
the completion screen were inside the guarded group, that transition would
redirect the user away from their own success screen. The outer layout still
mounts `useWorkspaceBootstrap()` so `/setup/complete` has fresh data (the
review step invalidates identity right before navigating there), but applies
no setup-specific gate — only `ProtectedRoute`.

Each resource step page also guards itself directly (`usePermissions().hasRole`)
and redirects to `/setup` if its own resource already exists, mirroring the
resumability contract: navigating straight to a finished step never re-shows
its form.

## Two paths, reflected in one wizard

**Path A** — `SUPER_ADMIN` does everything itself: System Settings →
Organization → Branch → Academic Year → Review → Complete.

**Path B** — `SUPER_ADMIN` provisions an `ORG_ADMIN` (the welcome screen's
"Prefer to delegate this setup?" panel, `ProvisionOrgAdminForm`, reusing the
existing `POST /users` with `role: "ORG_ADMIN"` — no separate identity system).
The `ORG_ADMIN` signs in, lands on the same `/setup`, and does Branch and
Academic Year themselves.

There is no second wizard for Path B — `buildSetupSteps(setup, role)`
(`features/workspace-setup/utils/setup-steps.ts`) computes, per role, which of
the four mandatory resources this signed-in user may act on
(`canActOnStage`), matching the backend's own `@Roles()` decorators exactly:

| Resource | `SUPER_ADMIN` | `ORG_ADMIN` |
| --- | --- | --- |
| System Settings | ✓ | — |
| Organization | ✓ | — |
| Branch | ✓ | ✓ |
| Academic Year | ✓ | ✓ |

An `ORG_ADMIN` blocked on a `SUPER_ADMIN`-only step sees a waiting state
("Waiting on your platform administrator") instead of a broken or hidden
link — `nextSetupHref` returns `null` in exactly that case, and the welcome
screen renders the banner instead of a Continue button.

### Organization creation stays `SUPER_ADMIN`-only

This is a deliberate departure from the most literal reading of "delegated
setup": the backend's `OrganizationController` requires `@Roles(SUPER_ADMIN)`
(it is "the one surface that sits above a tenant" — see the backend's own
comment), regardless of the `Settings.Manage` permission `ORG_ADMIN` otherwise
holds. The frontend does not work around this with a client-side permission
check; it reads the same authority the backend enforces. Path B therefore
means "the `SUPER_ADMIN` creates the Organization and the `ORG_ADMIN` scoped
to it, in either order — the `ORG_ADMIN`'s own work is Branch and Academic
Year," not "the `ORG_ADMIN` can create everything downstream of System
Settings."

### Completion is delegated too, once the `ORG_ADMIN` is resolved to an organization

`POST /workspace/setup/complete` is `@Roles(SUPER_ADMIN, ORG_ADMIN)` on the
backend: `SUPER_ADMIN` unconditionally, and an `ORG_ADMIN` once
`ExecutionContextGuard`'s bootstrap resolution has them scoped to exactly one
organization (`WorkspaceSetupService.markInitialized`'s `actor` check). This
was fixed from an earlier `SUPER_ADMIN`-only restriction that stalled Path B —
an `ORG_ADMIN` who did the actual Branch/Academic Year work had no way to
finish, only a platform administrator could. `canCompleteSetup`
(`setup-access.ts`) now allows both roles; the backend remains the actual
authority, and an `ORG_ADMIN` whose account somehow is not (yet) scoped to an
organization still gets a `403` from the endpoint itself, surfaced verbatim by
the review screen's existing error handling rather than a frontend guess.

## Programs and Academic Units are not wizard steps

They are optional by product decision (`SETUP_RESOURCES` never lists them),
and by backend contract they are **unreachable during setup** — neither
`ProgramController` nor `AcademicUnitController` carries `@AllowDuringSetup()`,
so the wizard could not offer them as in-flow steps even if it wanted to: the
create endpoints would answer `409 SETUP_REQUIRED` before `READY`. The review
screen names this plainly ("configure them from Programs and Academic Units in
the normal menu — whenever suits you") rather than presenting a step that
would fail if used, and the completion screen repeats it. This is also why the
Stitch reference screens' "Program Management" / "Academic Unit Builder" steps
are not reproduced here — copying that ordering would have shipped two steps
that 409 on first use.

## Provisioning an `ORG_ADMIN`

`ProvisionOrgAdminForm` (`features/workspace-setup`) calls `POST /users` with
`role: "ORG_ADMIN"` — the same endpoint and DTO `docs/user`-adjacent modules
would use, not a parallel one. `organizationId` is optional in the form
exactly as it is in `CreateUserDto`: `User.organizationId` is nullable with no
FK constraint, so an `ORG_ADMIN` can exist before an Organization does, and be
scoped to one afterward. The form offers the organization picker only when at
least one organization is already on offer (`useWorkspace().options.organizations`);
otherwise it is omitted rather than shown disabled.

## Reused, not duplicated

| Step | Reused component | Reused hook/mapper |
| --- | --- | --- |
| System Settings | `InitializeSettingsForm` (extracted from `InitializeSettingsDialog` so the dialog and the wizard step share one implementation) | `useInitializeSystemSettings`, `toInitRequest` |
| Organization | `OrganizationForm` | `useCreateOrganization`, `toOrganizationRequest` |
| Branch | `BranchForm` (including its own internal `useWorkspace()` call for the organization picker) | `useCreateBranch`, `toBranchRequest` |
| Academic Year | `AcademicYearForm` | `useCreateAcademicYear`, `toAcademicYearRequest` |

None of these forms know they are being rendered inside a wizard — each is the
exact component its own module's create screen uses, with the wizard supplying
only `defaultValues`, `onSubmit`, `onCancel` and the surrounding chrome
(`SetupShell`). `BranchForm` and `AcademicYearForm` in particular work
unmodified inside `/setup` because the `(setup)` layout mounts
`useWorkspaceBootstrap()` the same way `/workspace` does — the store they read
through `useWorkspace()` is kept live throughout the wizard, not just before
or after it.

## Keeping progress live without a second endpoint

Each step's own feature hook (`useCreateOrganization`, `useCreateBranch`, …)
only updates that feature's own cache. Since `core/workspace`'s `setupStatus`
comes from `/auth/me`, every step's `onSubmit` also invalidates identity
(`queryClient.invalidateQueries({ queryKey: identityKeys.all })`) before
navigating back to `/setup` — this is done at the **route composition** level
(each `src/app/(setup)/setup/(wizard)/*/page.tsx`), the one place allowed to
import both the domain feature and `features/workspace`, mirroring
`academic-units/program-composition.tsx`'s existing two-features-meet-at-the-
route pattern. `features/workspace-setup` itself never imports another
feature.

This is also why `features/workspace-setup` has no `GET /workspace/setup/status`
query of its own, even though the endpoint exists (and `features/workspace-admin`
already calls it for its non-blocking setup banner) — `/auth/me` already
carries the same block, one request the wizard was making anyway, so reading
progress from `useWorkspaceStore` avoids a second query against the same data
under a second contract.

## Completion

`SetupReviewScreen` calls `useCompleteSetup()` → `POST /workspace/setup/complete`
only when `setup.missingResources` is empty and `canCompleteSetup(role)` is
true (`SUPER_ADMIN` or `ORG_ADMIN`); otherwise it shows why not (missing
resources) instead of a disabled button with no explanation. A `409` from the
backend — another transition finished first, or a resource disappeared
between page loads — or a `403` — an `ORG_ADMIN` not resolved to an
organization — surfaces as the backend's own message and leaves the user on
the review screen; nothing here decides setup succeeded on its own.

On success, the review route invalidates identity and navigates to
`/setup/complete`, which reads the refreshed `useWorkspace()` data (the actual
organization/branch/year now on offer) rather than anything passed through
navigation state. Its one action, "Go to your workspace," is a plain link to
`ROUTES.workspace.root` — the existing workspace selection flow, unmodified,
decides what happens next (auto-forward to `/app` for a single-tenant
install, or the selection screen for a `SUPER_ADMIN` who now administers more
than one).

## Roles

| Role | Setup authority |
| --- | --- |
| `SUPER_ADMIN` | System Settings, Organization, Branch, Academic Year, `ORG_ADMIN` provisioning, completion |
| `ORG_ADMIN` | Branch, Academic Year (once an Organization exists), completion (once resolved to their own organization) |
| `BRANCH_ADMIN`, `STAFF`, `STUDENT`, `PARENT` | none — never routed to `/setup`; `setup-required` is never assigned for these roles (see "Where the decision is made") |

Frontend role checks here (`usePermissions().hasRole`, matching the
`workspace-admin` module's existing in-component pattern rather than a wrapper
component) are UX only, exactly as documented in AGENTS.md §17/§20. The
backend's own `@Roles()`/`@RequirePermission()` decorators are what actually
enforce every one of these boundaries; a stale or bypassed frontend check
still gets a `403` from the API.

## Tests

| File | Covers |
| --- | --- |
| `tests/unit/workspace-store.test.ts` | the `setup-required` short-circuit, auto-settling without persisting, fall-through for setupRequired: false and for a role with no setup authority, and the no-`setup`-published case (regression) |
| `tests/unit/identity-mapper.test.ts` | `toWorkspaceSetupStatus`: absent block, malformed `setupRequired`, unrecognized resource/stage dropped, malformed action dropped |
| `tests/unit/workspace-setup-steps.test.ts` | `canActOnStage`, `canCompleteSetup`, `roleCanAccessSetupWizard`, `buildSetupSteps` status derivation, `nextSetupHref` per role |
| `tests/integration/workspace-setup-redirect.test.tsx` | fresh-install redirect to `/setup` for `SUPER_ADMIN`/`ORG_ADMIN`, no redirect for a role without setup authority, and the READY-user regression (setup omitted, and setup explicitly complete) |
| `tests/integration/workspace-setup-wizard.test.tsx` | welcome screen's actionable-step link and waiting state, `ORG_ADMIN` provisioning end to end, and the review screen's finish (`SUPER_ADMIN` and `ORG_ADMIN`)/missing/409/403 outcomes |

## What lands next

1. **Programs/Academic Units "recommended next steps" with live counts** —
   currently static copy on review/complete, since both endpoints are
   unreachable until `READY` (see above); a `/setup/complete`-only follow-up
   read is possible once the workspace is ready.
2. **Server-side scope enforcement** remains the backend's job, exactly as
   [`workspace.md`](./workspace.md) already notes — every guard here is a
   client convenience.
