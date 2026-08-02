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

| Stage           | Meaning                                                 |
| :-------------- | :------------------------------------------------------ |
| `ORGANIZATION`  | No active organization exists. Create one.              |
| `BRANCH`        | An organization exists; no active branch. Create one.   |
| `ACADEMIC_YEAR` | A branch exists; no academic year. Create one.          |
| `FINALIZE`      | All three exist. Setup awaits explicit completion.      |
| `COMPLETED`     | Bootstrap finished. The tenant-header contract applies. |

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

```text
Fresh install
    │
    ▼
POST /auth/login                    @Public — always available
    │
    ▼
GET  /auth/me                       @AllowDuringSetup
    │  → { setup: { setupRequired: true, setupStage: "ORGANIZATION",
    │               missingResources: [...], allowedActions: [...] } }
    ▼
POST /v1/organizations              @AllowDuringSetup
    │
    ▼
POST /v1/branches                   @AllowDuringSetup
    │
    ▼
POST /v1/academic-years             @AllowDuringSetup
    │
    ▼
POST /v1/workspace/setup/complete   @AllowDuringSetup, SUPER_ADMIN
    │  → setupStage: "COMPLETED"
    ▼
Normal operation — tenant headers now apply
```

`GET /v1/workspace/setup/status` returns the same payload at any point, so a
client that reloads mid-wizard can resume without replaying the flow.

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

| Route                               | Why                                       |
| :---------------------------------- | :---------------------------------------- |
| `GET /auth/me`                      | Where the client learns setup is required |
| `GET /v1/workspace/setup/status`    | Wizard state                              |
| `POST /v1/workspace/setup/complete` | Finalisation, `SUPER_ADMIN` only          |
| `POST /v1/organizations`            | Stage 1                                   |
| `POST /v1/branches`                 | Stage 2                                   |
| `POST /v1/academic-years`           | Stage 3                                   |

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

---

## 7. Files

| File                                                        | Role                                 |
| :---------------------------------------------------------- | :----------------------------------- |
| `src/modules/workspace/setup/workspace-setup.service.ts`    | Owns the state; derives the stage    |
| `src/modules/workspace/setup/workspace-setup.controller.ts` | `GET /status`, `POST /complete`      |
| `src/modules/workspace/setup/workspace-setup.types.ts`      | Stages, resources, allowed actions   |
| `src/modules/workspace/setup/workspace-setup.module.ts`     | Leaf module — depends only on Prisma |
| `src/common/guards/workspace-setup.guard.ts`                | The gate                             |
| `src/common/decorators/allow-during-setup.decorator.ts`     | Route marker                         |
| `prisma/modules/workspace/workspace.prisma`                 | `WorkspaceState` model               |

`WorkspaceSetupModule` depends only on `PrismaModule`, so the context, auth and
workspace modules can all consume it without introducing a cycle between them —
preserving the no-back-edge rule.
