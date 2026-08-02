# Execution Context Lifecycle

Every request carries an **execution context**: who is calling, and which
organization, branch and academic year the call operates in. Almost all business
logic reads it, directly or through the audit pipeline, so its correctness is
load-bearing.

This document defines who may write it, who may only read it, and at what point
in the request it becomes trustworthy.

---

## 1. The ownership rule

> **The context is created by `RequestContextMiddleware` and populated by
> `ExecutionContextGuard`. Nothing else writes to it.**

Before this rule was introduced, four components mutated the context —
`RequestContextMiddleware`, `RolesGuard`, `ExecutionContextGuard` and
`BranchGuard`/`AcademicYearGuard` — each with its own precedence rules and its
own fallbacks to raw headers. The value of `context.branchId` therefore depended
on which guards a route happened to be decorated for, and two guards could
disagree about the same request.

The rule is now enforced by the type system rather than by convention:

```typescript
// request-context.middleware.ts
export interface MutableRequestContext
  extends RequestEnvelope, ExecutionScope, ReservedScope {}

export type RequestContext = Readonly<MutableRequestContext>;

export interface AuthenticatedRequest extends Request {
  context: RequestContext; // read-only to every consumer
}
```

A guard, interceptor or service that attempts `request.context.branchId = …`
**fails to compile**. The single mutation point is
`RequestContextService.applyExecutionScope`, and `ExecutionContextGuard` is its
only caller.

`readonly` here is a compile-time contract, not `Object.freeze`. It is not a
defence against malicious code inside the process; it is a defence against a
second owner appearing by accident.

---

## 2. Request lifecycle

```text
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ RequestContextMiddleware                    (creates)       │
│   • requestId          ← x-request-id or a new UUIDv7       │
│   • clientApp / clientVersion / platform ← client headers   │
│   • identity + tenant scope ← null                          │
│   • opens the AsyncLocalStorage scope                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Guard pipeline           (see docs/core/guard-pipeline.md)   │
│                                                              │
│  1. JwtAuthGuard            → request.user                   │
│  2. ExecutionContextGuard   → WRITES the context             │
│  3. RolesGuard              → reads context.role             │
│  4. PermissionGuard         → reads context.userId / role    │
│  5. MaintenanceGuard        → reads context scope            │
│  6. BranchGuard             → asserts context.branchId       │
│  7. AcademicYearGuard       → asserts context.academicYearId │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
Controller        reads context (or req.userId) — never writes
    │
    ▼
Service           reads context via RequestContextService.getContext()
    │
    ▼
Prisma            queries scoped by context values
    │
    ▼
Audit / Events    AuditEventMapper stamps events with the same context
```

The context is **not trustworthy before step 2**. That is the whole reason
`ExecutionContextGuard` runs second: any guard that made a decision before it
would be deciding against an empty scope.

---

## 3. What the middleware writes

Only what the transport itself provides:

| Field           | Source                                               |
| :-------------- | :--------------------------------------------------- |
| `requestId`     | `x-request-id` header, else a new UUIDv7             |
| `clientApp`     | `x-client-app`, default `campusflow-web`             |
| `clientVersion` | `x-client-version`, default `1.0.0`                  |
| `platform`      | `x-platform`, normalized to `WEB`/`MOBILE`/`DESKTOP` |

Identity and tenant scope are initialised to `null`. The middleware no longer
copies `x-branch-id` / `x-academic-year-id` into the context: an unvalidated
header is not a scope, and treating it as one meant that for a brief window the
context claimed a branch nobody had authorised.

The same object is stored in `req.context` and in the `AsyncLocalStorage` store,
so a service reading through `RequestContextService.getContext()` and a
controller reading `req.context` can never observe different values.

---

## 4. What `ExecutionContextGuard` writes

`ExecutionScope` — and nothing else:

```text
userId, role, organizationId, branchId, academicYearId, branch, academicYear
```

It writes in two passes:

1. **Identity first** (`userId`, `role`), before tenant resolution is attempted.
   A resolution failure is therefore still attributable in audit logs and error
   reports. Previously a failed resolution left the context completely empty.
2. **Tenant scope**, after `ContextResolverService` has resolved and validated
   the organization, branch and academic year.

It also mirrors the actor id onto `req.userId`, which ~27 controllers pass into
services for audit attribution. That mirror used to be written by `RolesGuard`,
which only ran on routes decorated with `@Roles()` — so every other route
silently attributed its writes to `undefined`.

Resolution itself is unchanged: the three-priority algorithm (headers →
auto-resolve → HTTP 409 `CONTEXT_SELECTION_REQUIRED`) still lives in
`ContextResolverService`.

### Skips

`ExecutionContextGuard` returns early, leaving the context null, when:

- the route is `@Public()`, or
- there is no authenticated principal on the request.

Consumers must therefore treat a null scope as "no scope", not "not yet
resolved".

---

## 5. Consumers

| Consumer            | Reads                                | Notes                               |
| :------------------ | :----------------------------------- | :---------------------------------- |
| `RolesGuard`        | `context.role`                       | Read-only since the ownership rule  |
| `PermissionGuard`   | `context.userId`, `context.role`     | Read-only                           |
| `MaintenanceGuard`  | full scope                           | No longer falls back to raw headers |
| `BranchGuard`       | `context.branchId`                   | Assertion only, no DB access        |
| `AcademicYearGuard` | `context.academicYearId`             | Assertion only, no DB access        |
| Controllers         | `context.*`, `req.userId`            |                                     |
| Services            | `RequestContextService.getContext()` |                                     |
| `AuditEventMapper`  | full context                         | Stamps every audit row              |

---

## 6. Tests

`test/factories/request-context.factory.ts` builds a complete context. Tests
should use it rather than hand-rolling object literals — a partial literal is
how a fixture ends up asserting against a shape the application can never
produce.

```typescript
const context = buildRequestContext({ branchId, organizationId });
```
