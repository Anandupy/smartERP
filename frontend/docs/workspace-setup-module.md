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

### Phone: the field CreateUserDto actually enforces

`CreateUserDto.phone` is validated with class-validator's `@IsPhoneNumber()`
called with no region argument, which requires **E.164** (`+<country
code><number>`) — a bare national number such as `9876543210` fails it, even
though it looks valid and is exactly what the DTO's own Swagger example
shows. Confirmed independently from the backend's own `POST /users` e2e
fixtures, which build `phone: '+9198' + …` with the comment "IsPhoneNumber()
with no region requires E.164."

The form used to send a single free-text `phone` field straight through and
hit this on every submission. The fix is `PhoneField`
(`components/form/fields/phone-field.tsx`) — the platform's first phone
input, since no other module in this codebase creates a `User` yet — backed
by two RHF fields (`phoneCountryCode`, defaulting to `+91`; `phoneNumber`,
digits only) that the schema's own `superRefine` combines and checks against
`isValidE164` (`@/lib/phone`) before the mapper joins them into the one
E.164 string the wire DTO expects. Two fields, not one the component
splits and rejoins on every keystroke, because parsing an opaque
`+919876543210` back into "which prefix is the country code" is ambiguous
without a country database this product does not have. India is the
default, not a restriction — the code field stays freely editable.

A backend `phone` field-error has nothing to bind to under this shape
(`applyProvisionOrgAdminFieldErrors` in the mapper), so it is redirected to
`phoneNumber` with the same combined-format message the client-side check
already shows, rather than silently vanishing the way a bare
`setError("phone", …)` would.

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

### The Academic Year step's branch: `useWorkspace()`, not `useAcademicYearBranch()`

The Academic Year step used to read its branch through
`useAcademicYearBranch()` (`features/academic-year`) — the same hook the
module's *own*, post-setup screens use. That hook is deliberately gated:

```ts
export function useAcademicYearBranch() {
  const { branch, isReady } = useWorkspace();
  return isReady ? branch : null;
}
```

`isReady` means `status === "ready"` — the status setup **never reaches**. It
stays `"setup-required"` throughout, by the same design that lets it
auto-settle a sole organization/branch without persisting or confirming it
(see "Where the decision is made" above). So the gate was never open during
setup, regardless of whether a branch existed: the step showed "Waiting on a
branch" even immediately after the stepper marked Branch complete, because
the two were reading through entirely different accessors, one of which
could never turn on inside the wizard. Not a caching bug, not a missing
invalidation — a hook written for a status this flow does not use.

The fix reads `useWorkspace().branch` directly, the same way the Branch and
Organization steps already read `useWorkspace().organization` — no `isReady`
gate, resolved straight from the current selection. `narrowSelection`
auto-settles that selection onto the sole branch the moment the Branch
step's `onSubmit` invalidates identity and `/auth/me` reports one, so the
Academic Year step sees it on the very next render, no refetch of its own and
no page reload required (`tests/unit/workspace-setup-branch-sync.test.ts`
proves this against the real hook, across the same `setAvailability` sequence
a live mutation produces). When more than one branch exists,
`useWorkspace().branch` stays `null` — a genuine choice, not a bug — and the
step now renders `WorkspaceSelectField` (`features/workspace`, composed at
the route rather than imported into `features/workspace-setup` — see
AGENTS.md §28's "meet at the route" rule) so the user picks one via
`select({ branchId })`.

### A second, smaller gap this exposed: `GET /academic-years` couldn't run during setup at all

Fixing the branch resolution surfaced a second issue one layer down:
`AcademicYearController`'s `POST` (create) carries `@AllowDuringSetup()`, but
its `GET` (list) — which the Academic Year step also calls, for the same
overlap-check `AcademicYearForm` always runs — did not. Every list request
made while `setupRequired: true` therefore 409'd with `SETUP_REQUIRED` before
`ExecutionContextGuard` even ran, regardless of the branch fix above. Same
shape as the `POST /system-settings/init` and `POST /v1/users` gaps §4 of
`docs/core/workspace-bootstrap.md` already documents — a route the bootstrap
flow genuinely needs, left off the allow-list by omission, not a security
decision. Fixed by adding `@AllowDuringSetup()` to `findAll`; `@Roles()` and
`@RequirePermission()` on that route are untouched, so who may call it is
exactly as before — only when.

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
navigation state. Its one action, "Continue to Workspace," is a plain link to
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
| `tests/integration/workspace-setup-wizard.test.tsx` | welcome screen's actionable-step link and waiting state, `ORG_ADMIN` provisioning end to end (valid/invalid/empty/backend-refused phone), and the review screen's complete (`SUPER_ADMIN` and `ORG_ADMIN`)/missing/409/403 outcomes |
| `tests/unit/workspace-setup-branch-sync.test.ts` | `useWorkspace().branch` resolving a newly-created branch across a second `setAvailability` call with no remount, and staying unresolved (picker required) when more than one branch exists |
| `tests/unit/stepper.test.tsx` | the responsive `Stepper`: mobile "Step X of Y" + progress bar, every label rendered in full, `aria-current` on the right item |

Backend: `test/unit/workspace-setup.service.spec.ts` (ORG_ADMIN completion
authorization) and `test/unit/academic-year.controller.spec.ts`
(`GET /academic-years` carries `@AllowDuringSetup()`) live in the backend
workspace — see `backend/docs/core/workspace-bootstrap.md`.

## What lands next

1. **Programs/Academic Units "recommended next steps" with live counts** —
   currently static copy on review/complete, since both endpoints are
   unreachable until `READY` (see above); a `/setup/complete`-only follow-up
   read is possible once the workspace is ready.
2. **Server-side scope enforcement** remains the backend's job, exactly as
   [`workspace.md`](./workspace.md) already notes — every guard here is a
   client convenience.
3. **In-wizard editing of a completed step** was not added: every step page
   still redirects straight back to `/setup` once its resource exists (the
   resumability contract — see "Routing" above), so a review-screen "Edit"
   link back to a finished step would only bounce the user, not show an
   editable form. Organization/Branch/Academic Year already have their own
   edit screens outside setup for this.
4. **Programs and Academic Units keep their own module UI** — the hierarchy
   builder, drag-and-drop parent/child editing, and similar depth stay in
   `features/program`/`features/academic-unit`'s own screens, unmodified by
   this pass; the wizard still only links out to them as optional, post-setup
   configuration.
