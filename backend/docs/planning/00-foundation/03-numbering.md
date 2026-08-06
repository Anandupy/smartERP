# F3 — Numbering & Identity Engine

> **Status:** `planned` — §10 has two open questions
> **Depends on:** Organization, Branch, AcademicYear
> **Depended on by:** I2 (application numbers), I3+I4+I5 (`studentCode`, `admissionNo`), Finance (receipts, invoices), Certificates (TC numbers), Employee

**This is a rewrite of existing code.** `NumberingService`
(`src/modules/admissions/numbering/numbering.service.ts`) and its two models
exist and are in use. Four defects make them unusable for identity numbers —
§2.1 documents each with its line reference.

---

## 1. Purpose

One engine generates every human-facing business identifier in the ERP:
`studentCode`, `admissionNo`, `applicationNo`, `admissionFormNo`,
`employeeCode`, receipt, invoice, TC and certificate numbers.

It does **not** own primary keys — those are UUID v7 and are never generated
here. The split is deliberate: UUIDs are for machines and foreign keys, business
identifiers are for humans, ID cards and certificates (§3 Q25).

It also does not own **where** the generated value is stored or **whether it is
unique** in its destination. Uniqueness is enforced by the destination table's
own constraint (§4 invariant 5) — a generator cannot be the last line of defence
for a value it hands to someone else.

---

## 2. Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | **Two allocation modes: `GAPLESS` and `MONOTONIC`** | The most important decision here. See §2.2 — treating everything as gapless imposes serialization on operations that never needed it. |
| D2 | **Sequences may be scoped to an organization OR a branch** | `studentCode` is organization-scoped (§3 Q13 as corrected); `admissionNo` is branch-scoped (§2 Q11). Today only branch scope is expressible. |
| D3 | **Allocation is a single SQL statement** — upsert-and-increment | Removes the counter-creation race entirely, rather than catching it (§2.1 defect 3). |
| D4 | **Format placeholders resolve _before_ the increment** | Every millisecond between increment and commit is lock-hold time on a row every concurrent admission at that branch is waiting for. |
| D5 | **`purpose` and `resetStrategy` become enums** | Free strings today. A typo silently creates a second, parallel sequence. |
| D6 | **A format must contain `{sequence}`, validated at config creation** | Without it every generated value is identical, and the failure surfaces as a confusing unique-violation at the destination. |
| D7 | **`studentCode` never resets and embeds nothing volatile** | `STU` + 10 digits, organization-scoped, `resetStrategy: NEVER`. Branch and year both change (§5); the code must not. |
| D8 | **Numbers are never reused, not even after a rollback or a void** | A voided receipt keeps its number and is marked void. Reissuing a number breaks every audit that assumed sequence uniqueness. |

### 2.1 Defects in the current implementation

| # | Defect | Evidence | Consequence |
| :--- | :--- | :--- | :--- |
| 1 | **Organization-scoped sequences cannot be expressed** | `branchId String` (not null) and `@@unique([branchId, purpose])` in `numbering.prisma` | `studentCode` per-organization is impossible as designed. Schema blocker. |
| 2 | **Not gapless, and not transactional** | `applicant.service.ts:212–221` allocates, `:230` inserts — no shared transaction, `generateNextNumber` called without `txClient` | A failure between the two burns a number permanently |
| 3 | **The race "fix" cannot work inside a transaction** | `numbering.service.ts:99–117` — `create` in `try`, `findFirst` in `catch` | Once the `create` raises a unique violation inside a transaction, Postgres aborts that transaction. The `findFirst` in the `catch` then fails with *"current transaction is aborted"*. The handler makes things worse precisely where `admit()` will use it. The bare `catch` also swallows unrelated errors. |
| 4 | **Lookups happen inside the lock window** | `numbering.service.ts:134–148` — branch and academic-year reads occur *after* the increment | Extends lock hold on the counter row, throttling concurrent admissions per branch |

Defect 3 is the one to highlight: it is not a latent risk, it is a bug that
activates the moment numbering is called inside the `admit()` transaction, which
is exactly what I3+I4+I5 requires.

### 2.2 Gapless versus monotonic — and why it matters

An earlier note in this project said *"a permanent `studentCode` cannot have
holes or collisions."* **Half of that is wrong.** Collisions are fatal; holes
are cosmetic. Nobody audits student codes for continuity.

Financial and statutory documents are different — GST invoice numbering and
receipt books are checked for continuity, and a missing number is a question an
auditor will ask.

| Mode | Guarantee | Allocation | Cost | Used by |
| :--- | :--- | :--- | :--- | :--- |
| **`MONOTONIC`** | Unique, increasing. **Gaps permitted.** | Own short transaction; commits immediately | None — no contention | `studentCode`, `admissionNo`, `applicationNo`, `admissionFormNo`, `employeeCode` |
| **`GAPLESS`** | Unique, increasing, **no gaps** | Inside the caller's transaction; rolls back with it | Counter row locked until the caller commits — serializes that purpose for that scope | `RECEIPT`, `INVOICE`, `TC_NUMBER` |

This resolves the tension in `../../admissions/numbering-review.md`, which
recommended wrapping allocation in the caller's transaction (§2B) and then
observed that doing so throttles throughput (§2C). Both are right — for
different purposes. Paying serialization for receipts is correct. Paying it for
every admission form is not.

---

## 3. Data model

### 3.1 `NumberSequenceConfig` — changes

| Change | Field | Detail |
| :--- | :--- | :--- |
| **add** | `scope` | `SequenceScope` — `ORGANIZATION` \| `BRANCH` (D2) |
| **change** | `branchId` | `String` → `String?` — null when `scope = ORGANIZATION` |
| **add** | `allocationMode` | `AllocationMode` — `GAPLESS` \| `MONOTONIC` (D1) |
| **change** | `purpose` | `String` → `SequencePurpose` enum (D5) |
| **change** | `resetStrategy` | `String` → `ResetStrategy` enum — `NEVER` \| `YEARLY` |
| **replace** | `@@unique([branchId, purpose])` | Two partial indexes (§4) |

`prefix`, `suffix`, `format`, `sequencePadding`, `includeBranchCode`,
`includeAcademicYear`, `isActive` are unchanged.

### 3.2 `SequencePurpose`

| Purpose | Scope | Reset | Mode | Example |
| :--- | :--- | :--- | :--- | :--- |
| `STUDENT_CODE` | ORGANIZATION | NEVER | MONOTONIC | `STU0000012345` |
| `EMPLOYEE_CODE` | ORGANIZATION | NEVER | MONOTONIC | `EMP0000000418` |
| `ADMISSION_NO` | BRANCH | YEARLY | MONOTONIC | `MUM-2026-0042` |
| `ADMISSION_FORM` | BRANCH | YEARLY | MONOTONIC | `ADM-2026-0117` |
| `APPLICATION` | BRANCH | YEARLY | MONOTONIC | `APP-2026-0117` |
| `RECEIPT` | BRANCH | YEARLY | **GAPLESS** | `RCP-2026-000241` |
| `INVOICE` | BRANCH | YEARLY | **GAPLESS** | `INV-2026-000108` |
| `TC_NUMBER` | BRANCH | YEARLY | **GAPLESS** | `TC-2026-0033` |
| `CERTIFICATE` | BRANCH | YEARLY | MONOTONIC | `BON-2026-0451` |

### 3.3 `NumberSequenceCounter` — unchanged shape, corrected index

The columns stay. The unique constraint does not — see §3.5.

### 3.4 The allocation statement (D3)

One statement replaces `numbering.service.ts:92–131`:

```sql
INSERT INTO "NumberSequenceCounter" ("id", "configId", "academicYearId", "currentValue", "updatedAt")
VALUES ($1, $2, $3, 1, now())
ON CONFLICT ("configId", COALESCE("academicYearId", '00000000-0000-0000-0000-000000000000'))
DO UPDATE SET "currentValue" = "NumberSequenceCounter"."currentValue" + 1,
              "updatedAt"    = now()
RETURNING "currentValue";
```

No find-then-create, no `try`/`catch`, no race window. Two concurrent callers
serialize on the row lock and both get distinct values.

### 3.5 ⚠️ The NULL trap

`@@unique([configId, academicYearId])` looks correct and **silently does not
work** for `resetStrategy: NEVER`, where `academicYearId` is null.

Postgres treats NULLs as **distinct** in a unique index. Two rows with the same
`configId` and null `academicYearId` do not conflict. So:

- the unique constraint does not actually constrain `NEVER` sequences, and
- `ON CONFLICT` never matches, so every call **inserts a fresh counter starting
  at 1** — producing duplicate `studentCode` values indefinitely.

`STUDENT_CODE` and `EMPLOYEE_CODE` are exactly the purposes that use
`resetStrategy: NEVER`. **This would corrupt the identifier the entire ERP is
built on.**

The fix is a functional unique index over a coalesced value, which the statement
above targets:

```sql
CREATE UNIQUE INDEX counter_config_year_unique
  ON "NumberSequenceCounter" (
    "configId",
    COALESCE("academicYearId", '00000000-0000-0000-0000-000000000000')
  );
```

*(On Postgres 15+, `UNIQUE NULLS NOT DISTINCT ("configId","academicYearId")` is
cleaner. The version in use is not pinned anywhere in this repository — see
§10 Q1 — so the functional index is specified because it works on every
supported version.)*

### 3.6 Allocation order (D4)

1. Load config (cacheable — configs change rarely)
2. Resolve `{branchCode}` and `{year}` — **before** touching the counter
3. Execute §3.4
4. Format the string
5. Return

Steps 1–2 must not sit between the increment and the caller's commit.

---

## 4. Invariants

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | One config per purpose per organization | `CREATE UNIQUE INDEX ON "NumberSequenceConfig" ("organizationId","purpose") WHERE "scope" = 'ORGANIZATION' AND "deletedAt" IS NULL` |
| 2 | One config per purpose per branch | `CREATE UNIQUE INDEX ON "NumberSequenceConfig" ("branchId","purpose") WHERE "scope" = 'BRANCH' AND "deletedAt" IS NULL` |
| 3 | `branchId` present exactly when scope is BRANCH | `CHECK (("scope" = 'BRANCH') = ("branchId" IS NOT NULL))` |
| 4 | One counter per config per year | the functional index in §3.5 |
| 5 | **The generated value is unique at its destination** | `Student.@@unique([organizationId, studentCode])`, `Admission.@@unique([branchId, admissionNo])`, and equivalents. A generator bug surfaces as a rejected insert, never as two students sharing a code. |
| 6 | A format contains `{sequence}` | Validated at config create/update (D6) |
| 7 | `currentValue` never decreases | No decrement path exists; no reset endpoint (D8) |

Invariant 5 is the one that matters most: **the engine is not trusted.** Even
with every defect above unfixed, a duplicate `studentCode` could not reach the
database.

---

## 5. Provenance

Numbers are allocated, never returned to the pool (D8).

| Situation | Result |
| :--- | :--- |
| `MONOTONIC` allocation, caller then fails | Number is burned. A gap appears. Acceptable by definition. |
| `GAPLESS` allocation, caller then fails | Counter rolls back with the transaction. No gap, no burn. |
| Receipt voided after issue | Number **retained**, row marked void. Never reissued. |
| Config edited (prefix/format changed) | Historical values are untouched — they are stored strings, not derived at read time |

That last row is worth stating plainly: a generated identifier is **persisted**,
not recomputed. Changing a format next year must never alter an ID card printed
this year.

---

## 6. Lifecycle

Configs: `created → active → (edited) → soft-deleted`. Counters are created
implicitly by first allocation and never deleted while their config exists.

**Format changes mid-year are permitted but discouraged**, and produce a
visible discontinuity in the series. A warning at the API level is appropriate;
a hard block is not, because correcting a genuinely wrong prefix is a legitimate
need.

**There is no reset endpoint** (D8, invariant 7). A branch wanting to restart
numbering configures `resetStrategy: YEARLY`; it does not get a button that
rewinds a live counter.

---

## 7. API surface

| Method | Path | Purpose | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/numbering/configs` | Create a sequence config | `ORG_ADMIN`+ |
| `GET` | `/v1/numbering/configs` | List for the current scope | `BRANCH_ADMIN`+ |
| `PATCH` | `/v1/numbering/configs/:id` | Edit format, prefix, padding | `ORG_ADMIN`+ |
| `POST` | `/v1/numbering/configs/:id/preview` | Render a sample without consuming a number | `BRANCH_ADMIN`+ |
| `DELETE` | `/v1/numbering/configs/:id` | Soft delete | `ORG_ADMIN`+ |

**There is no "generate a number" endpoint.** Allocation happens only inside a
business operation that is about to persist the result. An endpoint that hands
out numbers on request would guarantee gaps and invite misuse.

The `preview` endpoint exists so administrators can see the effect of a format
change without burning a value — the absence of which is why people test
formats by creating throwaway applicants.

| Rule broken | Status | `error.code` |
| :--- | :--- | :--- |
| Config already exists for scope + purpose | `409` | `ConflictException` |
| Format missing `{sequence}` | `400` | `BadRequestException` |
| `branchId` supplied for an `ORGANIZATION` config | `400` | `BadRequestException` |
| No config found at allocation time | `500` | `InternalServerErrorException` — a missing config is a provisioning failure, not a user error |

`ApplicantService.ensureNumberConfig` (`applicant.service.ts:37`) creates
configs on the fly to avoid runtime failures. **That is removed.** Silently
inventing a numbering scheme is worse than failing loudly; configs belong in
tenant provisioning (P2).

---

## 8. Events

| Event | When |
| :--- | :--- |
| `numbering_config.created` | Config created *(exists today)* |
| `numbering_config.updated` | Format, prefix or padding changed — **audit-relevant**, since it alters every future identifier |

Allocations are **not** evented. They occur thousands of times a day inside
other operations, and the number is already visible on the record that carries
it. The event that matters is the configuration change.

---

## 9. Dependencies

**Requires:** Organization, Branch, AcademicYear.

**Depended on by:**

| Consumer | Purpose | Mode |
| :--- | :--- | :--- |
| `admit()` (I3+I4+I5) | `STUDENT_CODE`, `ADMISSION_NO` | MONOTONIC |
| Applicant create (I2) | `ADMISSION_FORM`, `APPLICATION` | MONOTONIC |
| Finance (O3) | `RECEIPT`, `INVOICE` | GAPLESS |
| Certificates (O4) | `TC_NUMBER`, `CERTIFICATE` | GAPLESS / MONOTONIC |
| Employee (S4) | `EMPLOYEE_CODE` | MONOTONIC |

**Provisioning:** every organization needs `STUDENT_CODE` and `EMPLOYEE_CODE`
configs at creation; every branch needs the branch-scoped set. This belongs in
tenant onboarding (P2) and is the direct replacement for `ensureNumberConfig`.

**Migration:** development data only. Add `scope`, `allocationMode`, convert the
two string columns to enums, replace the unique constraints, and seed the
organization-scoped configs. Existing branch configs map to `scope: BRANCH`,
`allocationMode: MONOTONIC`.

---

## 10. Open questions

| # | Question | Blocks | Options |
| :--- | :--- | :--- | :--- |
| **Q1** | **Which Postgres version is targeted?** | The unique-index form in §3.5 | No version is pinned in this repository — no `docker-compose`, and `migration_lock.toml` records only the provider. On 15+, `UNIQUE NULLS NOT DISTINCT` is clearer and self-documenting; below that, the functional `COALESCE` index is required. The spec uses the functional index because it works everywhere, but this should be pinned somewhere regardless — a version assumption that lives only in someone's head is a deployment surprise. |
| **Q2** | **Does `GAPLESS` need to survive a same-second collision at scale?** | Receipt throughput | Gapless allocation serializes every receipt for a branch+year on one row. A branch collecting fees on the last day before a deadline may see contention. Options: (a) accept it — a school branch issues at most a few thousand receipts a day and lock hold is milliseconds; (b) a dedicated short transaction that commits the number before the receipt, reintroducing gaps and defeating the purpose. **Recommendation: (a)**, revisited only if measurement shows a problem. Flagged because it is the one place this design deliberately chooses correctness over throughput. |

---

## 11. Acceptance scenarios

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | 50 concurrent `admit()` calls in one organization | 50 **distinct** `studentCode`s. No duplicates, no deadlock. Gaps permitted. |
| 2 | **`STUDENT_CODE` allocated 1,000 times with `resetStrategy: NEVER`** | Exactly **one** counter row exists; values run 1…1000. Guards §3.5 — with the naive unique index this yields 1,000 counters all returning 1. |
| 3 | `MONOTONIC` allocation, caller transaction then rolls back | Number burned, gap appears, **no duplicate ever issued** |
| 4 | `GAPLESS` receipt allocation, caller then rolls back | Counter rolled back. Next receipt takes the same value. **No gap.** |
| 5 | 20 concurrent receipt allocations | Values 1…20 with **no gaps and no duplicates** |
| 6 | Two concurrent callers for a purpose with no counter yet | Both succeed; one counter row; values 1 and 2. Guards defect 3. |
| 7 | Allocation inside a transaction where the counter does not yet exist | Succeeds. **Reproduces defect 3 against the current code**, which fails with *"current transaction is aborted"*. |
| 8 | Config with format `{prefix}-{year}` (no `{sequence}`) | Rejected at config creation (invariant 6) |
| 9 | `ORGANIZATION`-scoped config supplied with a `branchId` | Rejected (invariant 3) |
| 10 | Two `STUDENT_CODE` configs in one organization | Second rejected (invariant 1) |
| 11 | Prefix changed from `STU` to `STD` mid-year | Existing student codes **unchanged**; only new allocations use `STD` |
| 12 | **Raw SQL**: insert a second Student with an existing `studentCode` | Rejected by the destination constraint (invariant 5) |
| 13 | Branch A and Branch B allocate `ADMISSION_NO` concurrently | Independent counters, no cross-branch contention |

Scenarios 2 and 7 are the ones that catch the defects in the current
implementation — 2 catches the NULL trap, 7 catches the aborted-transaction
handler. Both **fail against today's code**, which is the point of writing them
down before the rewrite.
