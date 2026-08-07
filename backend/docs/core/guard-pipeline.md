# Guard Pipeline

All seven guards are registered globally as `APP_GUARD` providers in
`src/app.module.ts`. **NestJS executes global guards in registration order**, so
that list is the pipeline contract — reordering it changes behaviour.

---

## 1. Execution order

| #   | Guard                   | Responsibility                                                            | Writes context?       |
| :-- | :---------------------- | :------------------------------------------------------------------------ | :-------------------- |
| 1   | `JwtAuthGuard`          | Verifies the bearer token, sets `request.user`. Skips `@Public()` routes. | No                    |
| 2   | `ExecutionContextGuard` | Resolves and validates organization / branch / academic year.             | **Yes — sole writer** |
| 3   | `RolesGuard`            | Enforces the coarse role hierarchy from `@Roles()`.                       | No                    |
| 4   | `PermissionGuard`       | Enforces fine-grained permissions from `@RequirePermission()`.            | No                    |
| 5   | `MaintenanceGuard`      | Rejects requests inside an active maintenance window.                     | No                    |
| 6   | `BranchGuard`           | Asserts a branch is in scope for `@RequireBranch()`.                      | No                    |
| 7   | `AcademicYearGuard`     | Asserts an academic year is in scope for `@RequireAcademicYear()`.        | No                    |

The ordering principle is:

```text
authenticate  →  establish scope  →  authorize against that scope
              →  check availability  →  assert route scope requirements
```

---

## 2. Why the order changed

The previous registration order was:

```text
JwtAuth → Roles → Permission → ExecutionContext → Branch → Maintenance → AcademicYear
```

Two problems followed from it.

**Authorization ran before scope existed.** `PermissionGuard` executed at
position 3, before `ExecutionContextGuard` had resolved anything, so a
permission decision was made against an unpopulated context. It compensated by
falling back to `request.user`, which meant the effective identity used for
authorization was not necessarily the identity later recorded in the audit log.

**Scope was resolved three times.** `ExecutionContextGuard` resolved and
validated the branch, then `BranchGuard` fetched and validated the same branch
again, then `AcademicYearGuard` fetched the branch a third time plus the
academic year a second time. Each had its own precedence chain over headers,
query parameters and `request.user`, and they did not agree with each other:
`BranchGuard` accepted `?branchId=`, the resolver did not.

---

## 3. Consequences of the new order

### Branch and academic year guards no longer touch the database

They now assert the outcome of resolution:

```typescript
// BranchGuard
if (request.context?.branchId) return true;
if (branchOptions?.optional) return true;
throw new BadRequestException(
  'Branch context (x-branch-id header) is required',
);
```

This removes two to four redundant queries per scoped request and makes it
impossible for a route to operate on a branch that context resolution rejected.

Both guards are now synchronous and depend only on `Reflector`.

### Tenant boundary enforcement has one home

`RolesGuard` used to overwrite `context.branchId` with the user's assigned
branch for any non-`SUPER_ADMIN`, as a defence against header spoofing. That
silently rewrote the request scope instead of rejecting it.

Cross-tenant access is now rejected — not rewritten — by
`ContextValidatorService`:

- `validateOrganization` throws `ForbiddenException` when a non-`SUPER_ADMIN`
  requests an organization other than their own.
- `validateBranch` throws `ForbiddenException` when a role below `ORG_ADMIN`
  requests a branch other than their assigned one.

### Header casing

Guards previously probed both `x-branch-id` and `X-Branch-Id`. Node lowercases
all incoming header names, so the capitalised variants were dead code and have
been removed.

---

## 4. Route decorators

| Decorator                            | Guard                                   | Effect                                      |
| :----------------------------------- | :-------------------------------------- | :------------------------------------------ |
| `@Public()`                          | `JwtAuthGuard`, `ExecutionContextGuard` | Skips authentication and context resolution |
| `@AllowUnresolvedContext()`          | `ExecutionContextGuard`                 | An ambiguous scope resolves to `null` instead of `409 CONTEXT_SELECTION_REQUIRED`. Headers, roles and permissions are unaffected — see [execution-context.md](./execution-context.md). |
| `@Roles(...)`                        | `RolesGuard`                            | Minimum role in the hierarchy               |
| `@RequirePermission(...)`            | `PermissionGuard`                       | Named permissions, `ALL` or `ANY`           |
| `@RequireBranch({ optional })`       | `BranchGuard`                           | Branch must be in scope                     |
| `@RequireAcademicYear({ optional })` | `AcademicYearGuard`                     | Academic year must be in scope              |
| `@MaintenanceFeature(...)`           | `MaintenanceGuard`                      | Feature-scoped maintenance rules            |

> [!NOTE]
> `AcademicYearOptions.allowFallback` is retained for source compatibility but
> no longer has an effect. Falling back to the branch's selected — then active —
> academic year when `x-academic-year-id` is omitted is now unconditional
> behaviour of `ContextResolverService`. Every call site in the codebase used
> the default `allowFallback: true`, so this is not a behaviour change.

---

## 5. Public routes

`@Public()` routes skip guards 1 and 2, so their context contains only the
envelope (`requestId`, client metadata) with a null scope.

`MaintenanceGuard` still runs on public routes and now reads scope exclusively
from the context. A public request therefore matches `GLOBAL`, `MODULE` and
`FEATURE` maintenance rules, but not `ORGANIZATION`- or `BRANCH`-scoped ones.
The previous header fallback let an unauthenticated caller choose which
maintenance rule applied to them by setting `x-branch-id`.

---

## 6. Adding a guard

1. Decide where it belongs in the five-stage principle above.
2. Register it at that position in `src/app.module.ts` — position is behaviour.
3. Read from `request.context`; never write to it (the type will stop you).
4. Add its row to the table in section 1.
