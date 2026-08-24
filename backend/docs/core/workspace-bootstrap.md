# Workspace Bootstrap

A fresh CampusFlow installation has no Organization, no Branch and no Academic
Year. Every authenticated endpoint is scoped by all three. The first
administrator therefore could not create the records the API required them to
already have — a bootstrap deadlock.

This document describes the explicit application state that resolves it.

---

## 1. The deadlock

```text
Fresh install
  → SUPER_ADMIN logs in                         ✅ (login is @Public)
  → GET /auth/me                                ❌ 400 "No active organization available for user."
  → POST /v1/organizations                      ❌ 400 (same)
```

`ExecutionContextGuard` resolved the tenant scope on every authenticated
request, and `ContextResolverService` treats an absent organization as an error.
That is correct for a live workspace and fatal for an empty one.

The fix is not to weaken the scope rules. It is to recognise that **a workspace
being set up is a different state from a workspace in service**, and to make
that state explicit.

---

## 2. The state

| Stage             | Meaning                                                    |
| :---------------- | :---------------------------------------------------------- |
| `SYSTEM_SETTINGS` | The platform-level singleton is uninitialized. Create it.  |
| `ORGANIZATION`    | No active organization exists. Create one.                |
| `BRANCH`          | An organization exists; no active branch. Create one.      |
| `ACADEMIC_YEAR`   | A branch exists; no academic year. Create one.             |
| `FINALIZE`        | All four exist. Setup awaits explicit completion.          |
| `COMPLETED`       | Bootstrap finished. The tenant-header contract applies.    |

`SYSTEM_SETTINGS` is first and SUPER_ADMIN-only: `SystemSettingsController` is
`@Roles(SUPER_ADMIN)` throughout, so it is the one stage that can never be
delegated to an ORG_ADMIN. Every stage after it can be, via the two paths
below. Programs and Academic Units are deliberately absent from this table —
they are real domain concepts but not part of the mandatory foundation; see
§8.

**Progress is derived, completion is persisted.**

Deriving the stage from the presence of the records means it can never drift
from the data. Persisting only the terminal transition means completing setup is
an explicit, attributable act, and that a workspace cannot silently fall back
into setup mode if its last branch is later deactivated.

The persisted state is one row in `workspace_state`, held to a single record by
a fixed `scope = 'GLOBAL'` unique key.

`WorkspaceSetupService.isInitialized()` latches in memory: completion is
irreversible, so caching it needs no invalidation. Steady state costs zero extra
queries per request.

---

## 3. The flow

Two paths reach `COMPLETED`. Both start the same way and both end the same
way; they differ only in who performs Organization/Branch/Academic Year.

```text
Fresh install
    │
    ▼
POST /auth/login                    @Public — always available
    │
    ▼
GET  /auth/me                       @AllowDuringSetup
    │  → { setup: { setupRequired: true, setupStage: "SYSTEM_SETTINGS",
    │               missingResources: [...], allowedActions: [...] } }
    ▼
POST /system-settings/init          @AllowDuringSetup, SUPER_ADMIN only
    │
    ├─── PATH A: SUPER_ADMIN completes setup itself ──────────────┐
    │                                                              │
    │    POST /v1/organizations   (SUPER_ADMIN only)               │
    │    POST /v1/branches                                         │
    │    POST /v1/academic-years                                   │
    │                                                              │
    └─── PATH B: SUPER_ADMIN delegates to an ORG_ADMIN ───────────┤
                                                                    │
         POST /v1/users  { role: "ORG_ADMIN",                     │
                            organizationId: <existing org, or omitted> }
             │  reuses the existing user-creation API — no separate
             │  OrgAdmin table or service. See §8.
             ▼
         ORG_ADMIN logs in, then:
             POST /v1/organizations   — only if SUPER_ADMIN did not already
             POST /v1/branches            create one; Organization creation
             POST /v1/academic-years      stays SUPER_ADMIN-only (§8)
                                                                    │
    ┌───────────────────────────────────────────────────────────┘
    ▼
POST /v1/workspace/setup/complete   @AllowDuringSetup, SUPER_ADMIN or ORG_ADMIN
    │  → setupStage: "COMPLETED"
    ▼
Normal operation — tenant headers now apply
```

`SUPER_ADMIN` may complete setup unconditionally. An `ORG_ADMIN` may complete
it too — Path B does not stall on a step only `SUPER_ADMIN` could take — but
only once resolved to exactly one organization; see §6.

`GET /v1/workspace/setup/status` returns the same payload at any point, so a
client that reloads mid-wizard can resume without replaying the flow — this is
what makes setup resumable: nothing about progress lives only in the frontend
or in memory (§1, §2).

---

## 4. What is blocked, and how

`WorkspaceSetupGuard` runs at position 2 in the guard pipeline — after
authentication, before context resolution. While the workspace is uninitialized
it rejects any route not marked `@AllowDuringSetup()`:

```json
{
  "error": "SETUP_REQUIRED",
  "message": "Workspace setup is incomplete. Complete the setup flow before using this endpoint.",
  "setupRequired": true,
  "setupStage": "BRANCH",
  "missingResources": ["BRANCH", "ACADEMIC_YEAR"],
  "allowedActions": [
    {
      "action": "CREATE_BRANCH",
      "method": "POST",
      "path": "/v1/branches",
      "…": "…"
    }
  ]
}
```

HTTP **409 Conflict**, matching the existing `CONTEXT_SELECTION_REQUIRED`
convention: the request is well-formed, but the system is in a state that must
be resolved first.

`allowedActions` is returned so a setup wizard does not have to hard-code the
bootstrap route table.

### `@AllowDuringSetup()` is not a security bypass

Authentication, `@Roles()` and `@RequirePermission()` all still apply to every
marked route. The decorator only exempts a route from the setup block — it
narrows what an already-authorised user can reach during bootstrap; it never
widens access. No fake IDs, no synthetic headers, no disabled guards.

Currently marked:

| Route                               | Why                                                    |
| :----------------------------------- | :------------------------------------------------------ |
| `GET /auth/me`                      | Where the client learns setup is required              |
| `GET /v1/workspace/setup/status`    | Wizard state                                            |
| `POST /v1/workspace/setup/complete` | Finalisation, `SUPER_ADMIN` or an `ORG_ADMIN` resolved to their own organization (§6) |
| `POST /system-settings/init`        | Stage 0, `SUPER_ADMIN` only (§2)                        |
| `GET`/`PATCH /system-settings`      | So SUPER_ADMIN can review/adjust it mid-setup           |
| `POST /v1/users`                    | ORG_ADMIN provisioning (Path B) and further delegation  |
| `POST /v1/organizations`            | Stage 1 (`SUPER_ADMIN` only — see §8)                   |
| `POST /v1/branches`                 | Stage 2                                                 |
| `POST /v1/academic-years`           | Stage 3                                                 |
| `GET /v1/academic-years`            | So the Stage 3 UI can check the branch's existing years before creating one — see below |

Before this, `POST /system-settings/init` had **no** `@AllowDuringSetup()` —
on a fresh database SUPER_ADMIN could not reach it at all, blocked by the very
gate this document describes. That was a live bug, not a missing feature: the
one platform-level action every install needs first was unreachable until an
Organization, Branch and Academic Year already existed, which is impossible
without it. Fixed alongside adding `SYSTEM_SETTINGS` to the resource list.

`POST /v1/users` was similarly unreachable during setup before this change,
which made Path B (§8) impossible — SUPER_ADMIN could not provision an
ORG_ADMIN until setup was already done.

---

## 5. Context resolution during setup

`ExecutionContextGuard` cannot simply skip resolution during bootstrap:
`AcademicYearController` carries a class-level `@RequireBranch()`, so creating
the first academic year needs the branch created in the previous step to be in
scope.

It therefore switches resolver:

| Workspace state | Resolver                  | Behaviour                                                                         |
| :-------------- | :------------------------ | :-------------------------------------------------------------------------------- |
| Initialized     | `resolveContext`          | Strict — 3-priority algorithm, throws on gaps                                     |
| Uninitialized   | `resolveBootstrapContext` | Best-effort — resolves each level as far as the data allows, leaves the rest null |

`resolveBootstrapContext` never throws for absent records and never widens
access: discovery is still scoped to what the user is permitted to see, and it
declines to guess when more than one candidate exists at a level.

The strict path is untouched, so behaviour after setup is exactly as before.

---

## 6. Upgrading an existing deployment

Migration `20260802000100_backfill_workspace_state` marks any installation that
already holds an active organization, an active branch and an academic year as
initialized.

Without it, deploying this change to a running system would put a working
workspace into setup mode and lock every user out. `initializedById` is left
NULL on backfilled rows because no user performed the action.

This backfill predates `SYSTEM_SETTINGS` joining the resource list and does
not check for it. That is deliberate, not an oversight: it writes directly to
the persisted `initializedAt` flag, which `isInitialized()` — not the derived
resource list — is what the guard actually consults (§2). A running
installation that predates this change and never called
`POST /system-settings/init` is still correctly grandfathered in as
`COMPLETED`; System Settings initialization becomes mandatory for
installations bootstrapping from empty after this change, not retroactively
for ones already in service.

---

## 7. The mandatory foundation, and what is optional

`markInitialized` refuses `READY` while any `SetupResource` is missing (§2):
System Settings, Organization, at least one active Branch, at least one
Academic Year.

Programs and Academic Units are not part of that list, on purpose. They are
real domain concepts with their own controllers and permissions, but the ERP
can maintain its academic hierarchy through them *after* bootstrap — nothing
about normal operation requires them to exist on day one. Blocking `READY` on
their absence would make setup demand more than the system actually needs to
run.

---

## 8. ORG_ADMIN provisioning and tenant isolation

SUPER_ADMIN provisions an ORG_ADMIN through the existing user-creation API —
`POST /v1/users` with `role: "ORG_ADMIN"` — not a separate identity system.
`CreateUserDto.organizationId` was already optional and `User.organizationId`
was already nullable, so an ORG_ADMIN can be created before any Organization
exists; SUPER_ADMIN attaches an `organizationId` at creation once one does.

Organization creation itself stays `SUPER_ADMIN`-only
(`OrganizationController` requires `Settings.Manage`, which ORG_ADMIN's
default role permissions do not grant — see `docs/modules/organization-settings.md`
if that changes). This is a deliberate, documented choice, not an oversight:
broadening it would mean deciding how an ORG_ADMIN with no organization yet is
authorized to create their *first* one, which is exactly the kind of identity
redesign this change does not take on. In practice this does not block Path B
(§3): SUPER_ADMIN creates the Organization and the ORG_ADMIN scoped to it in
either order, and the ORG_ADMIN's own setup work is Branch, Academic Year,
Programs and Academic Units — all of which their existing role permissions
already cover.

### Closing the tenant-isolation gap this exposed

Provisioning an ORG_ADMIN safely required confirming that an ORG_ADMIN cannot
act outside their own organization when creating things — and it turned out
`BranchController`, `AcademicYearController` and `UserController` all took
`organizationId`/`branchId` straight from the request body, never checked
against the caller's own scope. An ORG_ADMIN of one tenant could name another
tenant's `organizationId` in a `POST /v1/branches` or `POST /v1/users` body
and it would be honoured.

The fix reuses the scope the platform already resolves and validates on every
request — `RequestContext`, populated by `ExecutionContextGuard` — rather than
adding a second authorization mechanism:

- `assertOrganizationInScope(context, targetOrganizationId)` and
  `assertBranchInScope(context, targetBranchId)`
  (`src/common/scope/resource-scope.ts`) confirm a body-supplied id agrees
  with the organization/branch already on the context. SUPER_ADMIN is exempt;
  every other role must match.
- `BranchService.createBranch`, `AcademicYearService.create` and
  `UserService.createUser`/`updateUser`/`findByIdForActor` all call these
  before touching the database.
- `UserService` additionally enforces which role a caller may *assign*:
  SUPER_ADMIN may create or promote to any role, including ORG_ADMIN; ORG_ADMIN
  may create BRANCH_ADMIN, STAFF, STUDENT or PARENT, but not a peer ORG_ADMIN
  or SUPER_ADMIN.

This is single-organization-per-user scoping, matching `User.organizationId`
and `ContextDiscoveryService` end to end today. If a future identity model
grants one ORG_ADMIN several organizations, `assertOrganizationInScope` is the
one place that needs to change — callers do not.

An absent `RequestContext` (an internal caller outside the HTTP guard
pipeline — the seeder, a script, a unit test) is treated as trusted and left
unrestricted, the same way `createUser`'s role-assignment check is skipped for
an absent actor role: `ExecutionContextGuard` always populates a context for
every authenticated HTTP request, so this only ever applies to code that
never went through it.

---

## 9. Protecting the READY invariant

`markInitialized` is a `ConflictException` away from ever running twice
usefully: once `initializedAt` is set, `getStatus().setupRequired` is `false`
and the method returns the current status without writing anything (§2). The
`workspace_state` table's `scope` unique constraint additionally makes the
`upsert` itself safe under a race between two concurrent completions — at most
one row can ever exist, and Postgres serializes the two writes rather than
creating a duplicate.

There is, deliberately, no endpoint that reverts `COMPLETED` back to an
earlier stage. `WorkspaceSetupService` exposes no such transition, and nothing
in this change adds one: the closest existing risk is deleting the only active
Branch or Academic Year after `READY`, which today is not specially guarded
against by `BranchService`/`AcademicYearService` beyond their ordinary
business rules (a locked or selected Academic Year already refuses deletion —
see `docs/modules/academic-year.md`).

That is a conscious choice, not a gap: because progress is *derived* but
completion is *persisted* (§2), such a deletion cannot silently reopen setup
mode — `isInitialized()` reads only the persisted flag, never the resource
list, once a workspace is `COMPLETED`. The consequence of deleting the last
Branch or Academic Year in a live workspace is an operational data-integrity
question for those modules to answer on their own terms (e.g. "should the only
remaining Branch be deletable at all"), not a bootstrap-lifecycle concern —
conflating the two would mean the setup gate re-appearing for reasons that
have nothing to do with installation, which is the exact failure mode this
document's persisted-completion design exists to prevent.

---

## 10. Files

| File                                                        | Role                                     |
| :----------------------------------------------------------- | :---------------------------------------- |
| `src/modules/workspace/setup/workspace-setup.service.ts`    | Owns the state; derives the stage        |
| `src/modules/workspace/setup/workspace-setup.controller.ts` | `GET /status`, `POST /complete`          |
| `src/modules/workspace/setup/workspace-setup.types.ts`      | Stages, resources, allowed actions       |
| `src/modules/workspace/setup/workspace-setup.module.ts`     | Leaf module — depends only on Prisma     |
| `src/common/guards/workspace-setup.guard.ts`                | The gate                                 |
| `src/common/decorators/allow-during-setup.decorator.ts`     | Route marker                             |
| `src/common/scope/resource-scope.ts`                        | Tenant-scope assertions (§8)             |
| `src/modules/user/user.service.ts`                           | ORG_ADMIN provisioning, role assignment  |
| `prisma/modules/workspace/workspace.prisma`                 | `WorkspaceState` model                   |

`WorkspaceSetupModule` depends only on `PrismaModule`, so the context, auth and
workspace modules can all consume it without introducing a cycle between them —
preserving the no-back-edge rule.
