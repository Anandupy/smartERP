# Answers to the Frontend Contract Gaps

Point-by-point replies to `frontend/docs/backend-gaps.md`. Every answer was read
off the source or the generated OpenAPI document, not off the older module docs
— several of which were wrong, and have since been corrected.

**Read this first:** the report was compiled from module docs and the Postman
collection with no backend source read. That was the right way to work, but it
means a number of entries record an absence in the *documentation* rather than
in the API. Those are marked **Already existed**. Nothing had to be built for
them; the contract now says so.

Swagger at `/docs` is authoritative for every shape below. `pnpm openapi:audit`
regenerates and checks it.

---

## 1. The three undocumented response bodies (A) — **closed**

All three now have a documented schema and a worked example.

| Endpoint | Where |
| :--- | :--- |
| `GET /maintenance-rules/active/status` | [maintenance.md](../modules/maintenance.md#1-check-active-status) |
| `GET /audit-logs/summary` | [audit.md](./audit.md#2-detailed-summary-api) |
| `GET /audit-logs/timeline` | [audit.md](./audit.md#3-activity-timeline-api) |

Three things in them were not guessable:

- **The status payload has two shapes.** No rule matching gives a lone
  `{ "maintenanceEnabled": false }`. A rule matching gives the rule *flattened*,
  which is not the rule record: `scopeType` appears twice under two names,
  nulls are replaced with `""` or defaults, and `id`, `severity`, `bannerColor`,
  `maintenanceIcon`, `announcementLink` and `externalStatusPageUrl` are omitted.
- **Summary is not paginated.** Four arrays of `{ dimension, count }`, each
  summing to `totalCount`.
- **Timeline's two halves do not reconcile.** `dailyActivity` spans the whole
  filtered range; `events` is one page of it. Summing the former will not equal
  the length of the latter.

Every other endpoint in the report now also has a typed response body and a
generated Postman example — the collection carries 1029 of them where it
previously carried none.

---

## 2. The scope headers (G19, I18) — **confirmed, and the frontend is wrong**

The backend reads exactly three names, from
`src/modules/context/constants/context.constants.ts`:

```typescript
export const CONTEXT_HEADERS = {
  ORGANIZATION_ID: 'x-organization-id',
  BRANCH_ID: 'x-branch-id',
  ACADEMIC_YEAR_ID: 'x-academic-year-id',
} as const;
```

| Backend reads | Frontend sends | |
| :--- | :--- | :--- |
| `x-organization-id` | `X-Tenant-Id` | ✗ not read |
| `x-branch-id` | `X-Branch-Id` | ✓ |
| `x-academic-year-id` | `X-Academic-Year` | ✗ not read |

The analysis in G19 is correct in every respect, including the consequence: two
of the three fall through to automatic resolution, which works for a user with
exactly one of each and raises `409 CONTEXT_SELECTION_REQUIRED` for anyone with
more. I18 is also correct that writes to `/v1/academic-units/*` carry their
scope only in headers, so a unit can be created against the branch's selected
year rather than the one on screen.

**This is a one-line frontend change** in `src/constants/headers.ts`. No backend
change is warranted: the three names are consistent across the guard, the
constants, the Swagger `@ApiHeader` declarations and the Postman collection.

---

## 3. Value sets that already existed — **use them**

Four fields were treated as free text or as un-offerable filters. All four are
constrained, and were before this work; only the documentation was missing.

| Field | Real type | Was |
| :--- | :--- | :--- |
| Program `level` | enum `SCHOOL \| COLLEGE \| DEGREE` | "sent on every write and documented nowhere" (H1) |
| AcademicUnit `unitType` | enum, 9 values | "free text; an enum would reject legitimate values" (I2) |
| Maintenance `severity` | enum `INFO \| WARNING \| CRITICAL` | "a free-text field" (C2) |
| Audit `severity` / `status` | `INFO \| WARN \| ERROR \| CRITICAL` / `SUCCESS \| FAILURE` | "no filter controls can be offered" (D3) |

`level` and `unitType` are Prisma enums — a write outside the set is rejected.
Maintenance `severity` is a Prisma enum too. Audit `severity` and `status` are
string columns, so the *filter* accepts anything, but the four and two values
above are the only ones the pipeline writes; they are now declared as `enum` in
the OpenAPI metadata while the validator stays permissive.

On I2 specifically: the "avoid hardcoding enums" note in `academic-unit.md` is
advice against branching logic on a level, not a statement that the column is
unconstrained. The two had been conflated.

---

## 4. Fields reported missing that are returned — **Already existed**

Each of these was typed optional or omitted from a screen because no document
promised it. All are non-null columns returned on every read.

| Reported | Reality |
| :--- | :--- |
| B1 — no `id`, `createdAt`, `updatedAt`, "last changed by" on System Settings | All present, plus `createdBy` / `updatedBy`. `updatedBy` is the last-changed-by. |
| B5 — no localization fields | `defaultTimezone`, `defaultCurrency`, `defaultLanguage` exist and are returned. **No write path** — see §7. Date format does not exist. |
| B7 — no uptime or infrastructure contract | `GET /live` returns `uptimeSeconds`; `GET /health` returns database and heap indicators. Build id, region, node inventory and licence tier do not exist. |
| C1 — twelve maintenance presentation fields | All twelve are persisted columns, returned on every read. |
| D1 — seven filterable audit fields absent from the record | `severity`, `status`, `executionTime`, `traceId`, `correlationId`, `httpMethod`, `route` are all columns and all returned. |
| F8 — no `id`, `createdAt`, `updatedAt` on Branch | All present. |
| F11 — parent organization is an id only | `GET /branches` and `GET /branches/:id` **hydrate `organization`**. |
| G5, H5, I8 — no `isDeleted` | Present on all three. Every list filters it, so a list count is the live set. |
| G16, H13, I15 — no `createdAt` / `updatedAt` / authorship | Present on all three. |
| H12 — no `program.*` audit event | `program.created`, `.updated`, `.deleted` are published and in the event map. |
| G15, I14 — no audit for transitions | They are audited, under the entity's generic `.updated` name — so the trail records *that* it changed, not *which* transition. |
| H14 — Program branch is an id only | `GET /programs/:id` hydrates `branch`. |
| I10 — `level` presence unconfirmed | Required, always returned. Roots are **level 0**, not 1. |

---

## 5. Behaviours now written down

| Gap | Answer |
| :--- | :--- |
| B2 — is `PATCH` partial? | **Yes, everywhere.** Every update DTO extends `PartialType`. Send only what changed. |
| C3, C4 — maintenance date serialization | ISO 8601. `estimatedCompletion` is a `DateTime`, not free text; `maintenanceWindow` is the free-text one. |
| C8 — `customStatus` constraint | Defaults to `503`, validated only as a number. No range is enforced. |
| D2 — `sortBy`: docs or Postman? | **The docs.** An unrecognised value is ignored in favour of `timestamp`, so `createdAt` returns 200 sorted by timestamp — it neither fails nor sorts by `createdAt`. |
| D4 — pagination meta key | Neither guess. It is at **`data.meta`** with the key **`limit`** — not `meta.pagination` with `pageSize`. |
| E2 — what the org list returns | `ACTIVE` **and `SUSPENDED`**; only `INACTIVE` is excluded. |
| E6 — does expiry change status? | **No.** Nothing reads `masterExpiryDate`. An expired organization stays `ACTIVE` and keeps working. |
| F4, H4, I5 — toggle semantics | Bodyless, flips the current value, **not idempotent**. The frontend's handling is correct. For academic units, `PATCH /:id` also accepts `isActive` and *is* idempotent — prefer it. |
| G4 — does the lock block the transitions? | **No.** It blocks `PATCH /:id` and `DELETE /:id` only. `activate`, `select` and `lock` all remain legal on a locked year. The guard can be relaxed. |
| G8 — empty `/current` | `200` with `data: null`. Not a `404`. |
| G9 — initial flags of a non-first year | `isActive: false`, `isSelected: false`. Auto-selection covers the first year only. |
| G11 — `name` uniqueness | **None.** A duplicate name is accepted silently. |
| I4 — which endpoint owns a re-parent? | **`move`.** It is the only one that recalculates `level` across the subtree; `PATCH /:id` with `parentId` moves the node and leaves descendants' depths wrong. |
| I11 — `displayOrder` tie-break | Nullable, no default. Ordered `level`, `displayOrder`, `name`; a null sorts **last**. The frontend's choice matches. |
| B8 — is an `x-role` header required? | **No.** No such header is read anywhere. That claim in `system-settings.md` was false and has been removed. |

Error contracts — status, code and message per rule — are now tabulated in
[academic-year.md](../modules/academic-year.md#error-contracts),
[program.md](../modules/program.md#error-contracts),
[academic-unit.md](../modules/academic-unit.md#error-contracts) and
[organization-settings.md](../modules/organization-settings.md#error-contracts).
This closes G12, H10, I12.

---

## 6. Built

**`GET /v1/academic-years/:id`** (G2). The service already resolved years by id
for its five other `:id` endpoints; the read was simply not exposed. Detail
screens no longer need an active branch, "not found" now means not found, and a
single record can be refetched. Soft-deleted years stay unreachable.

**The two branch documents are one** (F2). `branch.md` now holds the union;
`branch-settings.md` is the written answer to F12 — there is no branch settings
resource, the absence is total, and three existing resources already own part of
that surface and should not be duplicated.

---

## 7. Open — needs a decision

These are product decisions, not documentation gaps. Nothing has been built.

| # | Question | Why it is not a safe change |
| :--- | :--- | :--- |
| E4 | Should `status` be writable on Organization? | Adds a request field and a lifecycle. `SUSPENDED` is currently unreachable and a deactivation is irreversible — the fix is either a status write path or an `includeInactive` list filter, and which one is a product call. |
| B5 | Should the three tenant defaults be writable? | `defaultTimezone`, `defaultCurrency`, `defaultLanguage` are columns with defaults, returned but not accepted by either request DTO. Making them writable is a new surface with its own permission question. |
| C6, E3, F3, G6, H6, I6, I7 | Query parameters on the list endpoints | Adding `page` / `limit` changes each response from a bare array to a paginated shape — a breaking change for existing clients. `search` and filter semantics would have to be invented. **I6 (a `programId` filter on academic units) is the cheapest and highest-value**: the field is required on every unit, the `where` clause already exists, and an optional filter breaks nothing. |
| G3 | Inverse lifecycle transitions — deactivate, deselect, unlock, restore | New lifecycle. Unlock matters most: locking is currently irreversible. |
| C2, C5, C7 | Maintenance vocabularies | `severity` is answered. `bypassRoles` accepts any string and only real role names have an effect — whether to constrain it to `RoleType` is a decision. Module and feature scope ids are not enumerated anywhere and enumerating them means deciding what the legal set is. |
| D5 | Audit export | New endpoint, new format, new size and permission questions. |
| G14 | Academic calendar — terms, holidays, exam windows | A new subsystem. The largest single absence in the report. |
| F12 | Branch settings | A new module. Inventoried in `branch-settings.md`. |
| B4, E9 | Logo and branding upload | New storage and upload infrastructure. Nothing in the platform accepts a file today. |
| B6 | Security policy — 2FA, session timeout, IP allowlisting | New fields and enforcement. Note `User.twoFactorSecret` exists but is never written, and its schema comment records that it must be encrypted before first use. |

---

## 8. Corrections to the report

Stated for the record, since the report is otherwise accurate:

- **E2** — the list is not "active only"; `SUSPENDED` organizations are
  returned.
- **G15, H12, I14** — the transitions *are* audited; they share the entity's
  `.updated` event name rather than having none.
- **B7** — uptime and database health *are* available, from the health probes.
- **I2** — `unitType` is a nine-value enum; the "avoid hardcoding" advice is
  about branching logic, not about the column being free text.
- **D4** — both candidate shapes were wrong. Pagination is nested under `data`.
