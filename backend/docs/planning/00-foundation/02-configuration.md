# F2 — Configuration Engine

> **Status:** `planned` — §10 has two open questions
> **Depends on:** Organization, Branch
> **Depended on by:** nearly every module — I2, I3+I4+I5, F3, Finance, Attendance, Examination, Documents

---

## 1. Purpose

F2 owns **runtime, per-tenant, business-policy configuration**: values that
differ between institutions, that administrators change, and that alter how the
system behaves rather than describing what something is.

It does **not** own:

| Concern | Owner |
| :--- | :--- |
| Environment, secrets, boot validation | [`../../core/configuration.md`](../../core/configuration.md) — a different problem entirely |
| Deployment defaults (product name, maintenance mode, default locale) | `SystemSetting` |
| Communication providers, channels, templates | `CommunicationSetting` — [`../../modules/communication/`](../../modules/communication/communication.md) |
| The academic session calendar | `AcademicYear` |
| Entity attributes (`Branch.code`, `Organization.contactEmail`) | The entity itself |

### The boundary test

> **A fact _about_ the thing is a column.**
> **A rule about _how the system behaves_ for that thing is configuration.**

`Branch.code` is a fact about the branch — a column. *"How many days an
admission offer stays open"* is a rule about behaviour — configuration.

This test exists because a configuration engine with no boundary becomes the
place everything lands, and then every read needs it. `docs/modules/branch-settings.md`
already warns against duplicating Communication, SystemSetting and AcademicYear
here; that warning is adopted as a rule.

---

## 2. Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | **A typed key registry (`ConfigDefinition`), not free key/value** | A `key TEXT, value TEXT` table is untyped garbage within a year — nobody knows which keys exist, what shape a value takes, or whether a typo created a second key that silently does nothing. |
| D2 | **Three-tier resolution: SYSTEM → ORGANIZATION → BRANCH**, most specific wins, falling back to the registry default | Identical in shape to the three-tier master-data resolution in `../../domain/01-04-review-of-frozen-decisions.md` (defect D2). One mental model covers both. |
| D3 | **Policy values are effective-dated and append-only** | See §2.1 — this is the decision the whole module exists for. |
| D4 | **Long-running jobs bind a config version at start** | A promotion run over 2,000 students that reads config per student can behave differently for student 1 and student 2,000 if an admin edits mid-run. |
| D5 | **`isVersioned` is declared per definition** | Effective-dating every key doubles write cost and complicates every read. Refund policy is versioned; default page size is not. |
| D6 | **Resolution is cached, invalidated on change** | Config is read on nearly every request. Three queries per read is not viable. |
| D7 | **Every change records actor and reason** | §15 Q20 requires it, and D3 is meaningless without the change record. |
| D8 | **No key may be created through the API** | Definitions ship with the code that reads them. A user-created key has no consumer and no validation — it is a note, not configuration. |

### 2.1 Why effective dating, concretely

A branch changes its refund percentage from 80% to 50% on **1 November**.

A student requested a refund on **20 October**. It is approved on **5 December**.

Which percentage applies? **October's — 80%.** The policy at the time the
request was raised governs it. A system that reads the *current* value gets this
wrong, silently, and cannot even show that it did.

So a policy read is `resolve(key, scope, asOf)` — never simply `resolve(key,
scope)`. The `asOf` defaults to now, but any operation with a governing date
passes that date instead.

This is also what makes §15 Q20 ("configuration change events must be audited")
meaningful. Auditing a change is only useful if you can reconstruct what the
value *was*.

---

## 3. Data model

### 3.1 `ConfigDefinition` — the registry

Seeded from code, never user-created (D8).

| Field | Type | Notes |
| :--- | :--- | :--- |
| `key` | `String` | Primary key. Dotted namespace: `admissions.offer_validity_days` |
| `category` | `String` | Groups keys for UI and for permissions (§10 Q2) |
| `valueType` | `ConfigValueType` | `STRING`, `INT`, `DECIMAL`, `BOOLEAN`, `ENUM`, `JSON` |
| `defaultValue` | `Json` | The SYSTEM fallback. Never null — every key has a working default. |
| `validationSchema` | `Json?` | JSON Schema. Range for an int, allowed values for an enum. |
| `allowedScopes` | `ConfigScope[]` | Which levels may set it. Some keys are organization-only. |
| `isVersioned` | `Boolean` | D5 |
| `description` | `String` | Shown in the admin UI. Required — an undocumented key gets misused. |
| `isActive` | `Boolean` | Retire a key without deleting its history |

### 3.2 `ConfigValue`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID v7` | |
| `definitionKey` | `String` | FK to the registry |
| `scopeType` | `ConfigScope` | `SYSTEM`, `ORGANIZATION`, `BRANCH` |
| `scopeId` | `String?` | Null exactly when `scopeType = SYSTEM` |
| `value` | `Json` | Validated against the definition on write |
| `effectiveFrom` | `DateTime` | |
| `effectiveTo` | `DateTime?` | Null = currently in force |
| `version` | `Int` | Increments per key+scope |
| `setBy` | `String` | User id |
| `setAt` | `DateTime` | |
| `reason` | `String?` | Required when `isVersioned` |

**Append-only.** Setting a new value closes the previous row
(`effectiveTo = now`) and inserts a new one. A row is never updated in place, so
history reconstructs exactly.

For `isVersioned: false` definitions the same table is used, but the old row is
closed and superseded without requiring a reason — history still exists, it is
just not treated as policy evidence.

### 3.3 Resolution

```
resolve(key, { organizationId, branchId }, asOf = now)

  1. BRANCH value    where scopeId = branchId       and asOf ∈ [from, to)
  2. ORGANIZATION    where scopeId = organizationId and asOf ∈ [from, to)
  3. SYSTEM          where scopeId is null          and asOf ∈ [from, to)
  4. definition.defaultValue
```

First hit wins. Step 4 always succeeds, so **resolution never fails** — a
missing configuration is not a runtime error. That property is what allows new
keys to ship without a data migration.

### 3.4 Caching (D6)

Cache on `(key, organizationId, branchId)` for `asOf = now` only. **Historical
reads are never cached** — they are rare and must be exact.

A write publishes `config.changed`, which evicts the affected entries. See
§10 Q1 for the multi-instance problem.

---

## 4. Invariants

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | One value in force per key per scope | `CREATE UNIQUE INDEX config_value_current ON "ConfigValue" ("definitionKey","scopeType","scopeId") WHERE "effectiveTo" IS NULL` |
| 2 | `scopeId` present exactly when scope is not SYSTEM | `CHECK (("scopeType" = 'SYSTEM') = ("scopeId" IS NULL))` |
| 3 | Only registered keys can be set | FK `definitionKey → ConfigDefinition.key` |
| 4 | A closed range is ordered | `CHECK ("effectiveTo" IS NULL OR "effectiveFrom" < "effectiveTo")` |
| 5 | **No overlapping ranges for one key+scope** | Postgres exclusion constraint over `tstzrange("effectiveFrom","effectiveTo")` with `definitionKey`, `scopeType`, `scopeId` equal — requires the `btree_gist` extension |
| 6 | The value matches the definition's type and schema | Application-validated on write; JSON Schema cannot be enforced in Postgres |
| 7 | The scope is permitted for that key | Application-validated against `allowedScopes` |
| 8 | A versioned change carries a reason | `CHECK` cannot see the definition; enforced in the service and tested |

Invariant 5 is the one that makes historical resolution trustworthy. Without it,
two overlapping rows make `asOf` ambiguous and the query returns whichever the
planner reaches first — a bug that appears only in audits, months later.

---

## 5. Provenance

`ConfigValue` is append-only; there is no update and no delete.

| Situation | Result |
| :--- | :--- |
| New value set | Previous row closed, new row inserted, `version` incremented |
| Value cleared at a scope | Previous row closed; resolution falls through to the next tier |
| Definition retired (`isActive: false`) | Values retained; resolution stops consulting the key |

### The correction test

A branch admin sets refund percentage to 50% on 1 November:

```
ConfigValue  key: finance.refund_percentage   scope: BRANCH/mumbai
             value: 80   effectiveFrom: 2026-04-01  effectiveTo: 2026-11-01
             version: 1  setBy: <user-a>

ConfigValue  key: finance.refund_percentage   scope: BRANCH/mumbai
             value: 50   effectiveFrom: 2026-11-01  effectiveTo: null
             version: 2  setBy: <user-b>
             reason: "revised policy approved by trustees, ref MB-2026-14"
```

`resolve('finance.refund_percentage', mumbai, asOf: 2026-10-20)` returns **80**
in December, in March, and in five years. The October refund can always be shown
to have been correct.

---

## 6. Lifecycle

Definitions: seeded on deploy → active → retired (`isActive: false`). **Never
deleted** — historical values reference the key.

Values: set → superseded. There is no "delete a value"; clearing at a scope
closes the row and lets resolution fall through.

**Adding a key** is a code change: declare the definition, ship it, and the seed
registers it. It requires no data migration, because resolution falls back to
`defaultValue` (§3.3 step 4).

---

## 7. API surface

| Method | Path | Purpose | Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/config/definitions` | Browse the registry by category | `BRANCH_ADMIN`+ |
| `GET` | `/v1/config/resolved` | Effective values for the caller's scope | `STAFF`+ |
| `GET` | `/v1/config/values/:key` | Value plus full history for one key | `BRANCH_ADMIN`+ |
| `PUT` | `/v1/config/values/:key` | Set at a scope; body carries scope, value, reason | see §10 Q2 |
| `DELETE` | `/v1/config/values/:key` | Clear at a scope, falling through to the tier above | see §10 Q2 |

**No endpoint creates a definition** (D8).

`GET /v1/config/resolved` is what a client bootstraps from — one call returning
every effective value for the current organization and branch, rather than a
request per key.

| Rule broken | Status | `error.code` |
| :--- | :--- | :--- |
| Unknown key | `404` | `NotFoundException` |
| Value fails the definition's schema | `400` | `BadRequestException` — names the failing constraint |
| Scope not in `allowedScopes` | `400` | `BadRequestException` |
| Versioned change without a reason | `400` | `BadRequestException` |
| `effectiveFrom` before the current row's start | `409` | `ConflictException` — would create an overlap |

---

## 8. Events

| Event | When | Consumers |
| :--- | :--- | :--- |
| `config.changed` | A value is set or cleared | Cache invalidation, audit |
| `config.definition_registered` | A new key ships | Audit |

`config.changed` carries key, scope, old value and new value. It is the event
§15 Q20 asks for, and the payload must include the **old** value — an audit
entry recording only the new one cannot answer "what changed?".

---

## 9. Dependencies

**Requires:** Organization, Branch. Postgres `btree_gist` for invariant 5.

**Depended on by** — the keys each module registers:

| Module | Example keys |
| :--- | :--- |
| I2 Applicant | `admissions.offer_validity_days`, `admissions.quota_required`, `admissions.allow_deferment`, `admissions.max_program_preferences` |
| I3+I4+I5 | `students.roll_number_strategy`, `admissions.program_requires_new_admission` |
| F3 Numbering | *(none — formats live on the sequence config itself)* |
| Finance | `finance.refund_percentage`, `finance.late_fee_grace_days`, `finance.installments_enabled` |
| Attendance | `attendance.mode`, `attendance.correction_window_days`, `attendance.short_attendance_threshold` |
| Documents | `documents.archive_after_years` |
| F1 | `dataprotection.backup_retention_days` |

Each module's document lists its own keys. F2 provides only the mechanism.

---

## 10. Open questions

| # | Question | Blocks | Options |
| :--- | :--- | :--- | :--- |
| **Q1** | **How is the cache invalidated across application instances?** | D6 | An in-memory cache goes stale the moment a second instance exists — instance A changes a value, instance B serves the old one until restart. Options: (a) short TTL (30–60s) plus local event invalidation — no infrastructure, bounded staleness; (b) Redis pub/sub — correct but adds a dependency the stack does not currently have (`core/configuration.md` notes throttling is deliberately in-memory with no Redis); (c) database `LISTEN/NOTIFY` — no new infrastructure, but ties the app to Postgres specifics. **Recommendation: (a) now**, revisit at P5 once the deployment shape is known. A refund policy that takes 60 seconds to propagate is acceptable; one that takes a restart is not. |
| **Q2** | **Who may change policy configuration?** | The write endpoints | A branch admin changing `finance.refund_percentage` has direct financial consequence; changing `attendance.correction_window_days` does not. A single blanket permission is too coarse. **Recommendation: a permission per `category`** (`config.finance.write`, `config.admissions.write`), granted per user — reusing the pattern from F1 D12. Needs confirmation that per-category granularity is worth the extra permission rows. |

---

## 11. Acceptance scenarios

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | Resolve a key with no value set anywhere | Returns `defaultValue`. **Never an error** (§3.3 step 4). |
| 2 | Organization sets a value; branch does not | Branch resolution returns the organization's value |
| 3 | Branch overrides the organization | Branch value wins |
| 4 | Branch value cleared | Resolution falls back to organization, then SYSTEM, then default |
| 5 | **Refund set 80% in April, 50% in November; resolve `asOf` 20 October** | Returns **80** — the D3 case, and the reason this module exists |
| 6 | Resolve `asOf` now after the same change | Returns 50 |
| 7 | Set a value failing the definition's schema (e.g. `-5` days) | `400` naming the failing constraint; nothing written |
| 8 | Set an unregistered key | `404`. Not silently stored (D8, invariant 3). |
| 9 | Set a branch value for an organization-only key | `400` (invariant 7) |
| 10 | Versioned key changed without a reason | `400` (invariant 8) |
| 11 | **Raw SQL**: two rows for one key+scope with null `effectiveTo` | Rejected (invariant 1) |
| 12 | **Raw SQL**: a row whose range overlaps an existing one | Rejected by the exclusion constraint (invariant 5) |
| 13 | **Raw SQL**: `scopeType = BRANCH` with null `scopeId` | Rejected (invariant 2) |
| 14 | Change a value, then read through a warm cache | New value served within the invalidation window (§10 Q1) |
| 15 | A promotion job starts, an admin changes a key mid-run | Every student in the batch uses the value bound at start (D4) |

Scenarios 11–13 must run as raw SQL. Scenario 5 is the one that proves the
design — if it returns 50, effective dating is not working and every historical
policy question is unanswerable.
