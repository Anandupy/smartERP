# Configuration (F2 core)

The runtime, per-tenant, business-policy configuration engine planned in
[`../planning/00-foundation/02-configuration.md`](../planning/00-foundation/02-configuration.md).
This document describes what is **implemented** (2026-10-17); the plan
remains the design of record for what is not.

Admission workflow policy is the first — and today the only — consumer. See
[`admissions.md` §12](./admissions.md#12-configurable-admission-workflows).

---

## 1. What exists

| Piece | Where | Notes |
| :--- | :--- | :--- |
| Typed key registry | `src/modules/configuration/config.registry.ts` | Every key: type, default, allowed scopes, versioned flag, validator, category. Keys ship with the code that reads them (F2 D1, D8). |
| `ConfigDefinition` table | `prisma/modules/system/configuration.prisma` | Written from the registry on the first write of a key; no endpoint creates one. |
| `ConfigValue` table | same | Effective-dated, append-only (F2 D3). |
| `ConfigurationService` | `src/modules/configuration/configuration.service.ts` | `resolveMany(keys, scope, asOf)`, `set`, `clear`, `history`. |
| HTTP | `src/modules/configuration/configuration.controller.ts` | `GET/PUT/DELETE /v1/config/values/:key`. |
| Migration | `prisma/migrations/20261017000000_f2_configuration_core` | Additive only. |

## 2. Resolution

`resolve(key, { organizationId, branchId }, asOf)` returns the first match of
**BRANCH → ORGANIZATION → SYSTEM**, among rows whose window
`[effectiveFrom, effectiveTo)` contains `asOf`, and falls back to the
registry default. An absent value is never an error.

A stored value that **fails the registry's validator is an error**
(`500 CONFIGURATION_INVALID`), not a silent fallback: a damaged policy row
must stop the operation rather than quietly select a more permissive
behaviour.

The response carries the tier that answered (`BRANCH`, `ORGANIZATION`,
`SYSTEM`, `DEFAULT`) so a UI can say whether a value is inherited.

## 3. Writes

| Rule | Mechanism | Error |
| :--- | :--- | :--- |
| Only registered keys | registry lookup; FK `definitionKey → ConfigDefinition.key` | `404 CONFIG_KEY_NOT_FOUND` |
| Value matches the key | registry validator | `400 CONFIG_VALUE_INVALID` |
| Scope allowed for the key | `allowedScopes` | `400 CONFIG_SCOPE_NOT_ALLOWED` |
| Versioned keys need a reason | service | `400 CONFIG_REASON_REQUIRED` |
| Category write permission | `config.admissions.write` (F2 §10 Q2 resolved as recommended: one permission per category) | `403` |
| ORGANIZATION scope | `ORG_ADMIN` or `SUPER_ADMIN` only | `403` |
| SYSTEM scope | `SUPER_ADMIN` only | `403` |
| The scope **id** | always the request's own resolved organization / branch — the body names only `scopeType`; an extra `scopeId` is refused by `forbidNonWhitelisted` | `400` |
| Concurrent writers | conditional close + one-current-row index | `409 CONFIG_CONCURRENT_UPDATE` |

A write closes the current row at the target scope and opens its successor
at the same instant (one millisecond after the predecessor opened, if both
fall in one clock tick), so windows abut and never overlap. Clearing closes
the current row; resolution falls through to the tier above. Every write
publishes `config.changed` through the outbox with the old and new values,
the version, the reason and the actor; `AuditListener` records it.

`config.admissions.write` is seeded for `ORG_ADMIN`. A `BRANCH_ADMIN` can be
granted it to manage their own branch only.

## 4. Database invariants

| # (F2 §4) | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | One current value per key and scope | partial unique index `ConfigValue_current_key` (`COALESCE("scopeId",'')`, since NULLs never collide) |
| 2 | `scopeId` null exactly for SYSTEM | `CHECK ConfigValue_scope_id_check` |
| 3 | Only registered keys | FK |
| 4 | Ordered windows | `CHECK ConfigValue_window_check` |
| 5 | No overlapping windows | `EXCLUDE USING gist` (`btree_gist`) on key, `COALESCE(scopeId,'')`, `tsrange` — `scopeType` is omitted because enums have no gist operator class on every supported Postgres version, and organization/branch ids never collide |

All four are exercised as raw SQL in
`test/integration/configurable-workflow.integration-spec.ts`.

## 5. Not built (from the F2 plan)

| Item | Status |
| :--- | :--- |
| Caching (D6 / Q1) | `DEFERRED` — resolution is one indexed query per transition; revisit with the deployment shape. |
| Future-dated changes (`effectiveFrom` in the body) | `DEFERRED` — every change takes effect immediately. |
| Job version binding (D4) | `DEFERRED` — no long-running job reads configuration yet. |
| `GET /config/definitions`, `GET /config/resolved` | `DEFERRED` — admission policy is read through `GET /admissions/workflow/policy`. |
| `isVersioned: false` keys | supported by the code path; none registered. |
