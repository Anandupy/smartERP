# Admission → Enrollment → Student Identity — Implementation Architecture

> **Status:** `planned` — implementation-ready. §50 lists the open questions; the
> blocking ones are called out in §47 Phase 0.
> **Type:** Cross-cutting build blueprint. Not a module spec — it consolidates
> F3, I1, I2, I3+I4+I5 and their supporting modules into one dependency-ordered
> plan and resolves the conflicts between them.
> **Supersedes on conflict:** where this document and a module spec disagree,
> this document states which is correct and why. Nothing else is superseded.
> **Depends on:** [`00-foundation/01-data-protection.md`](00-foundation/01-data-protection.md),
> [`00-foundation/02-configuration.md`](00-foundation/02-configuration.md),
> [`00-foundation/03-numbering.md`](00-foundation/03-numbering.md),
> [`01-identity-core/01-person.md`](01-identity-core/01-person.md),
> [`01-identity-core/02-applicant.md`](01-identity-core/02-applicant.md),
> [`01-identity-core/03-05-admission-student-enrollment.md`](01-identity-core/03-05-admission-student-enrollment.md)

---

## Reading order

| If you are… | Read |
| :--- | :--- |
| About to write code | §3, §8, §9, §47 (phases), §48 (never do this) |
| Designing a downstream module | §14 (identifiers), §46.4 (which id to store), §46 (dependency graph) |
| Reviewing this design | §9 (gaps), §49 (invariants), §51 (decision record), §50 (open questions) |
| Looking for what changed | §9.1 (this document's corrections to existing specs) |

---

# 1. Executive Summary

CampusFlow has **no Student domain**. It has an Applicant, a nine-state applicant
workflow, and an Enrollment table that hangs off the Applicant by a unique
foreign key with `onDelete: Cascade`. Deleting an applicant destroys the academic
record. There is no permanent learner identity anywhere in the schema, and no
place to record "this person studied at this branch from this date to that date"
— which is the exact record a Transfer Certificate is issued against.

This document specifies the four-layer model that fixes it:

```
Person          "is this the same human?"          — org-scoped matching index
   │
   ▼
Student         permanent learner identity          — org-scoped, never year-scoped
   │
   ▼
Admission       one continuous spell of study       — branch-scoped, immutable branch
   │
   ▼
Enrollment      one academic year of study          — year-scoped, superseded not edited
```

**The five load-bearing decisions:**

1. **Student is created at joining, not at approval.** A `SEAT_CONFIRMED`
   applicant who never turns up must never become a Student. Student, Admission
   and the first Enrollment are written in **one transaction**.
2. **`studentCode` is `STU` + fixed-width digits, unique per organization,
   embedding nothing that can become false.** No year, no branch, no org code.
   It is not a foreign key and never becomes one.
3. **Student's `branchId` is a mutable pointer; Admission's `branchId` is
   immutable.** That single asymmetry is what makes branch transfer possible
   without rewriting history.
4. **Downstream modules attach to `enrollmentId` when the fact is about a year,
   and to `studentId` when it is about the person.** §46.4 is the binding matrix.
5. **Events that downstream modules build state from go through a transactional
   outbox** placed *behind* the existing `EventBus` abstraction, so no business
   module and no existing consumer changes.

**Implementation cannot start on Student.** Four defects in code that `admit()`
will call would corrupt the identifier the entire ERP is built on, or leak data
across tenants. They are Phase 0 (§47) and they are not negotiable:

| # | Blocker | What breaks without it |
| :--- | :--- | :--- |
| **B1** | Numbering: the `NULL`-distinct trap on `NumberSequenceCounter` | Every `STUDENT_CODE` allocation creates a fresh counter returning `1`. **Duplicate student codes, indefinitely.** |
| **B2** | Numbering: `create`-in-`try`/`findFirst`-in-`catch` inside a transaction | The first `admit()` on a fresh sequence fails with *"current transaction is aborted"* |
| **B3** | BOLA: unscoped lookups in Applicant, Workflow and Enrollment services | A Branch A admin can already **enroll a Branch B applicant into Branch A**. §8.2. |
| **B4** | `Enrollment.applicantId @unique` + `onDelete: Cascade` | One enrollment per person forever; applicant deletion destroys academic history |

**Implementation readiness: NOT READY** until Phase 0 closes. Everything after
Phase 0 is specified here to implementation level.

---

# 2. Scope

## 2.1 In scope

| Area | Deliverable |
| :--- | :--- |
| Person | New module — matching index, `resolve()`, `findCandidates()`, merge |
| Student | New module — permanent identity, lifecycle, search |
| Admission | New model — spell of study, exit, transfer, readmission |
| Enrollment | **Rewritten** as a first-class module — placement, promotion, correction |
| Applicant | Delta — `personId`, `programId`, enum status, three new states |
| Numbering | **Rewritten** — org scope, two allocation modes, safe allocation |
| WorkflowHistory | Generalised from `applicantId` to polymorphic `(entityType, entityId)` |
| Outbox | New infrastructure — durable event publication behind `EventBus` |

## 2.2 Explicitly out of scope for this build

| Excluded | Why | Where it goes |
| :--- | :--- | :--- |
| **Seat capacity / seat matrix** | `AcademicUnit` has **no capacity column**. The "validate capacity" step in the requested flow has nothing to validate against. Building a fake check is worse than none. | Later phase; §50 Q3 |
| Student merge (execution) | Rare, irreversible, high blast radius. The design must not **preclude** it — §19.3 guarantees that — but building it now is speculative. | §19.3, deferred |
| Organization transfer | Not a workflow. It is tenant data migration. | §21 |
| Guardian / Address / Document **implementation** | Separate specs (S1/S2/S3). This document specifies only the **contract** between them and Student. | §24, §25, §26 |
| Parent portal, alumni, attendance, exams, fees | Consumers. Their reference contract is fixed here (§46.4) so they cannot force a change to Student later. | §46.4 |
| Elasticsearch | PostgreSQL is sufficient to well past the target scale. §39. | Not planned |

## 2.3 The four sources this document reconciles

Per the standing instruction not to treat these as the same thing:

| Layer | Meaning | Where recorded |
| :--- | :--- | :--- |
| **ACTUAL CURRENT STATE** | Verified by reading `prisma/modules/**` and `src/modules/**` | §3–§8. Every claim carries a file reference. |
| **DOCUMENTED INTENDED STATE** | The planning specs and the admissions audits | Cited by path; contradictions listed in §9.1 |
| **USER-APPROVED BUSINESS DECISIONS** | The frozen Q&A and the identity clarifications in this task | Marked **DECIDED** in §51 and never downgraded |
| **RECOMMENDED FUTURE ARCHITECTURE** | This document's own judgement | Marked **RECOMMENDED** / **REQUIRES R&D** in §51 |

---

# 3. Current Backend State

Verified against the repository, not against documentation.

## 3.1 Stack

NestJS · TypeScript · Prisma · PostgreSQL · modular monolith · UUID v7 primary
keys (`@default(uuid(7))` throughout) · modular Prisma schema assembled from
`prisma/modules/**/*.prisma` · in-process `EventBus` abstraction with an
`EventEmitter` adapter · event-driven `AuditLog` · `AsyncLocalStorage`-backed
request context.

## 3.2 What exists

| Module | Path | State |
| :--- | :--- | :--- |
| Organization | `src/modules/organization/` | Built |
| Branch | `prisma/modules/organization/branch.prisma` | Built |
| AcademicYear | `src/modules/academic-year/` | Built — `isLocked` exists, **nothing in admissions honours it** |
| Program | `src/modules/program/` | Built — **branch-scoped**, no `organizationId` |
| AcademicUnit | `src/modules/academic-unit/` | Built — self-referencing tree, 9 unit types |
| Applicant | `src/modules/admissions/applicant/` | Built |
| Workflow | `src/modules/admissions/workflow/` | Built — 9 states, in-memory matrix |
| Enrollment | `src/modules/admissions/enrollment/` | Built — **wrong shape**, §5 |
| Guardian | `src/modules/admissions/guardians/` | Built — branch-scoped, plaintext Aadhaar |
| Numbering | `src/modules/admissions/numbering/` | Built — **four defects**, §6 |
| Masters (10) | `src/modules/admissions/masters/` | Built — three-tier nullable scoping |
| Auth / User | `src/modules/auth/`, `src/modules/user/` | Built |
| Authorization | `src/modules/authorization/` | Built — catalog + role/user overrides |
| Context | `src/modules/context/` | Built — **single-writer, fixed**, §8.1 |
| Events | `src/infrastructure/events/` | Built — in-process, **no durability** |
| Audit | `src/infrastructure/audit/` | Built — event-driven, allowlisted |
| Communication | `src/modules/communication/` | Built |
| Workspace | `src/modules/workspace/` | Built |

## 3.3 What does **not** exist

Confirmed by `grep "model X" prisma/modules/` returning nothing:

```
Person            Student           Admission
Document          DocumentVersion   Address           PersonAddress
OutboxEvent       UserIdentityLink  PersonSensitive   OrganizationDataKey
ConfigDefinition  ConfigValue
```

`Applicant.photoFileId` (`prisma/modules/admissions/applicant.prisma`) is a
column **whose target table does not exist**. It references nothing.

`src/common/events/examples/student-created.event.ts` exists as an *example
file*. It is not published by anything. `docs/core/audit.md` lists
`student.created`, `student.updated` and `student.deleted` under "Integrated
Modules" — **those events are registered in the audit allowlist
(`audit.listener.ts:11–13`) but no code publishes them.** The allowlist entry is
ready; the producer is not.

## 3.4 Foundation constraints that shape the design

These are properties of what already exists, and Student/Enrollment must live
with them rather than working around them.

| # | Fact | Consequence for this design |
| :--- | :--- | :--- |
| **F-1** | `Program.branchId`, `AcademicYear.branchId`, `AcademicUnit.branchId` — **the entire academic structure is branch-scoped. None carries `organizationId`.** | An org-wide student query that touches academic structure must route through `Branch`. A branch transfer places the student against a **different `Program` row** even when the program is "the same" — so program identity is not portable across branches, and any cross-branch academic report must group by program *name*, not id. Recorded as §50 Q4. |
| **F-2** | `Branch.code` is `@unique` **globally**, across all tenants | Two organizations cannot both have a branch coded `MAIN`. Real multi-tenant defect. It does not block Student, but `{branchCode}` in a numbering format inherits it. §50 Q5. |
| **F-3** | `AcademicUnit @@unique([academicYearId, parentId, name])` with **nullable** `parentId` | Postgres treats NULLs as distinct, so **two root units may share a name in one year**. The same NULL trap as the numbering counter (§6.2). Flagged; not this build's fix. |
| **F-4** | Soft delete is inconsistent: `deletedAt` on admissions/masters/numbering, `isDeleted Boolean` on `Branch`, `Program`, `AcademicYear`, `AcademicUnit` | Student and Enrollment **must use `deletedAt`** and must not introduce a third convention. §39. |
| **F-5** | `AcademicYear.isLocked` exists; no admissions code reads it | Enrollment write paths must check it. New requirement, §18. |
| **F-6** | Permission catalog has `Student.{View,Create,Update,Delete,Export,Print}` but **no Enrollment permissions** | `student.delete` contradicts "no hard delete" — it is repurposed to mean *archive* in §30, and new `enrollment.*` permissions are added. |
| **F-7** | Migration baseline is clean (`00000000000000_baseline`), CI asserts zero drift | Adding Student is purely additive and safe. Rewriting Enrollment is destructive and needs the expand/contract discipline in `docs/core/migrations.md` §5 — or a clean slate, §43. |

---

# 4. Existing Admissions Architecture

## 4.1 `Applicant`

`prisma/modules/admissions/applicant.prisma` — one wide table holding identity,
demographics, government ids, contact, **inline address**, previous education,
admission detail, workflow timestamps, and four JSON extensibility columns.

Uniques: `[branchId, academicYearId, admissionFormNo]`,
`[branchId, academicYearId, applicationNo]`.

**What it gets right:** Applicant is an *admission attempt*, not a person. It is
temporary and terminal. Its demographic fields are a frozen legal snapshot of
what was declared on a date. That is correct and stays.

**What is wrong:**

| # | Defect | Evidence |
| :--- | :--- | :--- |
| A-1 | `admissionStatus` is a free `String` with a comment listing the values | `applicant.prisma`. The workflow engine validates transitions; nothing stops a direct write of `"aproved"`. |
| A-2 | No `personId` | The system cannot recognise a human. "One active application per year" (frozen §4 Q2) is **unenforceable** — there is no key to enforce it on. |
| A-3 | No `programId` | Program appears only on `Enrollment`, so an applicant who never enrolled has no program. Blocks the migration backfill (§43). |
| A-4 | `aadhaarNo` stored plaintext, indexed | Violates F1. Also `Guardian.aadhaarNo`. |
| A-5 | `photoFileId` targets no table | §3.3 |

## 4.2 The applicant workflow

`src/modules/admissions/workflow/workflow.service.ts`

Nine states in an in-memory `VALID_TRANSITIONS` matrix: `DRAFT`, `SUBMITTED`,
`UNDER_REVIEW`, `DOCUMENT_PENDING`, `FEE_PENDING`, `WAITLISTED`, `APPROVED`,
`REJECTED`, `CANCELLED`. `APPROVED`, `REJECTED` and `CANCELLED` are terminal
(empty transition arrays, `workflow.service.ts:49–51`).

**Correct:** the transition, timestamp update, history insert and conversion hook
all run inside one `prisma.$transaction` (`:60–124`). The event is published
*after* the transaction returns (`:126`) — right ordering, wrong durability
(§37).

**Wrong:**

| # | Defect | Evidence |
| :--- | :--- | :--- |
| W-1 | `tx.applicant.findUnique({ where: { id } })` — **no scope, no row lock** | `workflow.service.ts:62`. Any authenticated user with the role can transition any applicant in any tenant. Two concurrent approvals both read `UNDER_REVIEW` and both pass the guard. |
| W-2 | The student conversion hook is a `console.log` | `workflow.service.ts:152–159`. |
| W-3 | `APPROVED` is terminal | Blocks the offer → confirm → admit path this design requires. |
| W-4 | No remarks requirement on any transition | Rejection and cancellation carry `remarks: ''` by default (`:113`). |
| W-5 | `WorkflowHistory` is applicant-only (`applicantId String`, `onDelete: Cascade`) | Admission and Enrollment cannot share the audit engine. |

## 4.3 `ApplicantService`

`src/modules/admissions/applicant/applicant.service.ts`

- `ensureNumberConfig` (`:37`) **invents numbering configuration at runtime** if
  none exists — silently manufacturing an identifier scheme.
- Number allocation (`:212–221`) happens **outside any transaction**, before the
  insert at `:230`. A failure between them burns a number.
- `checkDuplicates` (`:62`) is branch-scoped and searches **only Applicants**, so
  it cannot see a returning dropout who is already enrolled.
- `findOne` (`:262`) filters on `{ id, deletedAt: null }` — **no scope**. `update`
  and `remove` both call it and then write by `id`. §8.2.

---

# 5. Existing Enrollment Architecture

`prisma/modules/admissions/enrollment.prisma` — 15 columns.

```prisma
applicantId      String  @unique
futureStudentId  String?          // points at nothing
enrollmentStatus String           // free string
applicant  Applicant @relation(..., onDelete: Cascade)
```

**This model cannot survive contact with the domain.** Five reasons:

| # | Defect | Consequence |
| :--- | :--- | :--- |
| E-1 | `applicantId @unique` | **One enrollment per applicant, forever.** Promotion is impossible. A twelve-year school career cannot be represented. |
| E-2 | `onDelete: Cascade` from Applicant | Soft-deleting is blocked in service code, but a hard delete or a raw `DELETE` **destroys the academic record**. The database permits the thing the domain forbids. |
| E-3 | No `studentId` | Every downstream module would have to reach the learner through `Applicant`, which is a temporary record that dies at admission. |
| E-4 | No `admissionId` | Nowhere to record a spell of study. A TC has no source. |
| E-5 | No provenance — no `originType`, `previousEnrollmentId`, `supersededById`, `changeReason` | Promotion, repeat, correction and mid-year transfer are indistinguishable, and a correction would have to **edit history in place**. |

`EnrollmentService` (`enrollment.service.ts`) compounds it:

- `createEnrollment` fetches the applicant with `findUnique({ where: { id } })`
  (`:26`) — **no scope check** — then writes `organizationId`, `branchId` and
  `academicYearId` **from the caller's request context** (`:67–69`). A Branch A
  administrator can therefore enroll a Branch B applicant into Branch A. This is
  not a read leak; it is a **cross-branch write**. See §8.2.
- `programId` and `academicUnitId` are checked for *existence* only (`:41–54`),
  never for belonging to the caller's branch or academic year.
- `getEnrollment` (`:99`) filters on `applicantId` alone.
- No transaction anywhere in the file.

---

# 6. Existing Numbering Architecture

`prisma/modules/admissions/numbering.prisma` +
`src/modules/admissions/numbering/numbering.service.ts`

Two models: `NumberSequenceConfig` (branch + purpose → format) and
`NumberSequenceCounter` (config + academic year → `currentValue`).

## 6.1 The four defects

| # | Defect | Evidence | Consequence |
| :--- | :--- | :--- | :--- |
| **N-1** | Organization-scoped sequences are **inexpressible** | `branchId String` (not null), `@@unique([branchId, purpose])` | `studentCode` unique per organization cannot be built. **Schema blocker.** |
| **N-2** | Allocation is neither gapless nor transactional | `applicant.service.ts:212` allocates, `:230` inserts, no shared transaction; `generateNextNumber` is called without `txClient` | A failure between them burns a number permanently |
| **N-3** | The race handler **cannot work inside a transaction** | `numbering.service.ts:99–117` — `create` in `try`, `findFirst` in `catch` | Once the `create` raises a unique violation inside a transaction, Postgres aborts it. The `catch`'s `findFirst` then fails with *"current transaction is aborted"*. The bare `catch` also swallows unrelated errors. **This activates the moment numbering runs inside `admit()`.** |
| **N-4** | Placeholder lookups sit **inside the lock window** | `numbering.service.ts:134–148` — branch and academic-year reads happen *after* the increment | Extends the lock hold on the counter row, throttling concurrent admissions per branch |

## 6.2 The defect that would corrupt the ERP

`@@unique([configId, academicYearId])` looks correct and **silently does not
work** for `resetStrategy: NEVER`, where `academicYearId` is null.

Postgres treats NULLs as distinct in a unique index. Two rows with the same
`configId` and a null `academicYearId` do not conflict. Therefore:

- the constraint does not constrain `NEVER` sequences, and
- an `ON CONFLICT` upsert never matches, so **every call inserts a fresh counter
  starting at 1**.

`STUDENT_CODE` and `EMPLOYEE_CODE` are precisely the purposes that use
`resetStrategy: NEVER`. Left unfixed, this produces duplicate student codes
indefinitely, and the only thing that would stop them reaching the database is
the destination table's own unique constraint — which turns every second
admission into an opaque 500.

**This is B1. Nothing about Student may be built before it is fixed.**

## 6.3 What the current code does correctly

The increment itself is a single raw `UPDATE ... RETURNING`
(`numbering.service.ts:120–125`), which is genuinely atomic and correctly takes a
row lock. The rewrite keeps that property and folds the find-or-create into the
same statement.

---

# 7. Existing Foundation Architecture

## 7.1 Academic structure

```
Organization
    └── Branch                    (code globally unique — F-2)
          ├── AcademicYear        (isActive, isSelected, isLocked)
          ├── Program             (level?, medium?, stream?, self-referencing)
          └── AcademicUnit        (branchId + programId + academicYearId + parentId,
                                   unitType ∈ SECTION CLASS DIVISION STREAM
                                   DEPARTMENT YEAR SEMESTER BATCH CUSTOM,
                                   level Int, self-referencing tree)
```

`AcademicUnit` is the configurable academic structure and **is already correct
for this design**. It is what stops `Class`, `Section`, `Semester`, `FY`/`SY`/`TY`
from being hard-coded anywhere. Enrollment references it by id and never
interprets its `unitType`.

Note that `AcademicUnit` carries `academicYearId` directly: a "Std 9-A" in
2026-27 and a "Std 9-A" in 2027-28 are **different rows**. That is correct and
convenient — it means an Enrollment's `academicUnitId` already implies its year,
and the explicit `academicYearId` on Enrollment is a denormalization that must be
kept honest (§40 invariant).

## 7.2 Events

`src/infrastructure/events/` — an abstract `EventBus` with an `EventEmitter`
adapter. Business modules inject the abstraction and publish `DomainEvent`
subclasses; every event carries a UUID v7 `eventId`, `eventName`, `occurredAt`,
`aggregateId`, `aggregateType`. Per `docs/core/events.md`, the event carries
**what** happened and `RequestContext` supplies **who**.

All domain events live in `src/common/events/` and are exported through
`index.ts`. Module-local `events/` directories are prohibited.

**Gap:** publication is in-process, in-memory, fire-and-forget, and occurs
*after* the database transaction. A process crash between commit and publish
loses the event permanently. §36, §37.

## 7.3 Audit

`src/infrastructure/audit/` — `AuditListener` subscribes to `EventBus`, enriches
with `RequestContextService`, maps through `AuditEventMapper`, writes `AuditLog`.
Business modules never import audit. `AuditLog` holds no foreign keys to business
tables, so history survives deletion.

**Two gaps:**

- `registeredEventNames` is an **allowlist**. An unregistered event bypasses
  audit silently. Every new Student/Enrollment event name must be added there.
- `AuditLog` has **no `eventId` column**. With an at-least-once outbox (§37), a
  relay retry produces duplicate audit rows with no way to deduplicate them.
  Adding `eventId String? @unique` is a Phase 0 prerequisite for the outbox.

## 7.4 Response contract

`docs/core/response-contract.md`. One envelope for success and failure:
`{ success, message, data, meta, error, requestId, timestamp }`. Controllers
return `{ data, message, meta }` and `GlobalResponseInterceptor` wraps it.
`error.code` is a `SCREAMING_SNAKE` machine code or the exception class name.

**Student must not invent a response shape.** One inconsistency exists at the
platform level: pagination lands on the envelope `meta` for some endpoints and
nested at `data.meta` for others, depending on whether the controller wraps the
service result. Student and Enrollment list endpoints **return the service result
unchanged** so pagination lifts onto the envelope `meta` — one convention, chosen
once. The platform-wide reconciliation is separate work.

---

# 8. Existing Security / Context Constraints

## 8.1 Execution context — already fixed, contrary to the brief

The task brief anticipates "multiple context writers, guards reading raw headers,
header naming mismatches". **Verified against the code: this has been fixed.**

- `RequestContext` is `Readonly<MutableRequestContext>`; a guard or service
  attempting `request.context.branchId = …` **fails to compile**.
- `RequestContextService.applyExecutionScope` is the single mutation point, and
  `grep` confirms its only callers are two lines in
  `src/modules/context/guards/execution-context.guard.ts` (`:78`, `:127`).
- `RequestContextMiddleware` no longer copies `x-branch-id` into the context —
  an unvalidated header is not a scope.
- Header aliases (`x-tenant-id`, `x-academic-year`) are accepted and resolved
  identically; the hierarchy resolves **upward** (naming a branch derives its
  organization), and deriving is a lookup that still passes validation, not a
  grant.
- Guards run in a fixed order with `ExecutionContextGuard` second, so nothing
  decides against an empty scope.

**Conclusion: platform context is NOT a blocker.** Student and Enrollment consume
`req.context` / `RequestContextService.getContext()` and introduce **no**
Student-specific context mechanism. §29 states the rules.

## 8.2 BOLA / IDOR — a live, unfixed, exploitable defect

`docs/admissions/security-review.md` §3B identifies this for
`ApplicantService.findOne`. The audit understates it. Verified extent:

| Location | Query | Reachable consequence |
| :--- | :--- | :--- |
| `applicant.service.ts:262` `findOne` | `{ id, deletedAt: null }` | Read any applicant in any tenant |
| `applicant.service.ts:290` `update` | `findOne(id)` then `update({ where: { id } })` | **Write** to any applicant in any tenant |
| `applicant.service.ts:405` `remove` | same | **Soft-delete** any applicant in any tenant |
| `workflow.service.ts:62` `transitionState` | `findUnique({ id })` | **Approve or reject** any applicant in any tenant |
| `workflow.service.ts:139` `getHistory` | `findUnique({ id })` | Read any applicant's decision history |
| `enrollment.service.ts:26` `createEnrollment` | `findUnique({ id })`, then writes scope **from the caller's context** | **Enroll another branch's applicant into your own branch.** Cross-branch write with fabricated scope. |
| `enrollment.service.ts:100` `getEnrollment` | `{ applicantId }` | Read any enrollment in any tenant |

`BranchGuard` and `AcademicYearGuard` do not close this. Reading
`src/common/guards/branch.guard.ts` and `docs/core/execution-context.md` §5: they
are **assertions that a scope was resolved**, with no database access. They prove
the caller named *a* branch. They do not prove the *resource* belongs to it.

The correct rule, which §30 makes mandatory for every Student and Enrollment
endpoint:

```
resource lookup  =  identifier  +  execution scope  +  permission
```

not

```
resource lookup  =  identifier
```

`findUnique({ where: { id } })` is banned in these modules. Every read is
`findFirst({ where: { id, organizationId, ...branchScope, deletedAt: null } })`,
and a scope miss returns **404, not 403** — a 403 confirms the row exists.

## 8.3 Other security facts

| Fact | Status |
| :--- | :--- |
| Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true` | Mass assignment closed |
| `Applicant.aadhaarNo` and `Guardian.aadhaarNo` plaintext and indexed | Open — F1 fixes it |
| Audit query API enforces role boundaries (SUPER_ADMIN global → STAFF self) | Working |
| UUID v7 leaks creation time | Accepted internally; one more reason not to expose ids publicly (§49) |

---

# 9. Problems and Architectural Gaps

## 9.1 Where the existing documents conflict, and which is correct

Recorded rather than silently resolved, per the standing instruction.

| # | Conflict | Resolution |
| :--- | :--- | :--- |
| **C-1** | Frozen §4 Q20 and `03-05-…md` §6.1 step 7 say `admit()` moves the applicant to **`APPROVED` (terminal)**. `02-applicant.md` D6 says `APPROVED` is an offer and **`ADMITTED`** is terminal. | **`02-applicant.md` is correct.** `APPROVED` = "offer made, seat provisionally held"; `ADMITTED` is terminal. §17 is authoritative. |
| **C-2** | Frozen §3 Q13/Q15 make `studentCode` **globally unique across all tenants**. `01-04-review…md` D1 and `03-05-…md` D2 make it **per organization**. | **Per organization.** A global sequence leaks tenant volume through gaps and serialises student creation platform-wide. §13. |
| **C-3** | `admissions-production-audit.md` §7 states numbering "provides transaction-safe sequence generators for … Roll Numbers, and Student IDs". | **False on both counts.** It is not transaction-safe (§6.1 N-2, N-3), and neither roll numbers nor student ids are generated by it — no such purpose is configured. Roll number is **not** a numbering-engine concern (§23). |
| **C-4** | `docs/core/audit.md` lists `student.created/updated/deleted` as integrated Admissions events. | Registered in the allowlist; **no producer exists**. Documentation describes intent. §3.3. |
| **C-5** | `admissions-production-audit.md` §8 says `branchId` comes "from request header `x-branch-id`" into `RequestContextMiddleware`. | **Out of date.** The middleware no longer reads scope headers; `ExecutionContextGuard` resolves and validates them. §8.1. |
| **C-6** | The task brief lists context resolution as a probable blocker. | **Not a blocker.** Fixed and verified. §8.1. |
| **C-7** | `numbering-review.md` §2B recommends wrapping allocation in the caller's transaction; §2C observes that doing so throttles throughput. | Both are right for **different purposes**. Two allocation modes: `GAPLESS` (in the caller's transaction) and `MONOTONIC` (own short transaction). §34. |
| **C-8** | `02-applicant.md` §3.3 says "twelve states". | Thirteen. §17 enumerates them. |
| **C-9** | `numbering-review.md` §2A calls the `try`/`catch` race handler "an acceptable retry fallback". | **Not acceptable** inside a transaction — it is defect N-3. `00-foundation/03-numbering.md` defect 3 is correct. |
| **C-10** | Permission catalog defines `student.delete`. | Student has **no hard-delete path** (§19). The permission is repurposed to gate *archive*. §30. |

## 9.2 Gaps this document closes that no existing spec covers

| # | Gap | Where fixed |
| :--- | :--- | :--- |
| **G-1** | `1 Applicant → 1 Student` is a stated business rule with **no constraint proposed anywhere**. `Student.sourceApplicantId` is nullable and non-unique in `03-05-…md`. | Partial unique index, §40 INV-STU-009 |
| **G-2** | Cross-branch **write** via `EnrollmentService.createEnrollment` — the audit only documents the read leak | §8.2, §30 |
| **G-3** | No durable event publication; `student.created` can be lost after commit | Transactional outbox behind `EventBus`, §37 |
| **G-4** | `AuditLog` has no `eventId`, so an at-least-once relay duplicates audit rows | §37, Phase 0 |
| **G-5** | `sequencePadding` is editable; changing it for `STUDENT_CODE` produces mixed-width codes that break lexicographic sort and printed layouts | Immutable for `NEVER`-reset purposes, §13.6 |
| **G-6** | Academic structure is branch-scoped with no `organizationId`, so program identity is not portable across a branch transfer | §20, §50 Q4 |
| **G-7** | `AcademicYear.isLocked` is never checked by any write path | §18 guard, §30 |
| **G-8** | The requested `admit()` flow includes a **capacity check against a seat matrix that does not exist** | Explicitly out of scope, §2.2, §50 Q3 |
| **G-9** | No spec states whether Student carries its own contact details; search-by-mobile is a stated requirement | Decided, §43 |
| **G-10** | Concurrent `admit()` protection is asserted but no locking mechanism is specified; Prisma has no native row lock | Explicit `SELECT … FOR UPDATE` via `$queryRaw`, §33 |

## 9.3 Gap summary by severity

| Severity | Items |
| :--- | :--- |
| 🔴 **Blocks implementation** | N-1, N-2 (numbering NULL trap + aborted transaction), B3/§8.2 (BOLA read *and* write), E-1/E-2 (enrollment shape), G-1 (no 1:1 constraint) |
| 🟠 **Blocks correctness at scale** | G-3, G-4 (event durability), G-10 (concurrent admit), W-1 (no row lock), A-1 (free-string status) |
| 🟡 **Blocks a later module, not this one** | F-1/G-6 (branch-scoped programs), F-2 (global branch code), F-3 (unit name NULL trap), G-8 (seat capacity) |
| ⚪ **Hygiene** | F-4 (soft-delete convention), C-3/C-4/C-5 (stale documentation), A-5 (`photoFileId` dangling) |

---

# 10. Domain Model

## 10.1 The layering, and why each layer exists

```
                    ┌────────────────────────────────────────────┐
                    │  Person        "is this the same human?"    │
                    │  org-scoped · no lifecycle · no status      │
                    └───────────────────┬────────────────────────┘
                                        │ personId
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
     ┌────▼─────┐                 ┌─────▼──────┐               ┌──────▼─────┐
     │ Applicant│ sourceApplicant │  Student   │               │  Guardian  │
     │ one      │────────────────▶│ permanent  │               │ role facts │
     │ attempt  │                 │ identity   │               │            │
     │ frozen   │                 │ studentCode│               └────────────┘
     └──────────┘                 └─────┬──────┘
      dies at admission                 │ studentId
                                  ┌─────▼──────┐
                                  │ Admission  │  one spell of study
                                  │ admissionNo│  branchId IMMUTABLE
                                  │ entry→exit │
                                  └─────┬──────┘
                                        │ admissionId
                                  ┌─────▼──────┐
                                  │ Enrollment │  one academic year
                                  │ rollNumber │  academicYearId
                                  │ placement  │  superseded, never edited
                                  └─────┬──────┘
                                        │ programId, academicUnitId
                                  ┌─────▼───────────────────┐
                                  │  Academic Structure      │
                                  │  Program · AcademicUnit  │
                                  └──────────────────────────┘
```

Each layer exists because **something above it dies while something below it must
survive**:

| Layer | Dies when | So it cannot hold |
| :--- | :--- | :--- |
| Applicant | The applicant is admitted | Anything needed after admission |
| Enrollment | The student is promoted | Anything spanning years |
| Admission | The student leaves that branch | Anything spanning branches |
| Student | Never (within the organization) | Anything that varies with year or branch |
| Person | Never | Anything that varies with **role** |

**The placement test**, applied to every field in §41: *what does this fact vary
with?* If a field would have to be **copied** when a student is promoted, it is
in the wrong table.

## 10.2 Refinement of the conceptual model in the brief

The brief sketches `Applicant → Admission → Student → Enrollment`. Two
refinements, neither of which changes the intent:

**Refinement 1 — `Admission` sits between Student and Enrollment, not between
Applicant and Student.** An Admission is a *spell of study*, and a spell of study
belongs to a Student. The referential chain is
`Enrollment → Admission → Student → Person`. Without this layer there is nowhere
to record "joined Mumbai on 12 June 2026 under the RTE quota at Std 1, left on
30 April 2029 for a branch transfer" — the record a Transfer Certificate is
issued against, and which neither Applicant (dead) nor Enrollment (one year) can
hold.

**Refinement 2 — the brief's arrow `Enrollment → Student` describes the business
trigger, not the insert order.** Student is created *because* the applicant is
joining, which is what the brief means. Inside the single transaction the insert
order is forced by foreign keys:

```
Student  →  Admission  →  Enrollment          (insert order, FK-forced)
                ▲
        triggered by "the applicant is actually joining"   (business order)
```

Both readings hold: no Student exists until joining, and the rows go in in
dependency order.

## 10.3 The five concepts, held apart

| Concept | Answers | Scope | Lifespan | Never holds |
| :--- | :--- | :--- | :--- | :--- |
| **Person** | Is this the same human? | Organization | Forever | Anything a user edits or a screen displays |
| **Applicant** | What was declared, on what date, for which attempt? | Branch + year | Until terminal | Identity; the current truth about anyone |
| **Admission** | Where and when did this study spell run? | Branch (immutable) | Entry → exit | Anything that varies year to year |
| **Enrollment** | Where is this student placed *this year*? | Branch + year | One academic year | Identity; demographics; anything spanning years |
| **Student** | Who is this learner, permanently? | Organization | Forever | Placement; academic year; fees; attendance |
| **User** | Who is logging in? | — | Independent | Any domain fact. Linked, never merged. |

## 10.4 Data ownership matrix

Refined from the brief against the actual repository.

| Data | Owning module | Table | Note |
| :--- | :--- | :--- | :--- |
| Human identity / dedup keys | **Identity** | `Person` | New |
| Sensitive identifiers (Aadhaar) | **Data protection (F1)** | `PersonSensitive` | New; never on Student |
| Applicant record + frozen snapshot | **Admissions** | `Applicant` | Exists |
| Applicant workflow state | **Admissions › workflow** | `Applicant.admissionStatus` + `WorkflowHistory` | Exists; needs enum + polymorphism |
| Application / form numbers | **Numbering** allocates · **Admissions** stores | `Applicant` | Exists |
| **Student identity** | **Identity › Student** | `Student` | New |
| **`studentCode`** | **Numbering** allocates · **Student** stores and owns uniqueness | `Student` | New |
| Student current demographics | **Identity › Student** | `Student` | New |
| Spell of study, `admissionNo`, exit | **Admissions › Admission** | `Admission` | New |
| **Academic placement** | **Enrollment** | `Enrollment` | Rewritten |
| Roll number | **Enrollment** | `Enrollment.rollNumber` | **Not** numbering (§23) |
| Result outcome | **Examination** writes · **Enrollment** owns the column | `Enrollment.resultOutcome` | Column owned ≠ decision owned |
| Program, AcademicUnit, AcademicYear | **Academic structure** | existing | Branch-scoped (F-1) |
| Organization, Branch | **Organization** | existing | |
| Guardianship + role flags | **Guardian (S1)** | `Guardianship` | Person↔Person |
| Addresses | **Address (S2)** | `Address`, `PersonAddress` | Person-owned |
| Documents + requirements | **Document (S3)** | `Document`, `DocumentRequirement` | Polymorphic owner |
| Authentication | **Auth** | `User`, `UserIdentityLink` | Linked to Student, never equal |
| Permissions | **Authorization** | existing | |
| Audit trail | **Audit** infrastructure | `AuditLog` | Event-driven only |
| Event durability | **Outbox** infrastructure | `OutboxEvent` | New |
| Notifications | **Communication** | existing | Consumer only |
| Business policy | **Configuration (F2)** | `ConfigDefinition`, `ConfigValue` | New |

---

# 11. Student Identity Model

## 11.1 The Student module

| Aspect | Specification |
| :--- | :--- |
| **Location** | `src/modules/identity/student/` — **not** under `admissions/` |
| **Owns** | The permanent learner identity within one organization: `studentCode`, current official demographics, institutional identifiers, lifecycle status, the mutable `branchId` pointer |
| **Does not own** | Academic placement · academic year · fees · attendance · marks · documents · addresses · guardianships · login · the *human* (that is Person) |
| **Depends on** | Person, Numbering, Organization, Branch |
| **Depended on by** | Enrollment, Admission, and every future academic and operational module |
| **Must never import** | Attendance, Examination, Fees, Library, Transport, Hostel, Certificates, Alumni, Audit, Communication |

## 11.2 Is a separate `Person` justified?

The brief warns against inventing a generic Person abstraction because it sounds
enterprise-grade. The warning is correct and the question deserves a real answer
rather than an appeal to layering.

**Without Person, four concrete things are impossible:**

1. **The two-branch collision.** The same child is seat-confirmed at Mumbai and
   at Pune. Both `admit()` calls succeed. **Two Student identities, two
   `studentCode`s, one child.** Nothing detects it, because duplicate checking
   today is branch-scoped and searches only Applicants
   (`applicant.service.ts:62`).
2. **Readmission.** A dropout returns after two years. There is no way to find
   the existing Student, because the search is over Applicants and the returning
   learner is a Student.
3. **Sibling discovery.** Derived from shared guardianships — which need a stable
   identity at both ends that survives the applicant→student transition.
4. **A guardian who is also a student.** Adult education, or a teacher's child.
   One human, two roles, and no place to say so.

Person is **one thin table with five meaningful columns and no lifecycle**. It is
the cheapest available fix for all four. That is the justification, and it is
sufficient.

**What keeps it from sprawling** (I1 §1, adopted verbatim): Person holds *only
matching keys* — `govtIdHash`, `phoneHash`, `dob`, `nameNormalized`,
`mergedIntoPersonId`. A pull request adding a display name, a photo, a contact
field or an address to Person is rejected on sight; every one of those varies per
role, which is exactly what Person must not do.

## 11.3 What lives on Student, and what does not

| Category | On Student? | Where instead | Why |
| :--- | :--- | :--- | :--- |
| `id`, `studentCode`, `status` | ✅ | | Identity |
| `organizationId` | ✅ immutable | | Identity scope |
| `branchId` | ✅ **mutable pointer** | | Convenience for scoping reads. **Not identity** — Admission holds the immutable truth. |
| `personId` | ✅ immutable | | The human |
| Names, `dob`, `genderId` | ✅ | | **Current official truth** — deliberately a separate copy from Applicant's frozen snapshot |
| Religion, caste, category, mother tongue, blood group | ✅ master FKs | | Current values. Category legitimately changes on obtaining a certificate. |
| Disability status / type / notes | ✅ restricted read | | |
| APAAR, ABC, PEN, Saral, UDISE | ✅ plaintext | | F1 D5 — institutional identifiers designed to be shared and printed |
| **Aadhaar** | ❌ | `PersonSensitive` (F1) | One encrypted copy, one place to erase |
| Own mobile / email | ✅ nullable | | §39 — search-by-mobile requires it; an adult learner has their own |
| Guardian contact | ❌ | `Guardianship` → `Guardian` | Varies per relationship |
| Photo | ✅ **reference only** (`photoDocumentId`) | `Document` (S3) | Student is not a blob store |
| Address | ❌ | `PersonAddress` (S2) | Varies over time; shared between siblings |
| Documents | ❌ | `Document` (S3) | Student is not a document container |
| Guardianships | ❌ | `Guardianship` (S1) | Person↔Person; survives admission unchanged |
| `currentClass`, `currentSection`, `currentAcademicYear`, `currentProgram`, `currentRollNumber` | ❌ **forbidden** | `Enrollment` | §11.4 |
| Fees, attendance, marks, library, transport | ❌ **forbidden** | Their own modules, referencing inward | §46.4 |

## 11.4 Why there is no `currentEnrollmentId` on Student

The tempting denormalization is a `currentEnrollmentId` pointer. It is
**rejected**, for a reason that also removes the need for it:

> **"Current" is meaningless without an academic year — and the execution context
> always supplies one.**

Every authenticated request that touches a student resolves an `academicYearId`
(§8.1). So "the student's current enrollment" is not a stored pointer, it is a
query:

```
Enrollment
WHERE studentId       = :id
  AND academicYearId  = :context.academicYearId
  AND enrollmentKind  = 'PRIMARY'
  AND enrollmentStatus NOT IN ('SUPERSEDED','CANCELLED')
  AND deletedAt IS NULL
```

Backed by the index in §41 this is a single index probe returning at most one
row — guaranteed by partial unique index INV-ENR-002. A stored pointer would be
strictly worse: it needs maintaining on every promotion, correction, transfer,
supersede and cancel, and each of those is a chance to leave it stale while
looking authoritative.

**The escape hatch, if measurement ever demands it:** a materialized read model in
its own table (`StudentCurrentPlacement`), rebuilt from `enrollment.*` events,
explicitly labelled a projection — **never** columns on Student. Adding columns
to Student is precisely what makes the model impossible to evolve.

## 11.5 Non-responsibilities, stated as rules

1. Student **never** imports a module that consumes it. If Attendance needs
   something from Student, Attendance imports Student — never the reverse.
2. Student **never** imports `AuditService` or `AuditRepository`. It publishes
   domain events; audit is a subscriber (§38).
3. Student **never** reads a raw header. It reads the execution context (§29).
4. Student **never** writes `Enrollment` or `Admission` rows directly. The
   `admit()` orchestration composes the three services inside one transaction
   (§31); it does not reach into another module's tables.
5. Student exposes **no** `POST /v1/students` and **no** `DELETE`.

---

# 12. Student UUID v7

**DECIDED** — user requirement, matching the repository convention
(`@default(uuid(7))` on every model).

| Property | Value |
| :--- | :--- |
| Type | UUID v7 |
| Role | Primary key; the only foreign-key target for Student |
| Generation | `@default(uuid(7))` — database-side, never application-side |
| Mutability | **Immutable.** No correction path, no reassignment. |
| Scope | Globally unique by construction |
| Used for | Internal references, foreign keys, domain-event `aggregateId`, audit `aggregateId`, internal API path segments |
| **Not** used for | Anything a human reads, types, quotes on a support call, or prints |

**Why v7 rather than v4:** time-ordered, so index inserts append rather than
scatter. On a table that will hold millions of rows and take its heaviest write
burst during a two-week admission season, v4's random insert pattern fragments
the B-tree and inflates write amplification. v7 avoids it.

**The caveat, recorded honestly:** UUID v7 **encodes its creation timestamp**.
Anyone holding a student's UUID can read, to the millisecond, when the row was
created. Internally harmless; it is one more reason the identifier a parent
portal or external integration sees should be the `studentCode`, not the UUID
(§49).

**UUID uniqueness does not solve business duplication.** Two `admit()` calls for
the same person produce two perfectly unique UUIDs and one real-world disaster.
Business duplication is prevented by the constraints in §40 and the locking in
§33 — never by the key generator.

---

# 13. Student Code

**DECIDED** in principle by the user (both identifiers required; the code is
permanent; the code is not a foreign key). The **format** required research;
§13.2 is that research.

## 13.1 Purpose

`studentCode` exists so a human can identify a student without holding a UUID. It
is what appears on an ID card, a certificate, a fee receipt, a support call, a
CSV import and an export.

## 13.2 Format options evaluated

| | **A** `STU00000123` | **B** `STU-2026-000123` | **C** `BR01-STU-000123` | **D** `ORG01-BR01-2026-000123` | **E** ✅ `STU`+fixed-width, org-scoped, configurable prefix/width |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Survives academic-year change | ✅ | ❌ **becomes false** | ✅ | ❌ | ✅ |
| Survives branch transfer | ✅ | ✅ | ❌ **becomes false** | ❌ | ✅ |
| Survives merger / rebrand | ✅ | ✅ | ✅ | ❌ | ✅ |
| Unique within organization | ✅ | ✅ | ✅ | ✅ | ✅ |
| Leaks tenant volume | ❌ if global | ❌ if global | — | — | ✅ avoided (org-scoped) |
| Readable over a phone | ✅ | ⚠️ long | ⚠️ | ❌ | ✅ |
| Fits an ID card / certificate | ✅ | ✅ | ⚠️ | ❌ | ✅ |
| Lexicographic sort = numeric sort | ✅ fixed width | ✅ | ✅ | ✅ | ✅ **only if width never changes** (§13.6) |
| Counter contention | one/org | one/org/year | one/branch | one/branch/year | one/org — negligible |
| Institution can customise | ❌ | ❌ | ❌ | ❌ | ✅ prefix + width at provisioning |

### The disqualifying test

> **Does the identifier encode something that can become false?**

- **B** encodes the **admission year**. `STU-2026-000123` is wrong the moment the
  student is in 2031 — and worse, it *looks* like a year field, so reports,
  filters and humans will use it as one. A batch label pretending to be an
  identity.
- **C** encodes the **branch**. A Mumbai→Pune transfer makes `BR01` a lie, and the
  design explicitly requires the code to survive a transfer.
- **D** encodes both plus the organization — the worst of the three, and
  unreadable aloud.
- **A** and **E** encode nothing volatile. **E** is **A** with the prefix and
  width lifted into numbering configuration, which is the only genuine
  institutional variation here (some institutions want `ADM`, `REG`, or a school
  abbreviation).

## 13.3 Final recommendation — Option E

```
studentCode  =  {prefix}{sequence padded to {width}}

default      STU + 10 digits          →  STU0000000123
alternative  configured per organization at provisioning
uniqueness   @@unique([organizationId, studentCode])
scope        ORGANIZATION
reset        NEVER
mode         MONOTONIC   (gaps permitted — §34)
```

**Why organization-scoped, not global:** a global sequence leaks tenant volume.
If Organization A's codes run `…0410`–`…0455` in a week and the next allocation
is `…0892`, A has learned that other tenants issued ~437 codes that week.
Sequence gaps are a side channel, and "complete tenant isolation" is already a
frozen commitment. A global counter also serialises student creation across every
customer on the platform. Nothing in the stated reasons for a global code —
branch transfer, central reporting, parent portal, certificates, alumni —
operates outside a single organization.

**Why gaps are acceptable:** nobody audits student codes for continuity. A
collision is fatal; a hole is cosmetic. Receipts and invoices are different
(§34), and that difference is exactly why two allocation modes exist.

**Why fixed width matters more than the digit count:** fixed width is what makes
`ORDER BY studentCode` equal `ORDER BY sequence`, which every export, every CSV
and every printed register depends on. Ten digits will never roll over.

## 13.4 Permanence rules

| Event | Code changes? |
| :--- | :--- |
| Academic year rollover | ❌ |
| Promotion / detention / repeat | ❌ |
| Section, class or academic-unit change | ❌ |
| Program change (Science → Commerce) | ❌ |
| **Branch transfer** | ❌ — the Student row survives; only `branchId` and the Admission change |
| Graduation, withdrawal, expulsion, archival | ❌ |
| Readmission after a break | ❌ — same Student, new Admission |
| Numbering **format** change | ❌ — the value is **persisted**, never recomputed at read time |

**The single genuine exception, and its exact policy:** an **organization
transfer** produces a *new* Student in the target organization with a *new*
`studentCode`. That is not a code change — the original Student and its code
remain, unaltered, in the source organization. §21 explains why nothing else is
safe.

**Correction, not change.** A code assigned from a misconfigured sequence (wrong
prefix on day one of a deployment) may be corrected **once**, by `SUPER_ADMIN`,
through a dedicated audited operation publishing `student.code_corrected` with
both values, and **only** while the student has zero issued certificates and zero
printed receipts. Outside that window the answer is no. This is a break-glass
path so a provisioning error is fixable, deliberately narrow so it is not used
for anything else.

## 13.5 `studentCode` is not a foreign key

**DECIDED** — user requirement, enforced structurally rather than by convention:

- No table declares a foreign key to `Student.studentCode`.
- No module stores a `studentCode` column to mean "which student". Modules store
  `studentId UUID`.
- `studentCode` may be **displayed, searched, exported, printed, imported and
  quoted**. Import resolves it to a `studentId` at the boundary and never carries
  it inward.

The reason is not purity. It is that `studentCode` is the one identifier with a
correction path (§13.4), and a correctable value must never be the thing other
rows point at.

## 13.6 Padding is immutable for identity sequences

A gap no existing spec covers. `NumberSequenceConfig.sequencePadding` is
editable, and F3 §7 exposes a `PATCH` that can change it.

Changing the width of `STUDENT_CODE` mid-life produces `STU0000000999` followed
by `STU00000001000` — different lengths. That breaks lexicographic sort (so every
export and printed register reorders wrongly), breaks fixed-width ID-card and
certificate layouts, and breaks any downstream regex.

> **Rule:** for any config with `resetStrategy = NEVER`, `prefix` and
> `sequencePadding` are **immutable after the first allocation**. The API rejects
> the change with `400 SEQUENCE_WIDTH_IMMUTABLE`. `format` stays editable only in
> ways that do not alter the rendered length.

Choose the width once, at tenant provisioning.

---

# 14. Identifier Taxonomy

| Identifier | Purpose | Owner | Lifetime | Unique within | Editable | Regenerated | Human-facing | In API paths | Valid FK target | Year-scoped | Branch-scoped | Org-scoped | Globally unique |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `personId` | Same-human resolution | Identity | Forever | Organization | ❌ | ❌ | ❌ | ✅ internal | ✅ | ❌ | ❌ | ✅ | ✅ UUID |
| **`studentId`** | **The learner** | **Identity › Student** | **Forever** | Global | ❌ | ❌ | ❌ | ✅ internal | ✅ **preferred** | ❌ | ❌ | ✅ | ✅ UUID |
| **`studentCode`** | **Human identification** | Numbering allocates · Student owns | **Forever** | **Organization** | ❌ break-glass only | ❌ | ✅ | ⚠️ lookup only, `?code=` | ❌ **never** | ❌ | ❌ | ✅ | ❌ |
| `admissionId` | One spell of study | Admissions | Entry → exit | Global | ❌ | ❌ | ❌ | ✅ internal | ✅ | ❌ | ✅ | ✅ | ✅ UUID |
| `admissionNo` | Human ref for a spell | Numbering · Admission | Life of the admission | **Branch** | ❌ | ❌ | ✅ | ⚠️ lookup only | ❌ | ✅ yearly reset | ✅ | ❌ | ❌ |
| `enrollmentId` | One academic year | Enrollment | One year | Global | ❌ | ❌ | ❌ | ✅ internal | ✅ | ✅ | ✅ | ✅ | ✅ UUID |
| `applicantId` | One admission attempt | Admissions | Until terminal | Global | ❌ | ❌ | ❌ | ✅ internal | ⚠️ provenance only, **no cascade** | ✅ | ✅ | ✅ | ✅ UUID |
| `applicationNo` | Human ref for an application | Numbering · Applicant | Life of the application | Branch + year | ❌ | ❌ | ✅ | ⚠️ lookup only | ❌ | ✅ | ✅ | ❌ | ❌ |
| `admissionFormNo` | Physical form ref | Numbering · Applicant | Life of the application | Branch + year | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **`rollNumber`** | Class register position | **Enrollment** | **One year** | Unit + year | ✅ **until class list locks** | ✅ **alphabetical regeneration** | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `employeeCode` | Human ref for staff | Numbering · Employee | Forever | Organization | ❌ | ❌ | ✅ | ⚠️ lookup only | ❌ | ❌ | ❌ | ✅ | ❌ |
| `userId` | Authentication principal | Auth | Account life | Global | ❌ | ❌ | ❌ | ✅ internal | ✅ within auth | ❌ | ❌ | ⚠️ nullable | ✅ UUID |
| APAAR / ABC / PEN / Saral / UDISE | Government identifiers | Student stores; externally issued | Externally governed | External | ✅ corrigible | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | externally |

## 14.1 The four confusions this table exists to prevent

**`studentCode` ≠ `rollNumber`.** `studentCode` is permanent and
organization-wide. `rollNumber` is a *position in one class register for one
year*, commonly regenerated alphabetically once the class list settles, and it
repeats across classes:

```
Student  STU0000000123      ← never changes
  2025-26  Std 9-A   roll 17
  2026-27  Std 10-A  roll 23      ← different, and that is correct
```

**`studentCode` ≠ `admissionNo`.** `admissionNo` belongs to the *admission
process* and is branch-scoped with a yearly reset. A student who transfers gets a
**second** `admissionNo` from the new branch and keeps **one** `studentCode`. A
readmitted student likewise.

**`applicationNo` ≠ `admissionNo`.** The first identifies an *attempt*; the second
identifies a *spell of study that actually began*. A rejected applicant has an
`applicationNo` and will never have an `admissionNo`.

**`studentId` ≠ `studentCode`.** The UUID is the relational identity; the code is
the human identity. §46.4 binds every downstream module to the UUID.

---

# 15. Applicant Model

**Delta only.** `Applicant` exists with running code. Everything not listed here
stays exactly as it is — in particular the inline address, the demographic
fields, previous education and the custom-field JSON columns, which together are
the **frozen legal snapshot** of what was declared on a date.

| Change | Field | Detail |
| :--- | :--- | :--- |
| **add** | `personId String?` | Null in `DRAFT`, required from `SUBMITTED`. Indexed. Resolving a Person for every abandoned draft would pollute the identity index. |
| **add** | `programId String` | Required. Schools set it directly; colleges set it from the allotted preference. Closes A-3. |
| **add** | `offerIssuedAt`, `offerExpiresAt DateTime?` | Drives offer expiry (§17) |
| **add** | `seatConfirmedAt`, `withdrawnAt`, `deferredAt DateTime?` | Matches the existing `submittedAt`/`approvedAt` pattern |
| **add** | `deferredFromApplicantId String?` | Links a re-application to the deferred original |
| **change** | `admissionStatus` | `String` → `AdmissionApplicationStatus` **enum**. Closes A-1. |
| **remove** | `aadhaarNo` + its index | Moves to `PersonSensitive` (F1). Closes A-4. |
| **remove** | `photoFileId` | Dangling column; a photograph becomes an ordinary `Document` of type `PHOTOGRAPH`, so it gets the same scanning, size limits, versioning and encryption as everything else. Closes A-5. |
| **new model** | `ApplicantProgramPreference` | `applicantId`, `programId`, `preferenceOrder`, `status`, `remarks`. Schools create zero rows. |

**Why Student carries its own copy of the demographics rather than referencing
the Applicant:** a name corrected by affidavit in 2029 must not silently rewrite
the 2026 application form. Two facts that happen to start equal and legitimately
diverge. Same reasoning keeps the applicant's inline address out of the Address
module (§25).

**New constraint that closes A-2:**

```sql
CREATE UNIQUE INDEX applicant_one_active
  ON "Applicant" ("personId", "branchId", "academicYearId")
  WHERE "personId" IS NOT NULL
    AND "deletedAt" IS NULL
    AND "admissionStatus" NOT IN
        ('REJECTED','WITHDRAWN','CANCELLED','DEFERRED');
```

"One active application per academic year" is a frozen rule that **nothing
currently enforces**, because there was no key to enforce it on. `personId`
supplies one.

---

# 16. Admission Model

**New.** The layer with no current equivalent.

| Aspect | Specification |
| :--- | :--- |
| **Location** | `src/modules/admissions/admission/` |
| **Owns** | One continuous spell of study at one branch: `admissionNo`, joining date, entry level, quota, admission type, exit date and reason |
| **Does not own** | Anything that varies year to year (Enrollment) · identity (Student) · the application (Applicant) |
| **Created by** | `admit()` · branch transfer · readmission · migration import |
| **Modified by** | Exit operations only. `branchId`, `admissionNo`, `studentId`, `admissionDate` are immutable after creation. |

### Fields

| Field | Type | Null | Mutable | Why here |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID v7 | no | ❌ | |
| `organizationId` | String | no | ❌ | |
| `branchId` | String | no | ❌ **immutable — the hinge of the design** | An admission cannot span branches: `admissionNo` is branch-scoped and fee structures are branch-scoped |
| `studentId` | String | no | ❌ | |
| `admissionNo` | String | no | ❌ | Branch + year scoped, human-facing |
| `admissionType` | enum | no | ❌ | `REGULAR`, `LATERAL_ENTRY`, `TRANSFER`, `MIGRATION`, `READMISSION`, `BRANCH_TRANSFER`, `RTE` |
| `admissionDate` | DateTime | no | ❌ | **The joining date, not the approval date** |
| `entryProgramId`, `entryAcademicUnitId` | String | no | ❌ | The level actually joined — serves lateral entry with no special modelling |
| `quotaId?`, `admissionSourceId?` | String | yes | ✅ | Existing masters |
| `status` | enum | no | ✅ via transition | `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`, `TRANSFERRED_OUT` |
| `sourceApplicantId?` | String | yes | ❌ | Provenance |
| `previousAdmissionId?` | String | yes | ❌ | Links readmission and branch transfer to the prior spell |
| `exitDate?`, `exitReason?`, `exitRemarks?` | | yes | ✅ once | `GRADUATED`, `TRANSFER_OUT`, `BRANCH_TRANSFER`, `DROPPED_OUT`, `EXPELLED`, `DECEASED`, `CANCELLED_BEFORE_JOINING` |
| `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `deletedAt?` | | | | |

**Uniques:** `[branchId, admissionNo]`, `[id, studentId]`,
`[id, studentId, branchId]` (the last enables the composite FK in §18.3).

### Lifecycle

```
[ACTIVE] ──complete──────> [COMPLETED]        course finished
    ├────hold────────────> [ON_HOLD]          academic break — no Enrollment that year
    ├────transfer────────> [TRANSFERRED_OUT]  branch transfer; a new Admission opens
    └────cancel──────────> [CANCELLED]        cancelled after joining; Enrollments voided
```

**Cancellation is two different things and they must not share a status.**
Cancelling an *application* is `Applicant.CANCELLED` and produces no Student at
all. Cancelling an *admission after joining* voids the active Enrollment and
triggers refund and TC workflows. Collapsing them loses a distinction that
matters to every fee report.

---

# 17. Admission State Machine

Thirteen states. (`02-applicant.md` §3.3 says twelve — it is one short; the full
set is below.) The current implementation has nine with `APPROVED` terminal
(`workflow.service.ts:49`), which cannot express the offer → confirm → admit
path.

```
[DRAFT] ──submit──> [SUBMITTED] ──review──> [UNDER_REVIEW]
                                                 │
                              ┌──────────────────┼──────────────────┐
                              ▼                  ▼                  ▼
                     [DOCUMENT_PENDING]   [FEE_PENDING]      [WAITLISTED]
                              └──────────────────┼──────────────────┘
                                                 ▼
                                            [APPROVED]  ← "offer made, seat held"
                                                 │
                                    ┌────────────┴────────────┐
                                    ▼                         ▼
                              [DEFERRED] ✦            [SEAT_CONFIRMED]
                                                              │
                                                          admit()
                                                              ▼
                                                        [ADMITTED] ✦

  [WITHDRAWN] ✦   reachable from every non-terminal state
  [REJECTED]  ✦   reachable from SUBMITTED, UNDER_REVIEW, DOCUMENT_PENDING,
                  FEE_PENDING, WAITLISTED
  [CANCELLED] ⊘   reachable from every non-terminal state
```

✦ terminal ⊘ conditionally terminal

## 17.1 Transition table

Every transition passes through the workflow engine. **There is no direct status
write path, including for administrators.**

| From | To | Action | Who | Guard | Side effects | Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DRAFT` | `SUBMITTED` | `submit` | `STAFF`+ | `PersonService.resolve()` succeeds; `applicant_one_active` not violated; `programId` set | `personId`, `submittedAt`; publishes `applicant.person_resolved` | optional |
| `DRAFT` | `CANCELLED` | `cancel` | `STAFF`+ | — | `cancelledAt` | **required** |
| `SUBMITTED` | `UNDER_REVIEW` | `startReview` | `STAFF`+ | — | | optional |
| `SUBMITTED` | `REJECTED` | `reject` | `BRANCH_ADMIN`+ | — | `rejectedAt`, `rejectedBy` | **required** |
| `UNDER_REVIEW` | `DOCUMENT_PENDING` | `requestDocuments` | `STAFF`+ | ≥1 unsatisfied mandatory requirement (S3) | | **required** |
| `UNDER_REVIEW` | `FEE_PENDING` | `requestFee` | `STAFF`+ | — | | optional |
| `UNDER_REVIEW` | `WAITLISTED` | `waitlist` | `BRANCH_ADMIN`+ | — | | **required** |
| `UNDER_REVIEW` / `DOCUMENT_PENDING` / `FEE_PENDING` / `WAITLISTED` | `APPROVED` | `approve` | `BRANCH_ADMIN`+ · `admissions.approve` | Checklist satisfied at `requiredByStage` | `approvedAt`, `approvedBy`, `offerIssuedAt`, `offerExpiresAt` from config; publishes `applicant.offer_issued` | optional |
| `DOCUMENT_PENDING` | `UNDER_REVIEW` | `documentsReceived` | `STAFF`+ | Checklist satisfied | | optional |
| any non-terminal | `REJECTED` | `reject` | `BRANCH_ADMIN`+ · `admissions.reject` | — | `rejectedAt`, `rejectedBy` | **required** |
| `APPROVED` | `SEAT_CONFIRMED` | `confirmSeat` | `STAFF`+ | Offer not expired | `seatConfirmedAt`; publishes `applicant.seat_confirmed` | optional |
| `APPROVED` | `DEFERRED` | `defer` | `BRANCH_ADMIN`+ | Deferment enabled in config | `deferredAt`; publishes `applicant.deferred` | **required** |
| `APPROVED` | `CANCELLED` | `expireOffer` | **SYSTEM** job | `offerExpiresAt < now` | `cancelledAt`, reason `OFFER_EXPIRED`; publishes `applicant.offer_expired` | auto |
| **`SEAT_CONFIRMED`** | **`ADMITTED`** | **`admit()`** | `BRANCH_ADMIN`+ · `admissions.approve` + `student.create` | **§31 — the whole transaction** | Student + Admission + Enrollment created | optional |
| any non-terminal | `WITHDRAWN` | `withdraw` | `STAFF`+ | — | `withdrawnAt`; publishes `applicant.withdrawn` | **required** |
| any non-terminal | `CANCELLED` | `cancel` | `BRANCH_ADMIN`+ | — | `cancelledAt` | **required** |
| `CANCELLED` | `UNDER_REVIEW` | `forceReopen` | **`SUPER_ADMIN` only** | — | Audited at `severity: WARN` | **required** |

## 17.2 Rules the engine enforces

| Rule | Mechanism |
| :--- | :--- |
| **Invalid transitions are impossible** | Table-driven matrix keyed on the enum. The service may not invent a transition. |
| **No transition without a row lock** | `SELECT … FOR UPDATE` on the applicant, first statement in the transaction. Closes W-1. §33. |
| **No transition outside the caller's scope** | `WHERE id = :id AND organizationId = :ctx.org AND branchId = :ctx.branch`. Closes B3. |
| **Remarks required where the table says so** | Rejected on a blank string, not merely on null |
| **Every transition writes `WorkflowHistory`** | Inside the transaction, polymorphic `(entityType='APPLICANT', entityId)` |
| **Every transition publishes an event** | Through the outbox, inside the transaction (§37) |
| **Terminal states have no outbound transitions** | Except `CANCELLED → UNDER_REVIEW` by `SUPER_ADMIN` |
| **Expiry runs through the engine** | The scheduled job calls the same transition method. Never a direct `UPDATE`. |
| **Duplicate detection warns, never blocks** | `PersonService.findCandidates()` returns non-blocking warnings — twins share address, phone, DOB and parents |
| **Deferment does not carry into the next year** | A **new** Applicant is created with `deferredFromApplicantId` set. The old row stays a closed historical record. |

## 17.3 `WorkflowHistory` becomes polymorphic

Required so Applicant, Admission and Enrollment share one audit engine.

| Change | Detail |
| :--- | :--- |
| **remove** | `applicantId String` and its `onDelete: Cascade` relation |
| **add** | `entityType WorkflowEntityType` — `APPLICANT`, `ADMISSION`, `ENROLLMENT`, `STUDENT` |
| **add** | `entityId String` |
| **add** | `organizationId`, `branchId` — so history reads are scopeable without a join |
| **index** | `@@index([entityType, entityId, timestamp])` |

Existing applicant rows **migrate** to the new shape (`entityType: 'APPLICANT'`).
They are not left behind on the old column.

---

# 18. Enrollment Model

## 18.1 Enrollment becomes a first-class module

**Decision: move it out of `admissions/`.**

| | Keep under `admissions/` | ✅ **Own module `src/modules/enrollment/`** |
| :--- | :--- | :--- |
| Lifetime | Implies enrollment ends when admission ends | Correct: enrollment continues for twelve years after the admission process finished |
| Who calls it | Only admissions | Promotion (year-end job), examination (result outcome), corrections, transfers — **none of which are admissions** |
| Dependency shape | Attendance → Admissions, to reach placement | Attendance → Enrollment. Admissions stays a funnel. |
| Bulk promotion | A job inside the admissions module | Belongs where placement lives |

The admissions module is an **intake funnel**. Enrollment is the **spine of the
academic year**. Bolting a twelve-year concern onto a three-month one is the kind
of accidental coupling the Anti-Gravity principle exists to prevent.

**Resulting dependency edges — all one-way:**

```
admissions  ──▶  identity (Person, Student)
admissions  ──▶  enrollment
admissions  ──▶  numbering
enrollment  ──▶  identity
enrollment  ──▶  academic structure
identity    ──▶  numbering
identity    ──▶  organization
```

`enrollment` **never** imports `admissions`. It holds an `admissionId` foreign key
— a schema relationship in a shared Prisma schema, not a module import.

## 18.2 Fields

| Field | Type | Null | Mutable | Why here |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID v7 | no | ❌ | |
| `organizationId`, `branchId`, `academicYearId` | String | no | ❌ | Scope. `academicYearId` denormalizes `AcademicUnit.academicYearId`, kept honest by INV-ENR-010. |
| `admissionId` | String | no | ❌ | The parent spell of study |
| `studentId` | String | no | ❌ | **Denormalized** — every downstream module needs "this student's rows" without a three-table join. FK-enforced (§18.3). |
| `programId`, `academicUnitId` | String | no | ❌ | Placement **for this year**. A change supersedes the row; it never edits it. |
| `rollNumber` | String? | yes | ✅ **until the class list is locked** | Assigned after the class list settles |
| `enrollmentKind` | enum | no | ❌ | `PRIMARY` · `SECONDARY` (phase 2) · `EXCHANGE` (phase 3) |
| `enrollmentStatus` | enum | no | ✅ via transition | `PENDING`, `ACTIVE`, `ON_BREAK`, `PROMOTED`, `DETAINED`, `COMPLETED`, `TRANSFERRED`, `DROPPED_OUT`, `CANCELLED`, `SUPERSEDED` |
| `isRepeat` | Boolean | no | ❌ | Same academic unit as the previous year |
| `resultOutcome` | enum? | yes | ✅ **by Examination only** | Enrollment owns the column; it does not own the decision |
| `originType` | enum | no | ❌ | `ADMISSION`, `PROMOTION`, `REPEAT`, `CORRECTION`, `TRANSFER`, `READMISSION`, `MIGRATION` |
| `previousEnrollmentId?`, `supersededById?`, `changeReason?` | | yes | ❌ once set | Provenance |
| `applicantId?` | String? | yes | ❌ | **Provenance only. Nullable, no cascade.** Closes E-2. |
| `exitDate?`, `exitReason?` | | yes | ✅ once | |
| `version` | Int | no | ✅ | Optimistic lock (§33) |
| `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `deletedAt?` | | | | |

**Removed from the current model:** `applicantId @unique` (E-1),
`onDelete: Cascade` (E-2), `futureStudentId` (a placeholder pointing at nothing).

## 18.3 The composite foreign key

```prisma
model Enrollment {
  admissionId String
  studentId   String
  branchId    String

  admission Admission @relation(
    fields:     [admissionId, studentId, branchId],
    references: [id,          studentId, branchId]
  )
}
```

One foreign key enforces two invariants simultaneously: an Enrollment's student
always equals its Admission's student, **and** its branch always equals its
Admission's branch. Both become *unrepresentable in Postgres* rather than merely
checked in a service someone might forget to call.

Downstream modules inherit the pattern free: `Attendance` references
`(enrollmentId, studentId)` against `Enrollment @@unique([id, studentId])`, so an
attendance row can never name a student who is not in that enrollment.

## 18.4 The promotion test

Promoting a student from Std 9 to Std 10 writes **one row**:

```
Enrollment { admissionId, academicYearId, programId, academicUnitId,
             rollNumber, originType: PROMOTION, previousEnrollmentId }
```

**Zero demographic fields copied.** Twelve years → one Person, one Student, one
Admission, twelve thin Enrollment rows.

> If a change ever requires copying a demographic field into Enrollment, the
> design has broken. Treat it as a red flag, not a convenience.

## 18.5 Every enrollment question, answered

| Question | Answer |
| :--- | :--- |
| Who **creates** Enrollment? | `admit()` (first) · promotion · repeat · correction · mid-year transfer · readmission · migration import. **Never a bare `POST /enrollments`.** |
| Who **owns** it? | The Enrollment module. `resultOutcome` is written only by Examination. |
| Who can **modify** it? | `BRANCH_ADMIN`+ for placement operations; `rollNumber` by `STAFF`+ until the class list locks. Placement is never edited — it is superseded. |
| Who can **cancel** it? | `BRANCH_ADMIN`+, and only while no results are recorded. |
| What happens after **approval**? | Nothing academic. Approval issues an offer. §17. |
| When exactly is Student created? | Inside `admit()`, on `SEAT_CONFIRMED → ADMITTED`. Never earlier. |
| Student before or during Enrollment? | Same transaction; Student inserted first (FK order). §10.2. |
| One transaction? | **Yes.** §31. |
| Student succeeds, Enrollment fails? | **Cannot happen** — one transaction, both roll back. The applicant stays `SEAT_CONFIRMED` and the operation is retried. |
| Enrollment succeeds, event fails? | **The event cannot be lost** — the outbox row commits with the data; the relay retries until published. §37. |
| Can Enrollment be **edited**? | Placement: no — superseded with `changeReason`. `rollNumber`: yes, until lock. `resultOutcome`: by Examination. |
| **Transferred**? | Mid-year, same branch: supersede, `originType: TRANSFER`. Cross-branch: a new Admission (§20). |
| **Promoted**? | New row, `originType: PROMOTION`; old row → `PROMOTED`. |
| **Suspended**? | Not an Enrollment state. Suspension is a Student status (§19); the enrollment stays `ACTIVE`. A whole year off is `ON_BREAK` + Admission `ON_HOLD`. |
| **Withdrawn**? | `DROPPED_OUT` on the enrollment; Admission closed with an `exitReason`. |
| **Completed**? | `COMPLETED` at year end for a terminal year; otherwise `PROMOTED`. |
| **Repeated**? | New row, same `academicUnitId`, `isRepeat: true`, `originType: REPEAT`; old row → `DETAINED`. |
| **Reopened**? | No. A closed enrollment is never reopened. A mistake is corrected by superseding — which leaves both rows visible. |
| Two **simultaneous** enrollments? | Not in v1: exactly one `PRIMARY` per admission per year (INV-ENR-002). `SECONDARY` is reserved for NEP multidisciplinary in phase 2, and the index already permits it. |
| Two active **branches**? | **No.** One `ACTIVE` Admission per Student (INV-ADM-002), and an Admission cannot span branches. |
| Two **programs**? | Within one year, no. Across years, freely — a Science→Commerce switch supersedes the enrollment and keeps the same Admission. |
| Multiple **academic units**? | One per enrollment. A student in "Std 9" *and* "Section A" means the unit tree is being misused: the enrollment points at the **leaf**. |
| Multiple enrollments in **one year**? | Only one `PRIMARY`, plus any number of `SUPERSEDED`/`CANCELLED` rows — which is how correction history is preserved. |
| What is a **duplicate** enrollment? | A second non-superseded, non-cancelled `PRIMARY` for the same `(admissionId, academicYearId)`. Rejected by INV-ENR-002. |
| Is `AcademicYear.isLocked` honoured? | **Yes — new requirement.** Every Enrollment write checks it and returns `403 ACADEMIC_YEAR_LOCKED`. Closes F-5/G-7. |

## 18.6 Provenance — supersede, never update

| Operation | Old row becomes | New row `originType` | Reason required |
| :--- | :--- | :--- | :--- |
| Promotion | `PROMOTED` | `PROMOTION` | no |
| Repeat year | `DETAINED` | `REPEAT`, `isRepeat: true` | no |
| **Placement correction** | `SUPERSEDED` | `CORRECTION` | **yes** |
| Section/program change mid-year | `SUPERSEDED` | `TRANSFER` | **yes** |
| Branch transfer | `TRANSFERRED` + Admission closed | `TRANSFER` under a **new** Admission | **yes** |
| Readmission | previous Admission already closed | `READMISSION` under a new Admission | **yes** |

`promote`, `repeatYear`, `correctPlacement` and `transferPlacement` all route
through **one supersede-and-link helper**, so provenance cannot be forgotten by
whoever writes the fourth one. The helper rejects a blank `changeReason`, not
merely a null one.

**The correction test — admitted to Primary 1, corrected to Primary 2:**

```
Enrollment A  Primary 1   enrollmentStatus: SUPERSEDED
                          supersededById:   B
                          changeReason:     "wrong class selected at admission"

Enrollment B  Primary 2   enrollmentStatus: ACTIVE
                          originType:       CORRECTION
                          previousEnrollmentId: A
```

Row A is never edited and never deleted. Because `originType` distinguishes
`CORRECTION` from `TRANSFER`, a report can tell an operator's **mistake** from a
genuine mid-year **move** — exactly the question asked when a registrar is
challenged about a student appearing in two classes.

---

# 19. Student Lifecycle

```
                    ┌──────────────────────────────┐
                    │          [ACTIVE]            │
                    └───┬──────┬──────┬──────┬─────┘
          suspend ──────┘      │      │      └────── expel
              ▼                │      │                 ▼
        [SUSPENDED] ──reinstate┘      │           [EXPELLED] ✦
              │                       │                 │
              └─ withdraw ──┐   graduate                │
                            ▼         ▼                 │
                     [WITHDRAWN] ✦  [GRADUATED] ✦       │
                            │         │                 │
                            └─────────┴─────────────────┘
                                      │  retention period elapses
                                      ▼
                                 [ARCHIVED]
                                      │
                            readmit (§23) — via a NEW Admission,
                            Student returns to [ACTIVE]
```

✦ terminal for the current spell of study — **not** for the identity

| Status | Meaning | Enrollments | Searchable | Who sets it |
| :--- | :--- | :--- | :--- | :--- |
| `ACTIVE` | Currently a student | May have a current one | ✅ | `admit()`, readmission |
| `SUSPENDED` | Temporarily barred, still enrolled | Stays `ACTIVE` | ✅ | `BRANCH_ADMIN`+, reason required |
| `WITHDRAWN` | Left before completing | Closed | ✅ | `BRANCH_ADMIN`+, reason required |
| `GRADUATED` | Completed the terminal programme | `COMPLETED` | ✅ | `BRANCH_ADMIN`+ |
| `EXPELLED` | Removed for cause | Closed | ✅ | `ORG_ADMIN`+, reason required |
| `ARCHIVED` | Read-only after the retention period | Frozen | ✅ **remains searchable and reportable** | Scheduled job or `ORG_ADMIN` |

## 19.1 Rules

1. **There is no hard-delete path.** No service method, no endpoint, no
   `DELETE /v1/students/:id`. `deletedAt` exists on the model for schema
   consistency (F-4) and is **never set** by any Student code path.
2. **`ARCHIVED` is read-only but not hidden.** Archived students appear in
   search, in historical reports and in alumni queries. Archival is a *write
   lock*, not a disappearance, and it is reversible by a privileged audited
   force-correction.
3. **Archival never moves rows to a shadow table.** A flag in place, in the same
   table. Shadow-table archival breaks every foreign key and every report.
4. **Status changes only through the lifecycle service.** No `PATCH` accepts a
   `status` field. Each transition is a named operation with its own permission,
   its own required reason and its own event.
5. **Suspension is a Student status, not an Enrollment status.** A suspended
   student is still enrolled — still occupies a seat, still owes fees, still
   appears on the register.
6. **The identity survives every terminal status.** `WITHDRAWN` and `GRADUATED`
   are terminal for the *spell of study*. A readmitted student is the same
   Student with a new Admission (§23), and the `studentCode` is unchanged.

## 19.2 Legal retention versus erasure

Two separable things, and conflating them is a legal problem
(`01-04-review…md` D3 — the DPDP Act 2023 grants a right to erasure and imposes
heightened obligations on children's data, which is the entire user base):

| | Retained | Erasable |
| :--- | :--- | :--- |
| **The academic record** — enrollments, results, receipts, certificates | ✅ statutory, often 7+ years | ❌ |
| **Personal data** — Aadhaar, photographs, health notes, contact details | | ✅ **crypto-erasure** (F1 D10): destroy the key, null the ciphertext, leave the row |

Erasure nulls sensitive ciphertext. It does **not** delete the Student row, does
not delete enrollments, and does not break a single foreign key. The academic and
financial record stays structurally intact and still reportable.

`Person` is never deleted at all — historical records point at it, and a Person
whose sensitive data has been erased still deduplicates. That last property
matters: it stops an erased subject re-enrolling as a stranger.

## 19.3 Duplicate Student and merge — designed for, not built

**Merge is not implemented in this build.** It is rare, irreversible, and has the
largest blast radius of any operation in the system. What this build must
guarantee is that merge remains **possible** later — and that guarantee is a set
of properties, not a promise.

### Where duplicates can still arise

With `Person` in place, the common duplicate paths are closed at the database:
`@@unique([organizationId, govtIdHash])` collapses the two-branch collision, and
`Student @@unique([organizationId, personId])` prevents a second Student for a
resolved human. The residual case is **two Persons for one human with no shared
government id** — twins recorded as one, a child admitted without Aadhaar whose
number arrives two years later attached to an earlier Person, or two spellings
entered by two clerks on the same day. Those are real and they will happen.

### Merge is a Person operation, not a Student operation

```
Person A (survivor)   ◀── all references repointed
Person B (tombstone)      mergedIntoPersonId: A
                          zero live references remain
PersonMergeLog            survivor, merged, reason, repointedRefs, who, when
```

Merging the humans is what merges everything else, because Student, Applicant,
Guardianship and Employee all hang off `personId`. There is no separate
student-merge path, and a guardian merge is the same operation.

### The properties this build must not break

| # | Property | Preserved by |
| :--- | :--- | :--- |
| 1 | A canonical id exists and stale references resolve | `Person.mergedIntoPersonId` tombstone; `GET /persons/:id` on a tombstone returns `308` to the survivor rather than `404` |
| 2 | Merge chains never form | `merge()` resolves both sides to their final survivors first, so A→B→C is written A→C |
| 3 | Every repointed reference is recoverable after the fact | `PersonMergeLog.repointedRefs` records exactly what moved, by type |
| 4 | **Enrollments can be reassigned** | Enrollment reaches the human through `Admission → Student → Person`. Repointing one `Student.personId` moves the whole academic history with it — **no Enrollment row is touched**. This is the single largest payoff of the four-layer model. |
| 5 | Documents and guardianships follow | Both key on `personId` |
| 6 | The surviving `studentCode` is chosen, not computed | The loser's code is **retired, never reused** (INV-NUM-007) and is recorded in the merge log so an old ID card can still be traced |
| 7 | The user account survives | `UserIdentityLink` repoints to the surviving Student; §27 |
| 8 | Downstream modules do not break | They hold `studentId` / `enrollmentId`, and merge repoints `Student.personId` rather than deleting a Student — so **no downstream foreign key dangles** |
| 9 | The whole operation is audited at `CRITICAL` | `person.merged` (§37.2) |
| 10 | It is irreversible, and that is stated | An undo would need to know which references originally belonged to which side; that information is gone the moment they are repointed |

### The one case merge cannot fix cheaply

If two **Students** (not just two Persons) already exist for one human — which
requires the duplicate to have survived both unique indexes, i.e. two Persons
each with their own Student — then merging the Persons is not enough: the
organization would hold two Students with two codes and two admission histories.
That case needs a genuine student-merge that reassigns Admissions from the loser
to the survivor and retires the loser's code.

Property 4 is what makes it tractable when the time comes: reassignment is
`UPDATE "Admission" SET "studentId" = :survivor` plus a supersede of the loser's
Student to a `MERGED` terminal status — **the Enrollment rows never move**,
because they reach the student through Admission. Nothing in this build may
introduce a direct `Student → Enrollment` coupling that would break that.

---

# 20. Branch Transfer

**A branch transfer is an Admission operation, not an Enrollment operation.** It
closes one spell of study and opens another. The Enrollment change is a
consequence, not the mechanism.

## 20.1 Why it is an Admission operation

`admissionNo` is branch-scoped and fee structures are branch-scoped, so an
Admission cannot span branches. If a transfer merely moved the Enrollment, the
Admission would end up pointing at a branch where the student no longer is, and
every Transfer Certificate, admission register and branch headcount would be
wrong.

## 20.2 The operation

`POST /v1/students/:studentId/branch-transfer` · `ORG_ADMIN`+ · reason mandatory
· one transaction:

| Step | Action | Note |
| :--- | :--- | :--- |
| 1 | Lock the Student row (`SELECT … FOR UPDATE`) | §33 — prevents two concurrent transfers |
| 2 | Assert exactly one `ACTIVE` Admission | INV-ADM-002 |
| 3 | Assert the **target** branch is in the same organization, and that the actor is authorised for it | §30 |
| 4 | Assert the target academic year is not locked | F-5 |
| 5 | Close Admission #1 — `TRANSFERRED_OUT`, `exitReason: BRANCH_TRANSFER`, `exitDate` = effective date | Immutable thereafter |
| 6 | Set the current Enrollment to `TRANSFERRED`, `exitDate` = effective date | **The historical row is not rewritten** — only closed |
| 7 | Allocate a **new branch-scoped** `admissionNo` from the target branch's sequence | Never reuses #1's |
| 8 | Open Admission #2 at the target branch: `admissionType: BRANCH_TRANSFER`, `previousAdmissionId: #1` | |
| 9 | Create the new Enrollment under Admission #2, `originType: TRANSFER`, `changeReason` mandatory | |
| 10 | Update `Student.branchId` — the pointer moves | **`studentCode` does not change** |
| 11 | Write three `WorkflowHistory` rows (Admission ×2, Enrollment) | Polymorphic |
| 12 | Write outbox rows: `admission.closed`, `admission.created`, `enrollment.created`, `student.branch_transferred` | §37 |

## 20.3 What changes and what does not

| | Changes | Stays |
| :--- | :--- | :--- |
| `studentId` (UUID) | | ✅ same |
| **`studentCode`** | | ✅ **same** |
| `personId` | | ✅ same |
| `Student.branchId` | ✅ moves | |
| Admission | ✅ #1 closed, #2 opened | #1's `branchId` and `admissionNo` never touched |
| `admissionNo` | ✅ new one at the target branch | #1's retained on the closed row |
| Enrollment | ✅ old closed, new created | Old row readable forever |
| `rollNumber` | ✅ new one in the new class | Old one retained on the closed enrollment |
| Guardianships | | ✅ **untouched** — Person↔Person, and Guardian is org-scoped (S1 D1/D2) |
| Addresses | | ✅ untouched — Person-owned |
| Documents | Person-owned ones stay; admission-owned ones stay with Admission #1 | |
| Academic history | | ✅ every past Enrollment intact and attributable to its branch |

## 20.4 The consequences no existing spec calls out

**Program identity does not survive the transfer (F-1/G-6).** `Program` is
branch-scoped with no `organizationId`. "Std 9 CBSE English medium" at Mumbai and
at Pune are **two different `Program` rows with two different UUIDs**. So:

- The new Enrollment references a *different* `programId` even though the parent
  and the registrar would both say "same programme".
- Any cross-branch academic report must group by program **name/medium/stream**,
  not by `programId`.
- The same applies to `AcademicUnit` and `AcademicYear`, both of which are also
  branch-scoped.

This is a property of the existing academic structure, not something this design
introduces. It is recorded as **§50 Q4** because the honest fix — an org-level
`ProgramTemplate` that branch programs instantiate — is a change to the academic
structure module and does not belong in this build.

**Master data must resolve above the branch.** If `Category` or `Caste` rows are
branch-scoped, a transferred student's `categoryId` points at a master row that
does not exist in the new branch's scope. The masters already support three-tier
scoping (`organizationId` and `branchId` are both nullable), so the fix is a
provisioning policy — seed government-defined masters at SYSTEM or ORGANIZATION
level, never per branch — not a schema change.

**Fees, documents and pending workflows.** A branch transfer with an outstanding
fee balance, an in-flight document verification, or an unissued certificate needs
a pre-flight check. Phase 1 **blocks the transfer** if the student has any
non-terminal workflow at the source branch and reports what is blocking, rather
than transferring and leaving orphans. Automatic settlement is a Finance concern
and is deferred.

## 20.5 Effective dating

`exitDate` on Admission #1 and `admissionDate` on Admission #2 are supplied by
the operator, default to today, and must satisfy
`Admission#1.exitDate <= Admission#2.admissionDate`. Back-dating is permitted
within the current academic year and rejected across a locked year.

---

# 21. Organization Transfer

**This is not a business workflow. It is tenant data migration.**

## 21.1 Why the Student is not portable

| Blocker | Detail |
| :--- | :--- |
| **Person is organization-scoped** (I1 D1) | The same human in two tenants is two Persons, by design. A global registry is explicitly forbidden — it would let one tenant probe another's students by Aadhaar. |
| **`studentCode` is organization-scoped** (§13.3) | Carrying it across would either collide with the target's sequence or force a gap in it. |
| **Academic structure is branch-scoped** (F-1) | Every `programId`, `academicUnitId` and `academicYearId` on the student's history points at rows owned by the *source* organization's branches. A portable Student would carry foreign keys **into another tenant's rows** — precisely the isolation breach the whole design forbids. |
| **Masters, documents and encryption keys** | `categoryId` etc. resolve within the source org; documents are encrypted under the source organization's DEK (F1 D1). |

## 21.2 The policy

| Question | Answer |
| :--- | :--- |
| Is Student identity portable? | **No.** |
| Is `studentCode` portable? | **No.** A new code is allocated from the target organization's sequence. |
| Is a new Student created? | **Yes**, in the target organization, with `createdVia: MIGRATION`. |
| Is a migration record created? | **Yes** — `StudentExternalRef { studentId, sourceSystem: 'CAMPUSFLOW', sourceOrganizationId, sourceStudentId, sourceStudentCode, migratedAt, migratedBy }`. Provenance without a cross-tenant foreign key. |
| Do historical records stay in the old tenant? | **Yes**, complete and unaltered. The source Student is closed (`GRADUATED`/`WITHDRAWN` as appropriate, then `ARCHIVED`). |
| Is academic history copied? | Only as **exported artefacts** — a transcript, a TC, marksheets — attached as `Document` rows on the new Student. Not as `Enrollment` rows, which would fabricate placements against academic structure the target organization never ran. |
| Who can do it? | `SUPER_ADMIN` only, through the migration tooling (P2), never through a business endpoint. |

## 21.3 The case that is *not* an organization transfer

Two branches of the **same** organization merging, or a branch moving between
organizations under common ownership, is a **branch transfer** (§20) or a branch
re-parenting operation — both of which keep the Student and the `studentCode`
intact. Only a genuine cross-tenant move triggers §21.2. Getting this distinction
wrong in either direction is expensive, so the operator-facing tooling must ask
which one it is rather than inferring it.

---

# 22. Promotion

**Promotion never mutates Student and never mutates the historical Enrollment.**
It writes one new Enrollment row.

```
Enrollment 2025-26   Std 9    enrollmentStatus: PROMOTED       ← closed, never edited
                                                    │
                                                    ▼ previousEnrollmentId
Enrollment 2026-27   Std 10   enrollmentStatus: ACTIVE
                              originType: PROMOTION
```

Same `studentId`. Same `admissionId`. Same `studentCode`. New `rollNumber`.

## 22.1 The variants

| Variant | Old row | New row | Note |
| :--- | :--- | :--- | :--- |
| **Promotion** | `PROMOTED` | Next unit, `originType: PROMOTION` | The normal case |
| **Repeat / detention** | `DETAINED` | **Same** unit, `isRepeat: true`, `originType: REPEAT` | Two Enrollments on Std 9, one Admission |
| **Conditional promotion** | `PROMOTED` | Next unit + a flag or note carried by Examination | Enrollment does not model the condition; it records the placement |
| **Failed promotion** | unchanged | none | The student stays where they are until a decision is made |
| **Terminal year** | `COMPLETED` | none | Student → `GRADUATED`, Admission → `COMPLETED` |
| **Promotion reversal** | new row → `SUPERSEDED` | Restores the prior placement, `originType: CORRECTION`, reason mandatory | **Not a delete.** Both rows stay visible. |

## 22.2 Bulk promotion

Year-end promotion is the largest write operation the system performs — a branch
may promote two thousand students at once. Treating it as a synchronous HTTP
request is wrong.

| Requirement | Specification |
| :--- | :--- |
| **Execution** | A job with an id, progress, and a partial-failure report. `POST /v1/enrollments/bulk-promote` returns `202` with a `jobId`. |
| **Atomicity** | **Per student, not per job.** One transaction per student. A run that fails at student 1,400 must not leave 1,399 promoted with no record — the job record is the record, and it lists exactly which succeeded, which failed and why. |
| **Resumability** | The job stores the last processed `studentId`; a resume skips what already has a target-year enrollment (which INV-ENR-002 makes detectable). |
| **Idempotency** | Re-running is safe: a student who already has a `PRIMARY` enrollment in the target year is **skipped**, not duplicated. The partial unique index is the backstop. |
| **Events** | **One** `enrollment.bulk_promoted` event carrying the job id and counts — not two thousand events. Individual `enrollment.created` events are still written to the outbox for downstream state, but audit records the batch. |
| **Locking** | Each per-student transaction takes a row lock on the source Enrollment. An admin editing that enrollment concurrently blocks briefly and then sees a `409` from the optimistic `version` check (§33). |
| **Academic year lock** | Both source and target years are checked. A locked source year blocks the run. |
| **Concurrency limit** | One bulk-promotion job per `(branchId, targetAcademicYearId)` at a time, enforced by a unique partial index on the job table. |

## 22.3 Rollback

There is no bulk "undo". Reversal is the per-student `correctPlacement`
operation, run over the affected list, each writing a supersede pair with a
reason. This is deliberate: a bulk undo that deletes rows would destroy the
evidence that the promotion happened, and the promotion may already have been
reported to a board.

---

# 23. Readmission

**Existing Student + new Admission. Never a new Student.**

```
Student STU0000000123
  Admission #1   2024  Std 8   status: CANCELLED   exitReason: DROPPED_OUT
        └─ Enrollment 2024-25  DROPPED_OUT
                                                        ← 2 year gap
  Admission #2   2026  Std 9   admissionType: READMISSION
                               previousAdmissionId: #1
        └─ Enrollment 2026-27  originType: READMISSION
```

`studentId`, `studentCode` and `personId` are unchanged. The new Admission gets a
**new** branch-scoped `admissionNo`.

## 23.1 How the existing Student is found

This is the failure mode readmission usually has. Today's `checkDuplicates`
searches only **Applicants**, branch-scoped — so a returning dropout, who is a
**Student**, is invisible to it, and a second identity is created silently.

With Person: `PersonService.resolve()` matches on `govtIdHash` and returns the
existing Person; `admit()` then finds the existing Student through
`@@unique([organizationId, personId])` and takes the readmission path instead of
the create path. The mechanism that prevents the duplicate is the same one that
enables readmission.

## 23.2 Does readmission require a fresh application?

Institutions genuinely differ, so this is **configuration**, not code:

| Config key | Values | Effect |
| :--- | :--- | :--- |
| `admission.readmission.requiresApplication` | `ALWAYS` \| `NEVER` \| `AFTER_GAP_YEARS` | Whether a new `Applicant` must exist |
| `admission.readmission.gapYearsThreshold` | Int, default `1` | Used when the above is `AFTER_GAP_YEARS` |

| Mode | Flow |
| :--- | :--- |
| **Fresh application required** | A new `Applicant` is created (pre-filled from the Person's existing Student record and fast-tracked past re-verification if config allows), runs the normal state machine, and `admit()` detects the existing Student and opens Admission #2. |
| **Direct readmission** | `POST /v1/students/:id/readmit` skips the applicant entirely: it opens Admission #2 and the first Enrollment directly. `Admission.sourceApplicantId` is null; `createdVia` on the Student is unchanged (it still records how the *identity* was born). |

Both paths converge on the same shape. The `admit()` transaction is written once,
with the Student-creation step conditional on whether a Student already exists —
not two separate code paths that drift.

## 23.3 Guards

| Guard | Rule |
| :--- | :--- |
| No overlapping admission | The previous Admission must be closed (`COMPLETED`, `CANCELLED`, `TRANSFERRED_OUT`). INV-ADM-002 enforces it at the database. |
| Student not `EXPELLED` | Readmitting an expelled student requires `ORG_ADMIN`+ and a mandatory reason. |
| Student not `ARCHIVED` | Un-archive first, as an explicit audited operation. |
| Entry level is chosen, not derived | The registrar states which academic unit the student re-enters. Deriving it from the last enrollment is wrong after a two-year gap. |

---

# 24. Guardian / Family Relationship

Full spec in [`02-guardian-family/01-guardian.md`](02-guardian-family/01-guardian.md).
What matters here is the **contract with Student**.

## 24.1 The contract

| Rule | Consequence |
| :--- | :--- |
| **Guardianship links two Persons, not a Guardian to a Student** | A guardianship created at application time survives the applicant→student transition with **zero re-mapping**. `admit()` does nothing about guardians. |
| **Student owns no guardian fields** | No `fatherName`, no `motherMobile`, no `emergencyContact` columns on Student. Ever. |
| **Guardian is organization-scoped** | One parent login shows every child, including siblings in different branches. |
| **Siblings are derived, never stored** | Two wards sharing a guardianship are siblings. An explicit sibling edge is a second source of truth that drifts. |
| **No `Household` entity** | It adds a mandatory join to every address and contact read and pays off only in the minority of genuinely shared cases. Shared addresses are handled by two people referencing one `Address` row (§25). |

```
Person(adult) ──Guardianship──▶ Person(child) ◀── Student
                    │                              (personId)
                    ├─ relationTypeId
                    ├─ isPrimary            at most one active per ward
                    ├─ isFinancialGuardian  at most one active per ward
                    ├─ isEmergencyContact   many, ordered by emergencyPriority
                    ├─ isLegalGuardian
                    ├─ pickupAllowed + validity window
                    └─ startedAt / endedAt
```

## 24.2 Two live defects in the current guardian code

Both are inherited by anything built on top, so they are named here:

- **The primary-guardian toggle is not transactional** (`guardians.service.ts:111–144`):
  `updateMany` clearing every `isPrimary`, then `upsert`. If the upsert fails,
  the child is left with **no primary guardian at all**.
- **`isFinancialGuardian` has no exclusivity logic whatsoever** (`:132`, `:140`).
  A ward can have three financial guardians, and the fee module will pick one
  arbitrarily or send three invoices.

Both disappear under partial unique indexes on `wardPersonId WHERE isPrimary AND
endedAt IS NULL` and the same for `isFinancialGuardian`. The service stops
needing to be careful because the invalid state becomes unrepresentable.

## 24.3 How Student reads guardians

Student **never joins to Guardian directly**. A student profile response composes
`GuardianService.findByWard(personId)` at the API layer. The Student module does
not import the Guardian module's tables into its own queries — that is what keeps
the dependency one-way and lets the Guardian module change shape without
rewriting Student.

---

# 25. Address Relationship

Full spec in [`03-address/01-address.md`](03-address/01-address.md).

## 25.1 The contract

| Rule | Why |
| :--- | :--- |
| **Student holds no address columns** | An address varies over time and is shared between siblings. Columns cannot express either. |
| **Addresses attach to `Person`** | A human has an address regardless of role. Attaching per role duplicates it for a parent who is also an alumnus. |
| **`Address` is an immutable value object; `PersonAddress` is an append-only link** with a type and a validity window | Gives sharing and history simultaneously. Editing in place loses history; versioning rows in place breaks sharing. |
| **The applicant's inline address is NOT migrated** | It is a legal snapshot of what was declared on a date. A family moving in 2029 must not retroactively change the 2026 application form. |
| **Four types** | `PERMANENT`, `CURRENT`, `COMMUNICATION` (falls back to `CURRENT`), `BILLING` (resolves through the financial guardian) |

## 25.2 The minimum foundation for this build

The full Address module is S2 and is **not** a prerequisite for Student. What
Student needs from it is only this, and it can be deferred:

| Phase | What exists |
| :--- | :--- |
| **This build** | `admit()` copies the applicant's declared address into a `CURRENT` `PersonAddress` for the student's Person **if S2 exists**; otherwise the applicant's inline address remains the only address, reachable through `sourceApplicantId`. Student gains **no** address columns either way. |
| **S2 lands** | Backfill runs from `Guardian`'s address columns; the applicant snapshot is left alone; the student's `CURRENT` address is seeded from the application. |

This is the "do not over-engineer it now" answer: Student's schema is identical
in both cases, so S2 can land before or after Student without touching it.

---

# 26. Document Relationship

Full spec in [`04-documents/01-document.md`](04-documents/01-document.md).

## 26.1 The contract

**The Student model must not become a document storage container.** Student holds
at most one nullable `photoDocumentId` reference and nothing else.

| Document | `ownerType` | `ownerId` | Why |
| :--- | :--- | :--- | :--- |
| Birth certificate, Aadhaar copy, caste certificate | `PERSON` | `personId` | Follows the human across roles and across admissions |
| Application-supporting documents | `APPLICANT` | `applicantId` | Evidence attached to one attempt |
| Photograph | `PERSON` | `personId` | Same human, one photo |
| **Transfer Certificate** | `ADMISSION` | `admissionId` | A TC certifies a *spell of study* |
| Migration certificate, bonafide for a specific year | `ENROLLMENT` | `enrollmentId` | Certifies a placement |
| Marksheet | `ENROLLMENT` | `enrollmentId` | Belongs to one academic year |
| Character certificate | `ADMISSION` | `admissionId` | Covers the whole spell |
| Medical / health record | `STUDENT` | `studentId` | A student-role fact, not a person-role one |

## 26.2 What "requirement" means, and why it is separate

A document is a file that exists. A **requirement** is the rule that a file must
exist. They are different tables, and the second is usually forgotten — which is
why the `DOCUMENT_PENDING` status already in the workflow currently has nothing
to compute against.

Which documents are required is a function of
`admissionType × programId × quotaId × categoryId`. Hard-coding that is how
institutions end up unable to run their own admission policy. So
`DocumentRequirement` declares the rule, a checklist is computed per applicant,
and `DOCUMENT_PENDING` acquires a precise meaning: **at least one unsatisfied
mandatory requirement at the current stage**.

## 26.3 Dependency direction

Student does **not** depend on the Document module. `photoDocumentId` is a plain
`String?` column with **no foreign key** to `Document`, so Student compiles and
migrates whether or not S3 exists. The Document module knows about Student
(through `ownerType: STUDENT`); Student does not know about Document. One-way, as
required.

---

# 27. User / Authentication Relationship

## 27.1 Student ≠ User

**DECIDED.** Not negotiable, and it is the single easiest thing to get wrong.

```
Person ──▶ Student ──┐
                     ├──▶ UserIdentityLink ──▶ User
Person ──▶ Guardian ─┤                          (auth only)
Person ──▶ Employee ─┘
```

| Rule | Why |
| :--- | :--- |
| **Student has no `userId` column** | A student identity exists whether or not the learner can log in. Junior classes typically get no login at all. |
| **User has no `studentId` column** | One human is routinely more than one thing: a teacher whose child studies at the same school needs one login and two roles. A column on either side makes that unrepresentable. |
| **The link is a separate table** — `UserIdentityLink(userId, linkedType, linkedId)` where `linkedType ∈ {STUDENT, GUARDIAN, EMPLOYEE}` | One user, many domain identities. Unique on `(linkedType, linkedId)` so one Student links to at most one account, and unique on `(userId, linkedType, linkedId)`. |
| **Auth does not import Identity, and Identity does not import Auth** | The link table is owned by Auth. Student never reads it. A student profile that needs "does this student have a login?" asks the Auth module at the API composition layer. |
| **Deactivating a User does nothing to the Student** | And archiving a Student does not delete the User — it publishes `student.archived`, which Auth may consume to suspend the account. Event-driven, not a foreign key. |

## 27.2 When accounts are created

```
Student created (admit)
        ↓
Student identity exists — no account            ← the default
        ↓
Optional provisioning, later and separately
        ↓
User created + UserIdentityLink written
```

| Subject | Default | Trigger |
| :--- | :--- | :--- |
| **Student** | **No account.** | Explicit provisioning, gated by a configurable minimum age or academic level. |
| **Guardian** | **No account at admission.** | Explicit invitation. Mobile + OTP is the realistic primary credential for Indian parents; email is optional. |
| **Employee** | Account at hire | Out of scope here |

`admit()` **does not create a User**. It publishes `student.created`; an
account-provisioning consumer may act on it if the institution has enabled
auto-provisioning. That keeps authentication concerns entirely outside the
transaction that creates the academic identity — and it means an SMTP outage
cannot fail an admission.

## 27.3 One consequence to design for now

A family shares a mobile number. `User.phone` is currently `@unique` **globally**
(`prisma/modules/auth/user.prisma`). Two guardians in one household therefore
cannot both have accounts. That is an Auth-module defect, not a Student one, but
it is recorded here because the parent portal is the highest-traffic surface in
the product and will hit it immediately. §50 Q6.

---

# 28. Academic Structure Relationship

## 28.1 Which academic object Enrollment references

**Both `programId` and `academicUnitId`, and the `academicUnitId` points at the
leaf.**

```
Program              "Std 9 · CBSE · English medium"     ← what is studied
   └── AcademicUnit  unitType: CLASS,   name: "Std 9"    ← level 1
         └── AcademicUnit unitType: SECTION, name: "A"   ← level 2, THE LEAF
                                                            Enrollment points here
```

| Reference | Why both are needed |
| :--- | :--- |
| `academicUnitId` | The **placement**. This is the row that identifies the class register, the attendance sheet and the timetable slot. Enrollment points at the **deepest** unit that applies — the section, not the class — because a coarser pointer cannot answer "who is in 9-A?". |
| `programId` | The **curriculum**. It is not derivable from the unit in the general case: two sections under one class can belong to different programs (Science / Commerce in Std 11), and lateral entry and program switches both change the program without changing the unit. |

**Nothing is hard-coded.** `AcademicUnitType` already offers `SECTION`, `CLASS`,
`DIVISION`, `STREAM`, `DEPARTMENT`, `YEAR`, `SEMESTER`, `BATCH`, `CUSTOM`.
Enrollment stores a `academicUnitId` and **never inspects `unitType`**. A school
runs `CLASS → SECTION`; a college runs `YEAR → SEMESTER → DIVISION`; a custom
institution runs whatever it configures. The Enrollment code is identical in all
three.

> **Rule:** no Student or Enrollment code may branch on `AcademicUnitType`,
> `Program.level`, `Branch.institutionType`, or a unit's `name`. Anything that
> needs to vary by institution reads configuration (§44), never a type enum.

## 28.2 The structural facts Enrollment must respect

| Fact | Requirement on Enrollment |
| :--- | :--- |
| `AcademicUnit` carries `academicYearId` directly | `Enrollment.academicYearId` must equal `AcademicUnit.academicYearId`. Validated on write; INV-ENR-010. |
| `AcademicUnit` carries `branchId` and `programId` | Both must match the Enrollment's. Validated on write. **The current code validates neither** (`enrollment.service.ts:41–54` checks existence only). |
| `AcademicYear.isLocked` | Every Enrollment write checks it. F-5. |
| The unit tree is self-referencing with `level` | Enrollment stores the leaf. A read that needs the ancestry walks `parentId` — that is a read concern, not a stored one. |
| `Program.level` is **nullable** with only three values | It **cannot** carry the "does progression here need a new Admission?" rule. §50 Q1. |

## 28.3 Validation on every Enrollment write

Non-negotiable, and all of it missing today:

```
assert academicUnit.branchId       == ctx.branchId
assert academicUnit.academicYearId == enrollment.academicYearId
assert academicUnit.programId      == enrollment.programId
assert academicUnit.isActive && !academicUnit.isDeleted
assert program.branchId            == ctx.branchId
assert !academicYear.isLocked
```

Five of these six are absent from the current implementation, which is how a
Branch A administrator can currently place a student into a Branch B academic
unit.

---

# 29. Context / Tenant Isolation

## 29.1 Identity scope versus execution scope

The distinction the brief asks for, made concrete:

| | **Identity scope** | **Execution scope** |
| :--- | :--- | :--- |
| Question | *Who is this person, and which tenant do they belong to?* | *Which organization / branch / year is this request operating in?* |
| Source | Columns on the row | `RequestContext`, resolved by `ExecutionContextGuard` |
| Lifetime | The life of the row | One request |
| Example | `Student.organizationId` | `ctx.organizationId` |
| Mutability | `Student.branchId` is a mutable pointer; `organizationId` never changes | Changes per request |

**They are never mixed.** A write takes its scope columns from the **resource or
its parent**, never blindly from the request context — that is exactly the bug in
`enrollment.service.ts:67–69`, where `organizationId`, `branchId` and
`academicYearId` are copied from the caller's context onto a row whose applicant
belongs somewhere else.

> **Rule:** on a write, the request context is used to **authorise**, and the
> resource's own lineage is used to **populate**. When the two disagree, the
> request is rejected — never reconciled in favour of the context.

## 29.2 Which scope columns each table carries

Not all three everywhere. Each column must earn its place.

| Table | `organizationId` | `branchId` | `academicYearId` | Reasoning |
| :--- | :---: | :---: | :---: | :--- |
| `Person` | ✅ | ❌ | ❌ | A human is not branch- or year-scoped. Matching happens org-wide. |
| **`Student`** | ✅ **immutable** | ✅ **mutable pointer** | ❌ **never** | Identity is org-scoped. The branch pointer is a read-scoping convenience. **A year column here would be the single most damaging mistake in the design.** |
| `Admission` | ✅ | ✅ **immutable** | ❌ | A spell of study spans years but never branches. |
| **`Enrollment`** | ✅ | ✅ | ✅ | One year, one branch. All three earn their place. |
| `Applicant` | ✅ | ✅ | ✅ | One attempt, one branch, one year. Unchanged. |
| `Guardian` | ✅ | ❌ | ❌ | Org-scoped so siblings in different branches share one guardian (S1 D2). **Currently branch-scoped — must change.** |
| `Guardianship` | ✅ | ❌ | ❌ | Person↔Person |
| `Address` / `PersonAddress` | ✅ / via Person | ❌ | ❌ | A place is not branch-scoped |
| `Document` | ✅ | ❌ | ❌ | Scopes the encryption key; the owner supplies the rest |
| `WorkflowHistory` | ✅ | ✅ | ❌ | Added so history reads are scopeable without a join |
| `NumberSequenceConfig` | ✅ | ⚠️ nullable | ❌ | Null when `scope = ORGANIZATION` |
| `OutboxEvent` | ✅ | ⚠️ nullable | ⚠️ nullable | Carries the publishing context forward |

## 29.3 How Student and Enrollment consume the context

**No Student-specific context mechanism is introduced.** Verbatim rules:

1. Services read scope via `RequestContextService.getContext()`; controllers may
   read `req.context`. They are the same object.
2. **No service or guard reads a raw header.** `x-branch-id` never appears in
   `src/modules/identity/**` or `src/modules/enrollment/**`.
3. **Nothing writes to the context.** It is `Readonly` and will not compile.
4. Every Student and Enrollment controller declares `@RequireBranch()` and,
   where the operation is year-scoped, `@RequireAcademicYear()`.
5. Endpoints that are legitimately org-wide — student search by code, student
   profile, admission history — declare `@RequireBranch()` **omitted** and
   perform their own org-scoping, and are listed explicitly in §38 so the
   omission is a decision rather than an oversight.
6. `@AllowUnresolvedContext()` is **never** used on a Student or Enrollment
   route. Those routes read the context for scoping, and a null scope must be a
   rejection.

## 29.4 What the platform already guarantees

Recorded so nobody rebuilds it (§8.1): single-writer context, no raw-header
fallbacks, header aliases resolved identically, upward hierarchy resolution
(naming a branch derives its organization, still validated), `409
CONTEXT_SELECTION_REQUIRED` on genuine ambiguity, and absence distinguished from
ambiguity. **None of this is Student's problem, and Student must not
re-implement any of it.**

---

# 30. Authorization

## 30.1 The mandatory access rule

```
        ✅  resource lookup  =  identifier  +  execution scope  +  permission
        ❌  resource lookup  =  identifier
```

Enforced as a code rule in the Student and Enrollment modules:

| Rule | Detail |
| :--- | :--- |
| **`findUnique({ where: { id } })` is banned** | Every read is `findFirst({ where: { id, organizationId, …branchScope, deletedAt: null } })` |
| **A scope miss returns `404`, not `403`** | A `403` confirms the row exists, which is an enumeration oracle |
| **Writes re-assert scope in the `WHERE`** | `update({ where: { id } })` after an unscoped read is the defect in `applicant.service.ts:290`. Writes use `updateMany({ where: { id, organizationId, branchId } })` and assert `count === 1`. |
| **Parent lineage is validated, not assumed** | Creating an Enrollment validates the *applicant's* / *admission's* branch, and does not stamp the caller's context onto it |
| **Org-wide reads are opt-in by permission** | `student.view.organization` widens the scope from branch to organization. Absent it, branch-scoped. |

## 30.2 Permissions

Existing (`src/common/constants/permission.constants.ts`): `student.view`,
`student.create`, `student.update`, `student.delete`, `student.export`,
`student.print`; `admissions.{view,create,update,delete,approve,reject,export}`.

| Change | Permission | Meaning |
| :--- | :--- | :--- |
| **repurpose** | `student.delete` | Gates **archive**, never a hard delete. There is no delete. (Closes C-10.) |
| **add** | `student.view.organization` | Search and read across every branch in the organization |
| **add** | `student.lifecycle` | Withdraw · graduate · suspend · reinstate |
| **add** | `student.transfer` | Branch transfer |
| **add** | `student.code.correct` | The break-glass code correction (§13.4) |
| **add** | `student.sensitive.read` | Reveal a full sensitive identifier (F1 D12) — granted **per user**, not per role |
| **add** | `enrollment.view` | |
| **add** | `enrollment.create` | Placement at admission or readmission |
| **add** | `enrollment.promote` | Individual and bulk promotion |
| **add** | `enrollment.correct` | Correction and mid-year transfer — reason mandatory |
| **add** | `enrollment.cancel` | |
| **add** | `enrollment.rollnumber.manage` | Assign and regenerate roll numbers |

## 30.3 Role matrix

| Operation | `SUPER_ADMIN` | `ORG_ADMIN` | `BRANCH_ADMIN` | `STAFF` | `STUDENT` | `PARENT` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Search students (own branch) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Search students (org-wide) | ✅ | ✅ | ⚠️ permission | ❌ | ❌ | ❌ |
| Read own record | — | — | — | — | ✅ self | ✅ own wards |
| Read student profile | ✅ | ✅ | ✅ own branch | ✅ own branch | ❌ | ❌ |
| Correct demographics | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **`admit()`** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lifecycle (withdraw/graduate/suspend) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Expel | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Branch transfer** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Archive / un-archive | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Correct `studentCode` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reveal a sensitive identifier | ⚠️ per-user grant | ⚠️ per-user grant | ⚠️ per-user grant | ❌ | ❌ | ❌ |
| Create / promote / correct enrollment | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign roll numbers | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Bulk promote | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export students | ✅ | ✅ | ✅ | ⚠️ permission | ❌ | ❌ |

`STUDENT` and `PARENT` reach their own data through portal endpoints that resolve
the subject from the authenticated principal via `UserIdentityLink`. **They never
supply a `studentId` in a path** — that is the shape BOLA takes in a portal.

## 30.4 The escape vectors, and how each is closed

| Vector | Closed by |
| :--- | :--- |
| **Tenant escape** — read another org's student by UUID | `organizationId` in every `WHERE`; `404` on miss |
| **Branch escape (read)** — read another branch's student | Branch scope unless `student.view.organization`; reduced projection cross-branch (§39) |
| **Branch escape (write)** — enroll another branch's applicant | Parent lineage validated (§30.1); the composite FK makes a mismatched branch unrepresentable (§18.3) |
| **Academic-year escape** — write into a prior or locked year | `academicYearId` from the resource; `isLocked` checked |
| **UUID enumeration** | v7 is guessable in principle; scope filtering means guessing yields `404` |
| **Privilege escalation via mass assignment** | Global `ValidationPipe` with `forbidNonWhitelisted`; `status`, `studentCode`, `organizationId`, `personId` never appear in any update DTO |
| **Escalation via a status write** | No endpoint accepts `status`. Lifecycle transitions are named operations. |
| **Escalation via header spoofing** | `ExecutionContextGuard` validates every supplied scope id against the caller's grants; a cross-tenant `x-organization-id` is `403` |
| **Exfiltration via export** | `student.export` is separately permissioned and **separately audited** with actor, filter and row count — bulk export is the highest-risk action in the system |

---

# 31. Transactions

## 31.1 `admit()` — the critical path

The single most important operation in this design. `POST
/v1/admissions/applicants/:id/admit`.

### Before the transaction — validation and I/O that must not hold locks

Everything here is read-only and cheap to repeat. None of it may sit inside the
transaction, because each read extends the lock hold on the numbering counter and
the applicant row.

| # | Check | Failure |
| :--- | :--- | :--- |
| 1 | Applicant exists **within the caller's org + branch** | `404` |
| 2 | Caller holds `admissions.approve` **and** `student.create` | `403` |
| 3 | Applicant status is `SEAT_CONFIRMED` | `409 APPLICANT_NOT_SEAT_CONFIRMED` |
| 4 | Target academic year exists, belongs to the branch, **is not locked** | `403 ACADEMIC_YEAR_LOCKED` |
| 5 | Target `Program` belongs to the branch | `400` |
| 6 | Target `AcademicUnit` belongs to the branch **and** the program **and** the year, and is active | `400` |
| 7 | Document checklist satisfied at `requiredByStage = SEAT_CONFIRMED` (if S3 exists) | `409 DOCUMENTS_INCOMPLETE` |
| 8 | Numbering configs exist for `STUDENT_CODE` (org) and `ADMISSION_NO` (branch) | `500 NUMBERING_NOT_PROVISIONED` — a missing config is a provisioning failure, not a user error |
| 9 | ~~Seat capacity~~ | **Not performed.** No seat matrix exists (§2.2, §50 Q3). Stated explicitly so nobody assumes it is happening. |

### Inside the transaction — what must be atomic

One `prisma.$transaction`, `READ COMMITTED`, timeout 15 s.

| # | Step | Why it is inside |
| :--- | :--- | :--- |
| 1 | `SELECT … FROM "Applicant" WHERE id = … AND organizationId = … AND branchId = … FOR UPDATE` | **Serialises concurrent `admit()` calls on the same applicant.** Prisma has no row-lock API — this is `$queryRaw`. §33. |
| 2 | Re-assert status is `SEAT_CONFIRMED` **after** acquiring the lock | The first read was before the lock; a competing transaction may have committed in between |
| 3 | `PersonService.resolve(orgId, identifiers, tx)` → `personId` | Deterministic find-or-create; must share the transaction |
| 4 | Look up an existing `Student` for `(organizationId, personId)` | Decides create-vs-readmit |
| 5a | **If none:** allocate `STUDENT_CODE` (org sequence, `MONOTONIC`) and insert **Student** | |
| 5b | **If one exists:** reuse it. Assert it is not `EXPELLED`/`ARCHIVED` without the elevated permission. This is the readmission path (§23). | |
| 6 | Assert the Student has **no `ACTIVE` Admission** | Backed by INV-ADM-002; the assert produces a good error instead of a raw constraint violation |
| 7 | Allocate `ADMISSION_NO` (branch sequence, `MONOTONIC`) and insert **Admission**, `status: ACTIVE` | |
| 8 | Insert the first **Enrollment**, `originType: ADMISSION`, `enrollmentStatus: ACTIVE`, `enrollmentKind: PRIMARY` | |
| 9 | Transition Applicant → `ADMITTED` through the workflow engine, set `Student.sourceApplicantId` | `ADMITTED`, **not** `APPROVED` (C-1) |
| 10 | Write `WorkflowHistory` rows for Applicant, Admission and Enrollment | Polymorphic |
| 11 | Write **outbox** rows for every event in §36 | §37 — this is what makes the events survive a crash |

**Steps 5a and 7 must allocate numbers *inside* the transaction.** The current
`NumberingService` increments before the insert with no shared transaction
(N-2), so a failure leaves a hole — and worse, the `create`/`catch` handler
(N-3) aborts the whole transaction the first time a counter does not yet exist.
Both are Phase 0.

### After commit — what may be asynchronous

| Work | Why it is outside |
| :--- | :--- |
| Publishing the outbox rows to `EventBus` | The relay picks them up. At-least-once. |
| Audit rows | Written by `AuditListener` from the published events |
| Welcome SMS / email to the guardian | **Communication must never be able to fail an admission.** An SMTP timeout inside the transaction would roll back a student. |
| ID-card generation, portal account provisioning, search-index warming | Consumers of `student.created` |
| Fee schedule generation for the new enrollment | Consumer of `enrollment.created` |

### The failure matrix

| Failure point | Outcome |
| :--- | :--- |
| Pre-transaction validation | Nothing written. Applicant stays `SEAT_CONFIRMED`. Retry is safe. |
| Inside the transaction, anywhere | **Everything rolls back.** No Student, no Admission, no Enrollment, no history, no outbox rows. The applicant stays `SEAT_CONFIRMED`. A `MONOTONIC` number may be burned — a gap, which is acceptable by definition (§34). |
| After commit, before the relay publishes | **The events are safe** — they are committed rows. The relay publishes them on its next pass. |
| Relay publishes twice | Consumers are idempotent; `AuditLog.eventId` is unique (§37). |
| Consumer throws | Isolated per subscriber. The transaction already committed and is unaffected. |

## 31.2 Transaction boundaries for every operation

| Operation | Transaction contents | Numbering mode |
| :--- | :--- | :--- |
| `admit()` | Person, Student, Admission, Enrollment, Applicant transition, 3× WorkflowHistory, outbox | `MONOTONIC` ×2 |
| Applicant create | Applicant + 2 numbers + Person (from `SUBMITTED`) + guardianships + outbox — **currently no transaction at all** | `MONOTONIC` ×2 |
| Workflow transition | Lock, update, WorkflowHistory, outbox | — |
| Promote (single) | Lock old enrollment, close it, insert new, WorkflowHistory ×2, outbox | — |
| Promote (bulk) | **One transaction per student**, not per job (§22.2) | — |
| Correct / transfer placement | Lock, supersede, insert, WorkflowHistory ×2, outbox | — |
| Branch transfer | Lock Student, close Admission #1, close Enrollment, allocate `ADMISSION_NO`, open Admission #2, insert Enrollment, move `Student.branchId`, WorkflowHistory ×3, outbox | `MONOTONIC` ×1 |
| Readmission | Lock Student, assert no `ACTIVE` admission, allocate `ADMISSION_NO`, insert Admission + Enrollment, WorkflowHistory, outbox | `MONOTONIC` ×1 |
| Student lifecycle change | Lock, update status, WorkflowHistory, outbox | — |
| Roll-number regeneration | One transaction per class list | — |
| Receipt / invoice / TC number | Caller's transaction — **the counter row is held until commit** | `GAPLESS` |

## 31.3 Rules

1. **A transaction never contains network I/O.** No HTTP, no SMS, no email, no
   file upload, no virus scan.
2. **A transaction never publishes to `EventBus` directly.** It writes outbox
   rows. §37.
3. **Every service method that participates takes an optional `tx` client** and
   uses it when supplied. A method that silently ignores a passed `tx` and uses
   the global Prisma client is the single most common way an "atomic" operation
   turns out not to be — and `NumberingService.generateNextNumber` already has
   the parameter (`numbering.service.ts:67`) and is called **without** it
   (`applicant.service.ts:212`).
4. **Cross-module calls inside a transaction pass the `tx`.** `admit()` calls
   `PersonService`, `StudentService`, `AdmissionService`, `EnrollmentService` and
   `NumberingService` — all with the same client.
5. **`MONOTONIC` allocation commits in its own short transaction**, so it does
   not hold a lock for the caller's duration. `GAPLESS` deliberately does the
   opposite. §34.

---

# 32. Idempotency

## 32.1 The approach

**No idempotency-key table for this build.** Every operation here is protected by
a combination that is stronger and needs no new infrastructure:

```
state-transition guard  +  row lock  +  database unique constraint
```

Where a duplicate request is nevertheless possible (a network timeout, a
double-click, a proxy retry), the response is an **informative conflict**: a
`409` whose `error.details` names exactly what already exists, so the client can
treat it as success without guessing.

The one place a key *is* required is a caller that cannot interpret a `409` — a
payment gateway callback. That belongs to Finance and is deferred with the
recommendation that it use an `IdempotencyRecord` table keyed on the gateway's
own reference.

## 32.2 Per-operation

| Operation | Key | DB constraint | State guard | Transaction | Retry | Duplicate response |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Approve applicant** | none | — | `FOR UPDATE` + status re-check | ✅ | safe | `400 INVALID_TRANSITION` — the state already moved |
| **`admit()`** | none | `Student @@unique([organizationId, personId])`; `Student.sourceApplicantId` unique; `Admission` one-active partial index; `Enrollment` one-primary partial index | `FOR UPDATE` + `SEAT_CONFIRMED` re-check | ✅ | safe | `409 APPLICANT_ALREADY_ADMITTED`, `details: { studentId, studentCode, admissionId, enrollmentId }` |
| **Create Student** | none | `@@unique([organizationId, personId])` | Only reachable from `admit()` | ✅ | safe | `409 STUDENT_ALREADY_EXISTS`, `details: { studentId, studentCode }` |
| **Create Enrollment** | none | one-`PRIMARY`-per-admission-per-year partial index | Admission `ACTIVE`; year unlocked | ✅ | safe | `409 ENROLLMENT_EXISTS_FOR_YEAR` |
| **Generate `studentCode`** | none | `@@unique([organizationId, studentCode])` at the destination | — | caller's | **not** idempotent — a retry burns a number and takes the next value | n/a — a gap, by design |
| **Branch transfer** | none | one-active-admission partial index | `FOR UPDATE` on Student; exactly one `ACTIVE` admission | ✅ | safe | `409 NO_ACTIVE_ADMISSION` — the first transfer already closed it |
| **Promote (single)** | none | one-`PRIMARY`-per-year partial index | `FOR UPDATE` + `version` check | ✅ | safe | `409 ALREADY_PROMOTED`, `details: { enrollmentId }` |
| **Promote (bulk)** | `jobId` | same index | Per-student skip if a target-year enrollment exists | per student | safe | Resumes; already-promoted students reported as `skipped` |
| **Readmit** | none | one-active-admission partial index | `FOR UPDATE` on Student | ✅ | safe | `409 ACTIVE_ADMISSION_EXISTS` |
| **Correct placement** | none | one-`PRIMARY` index (excludes `SUPERSEDED`) | `version` check on the source row | ✅ | safe | `409 STALE_ENROLLMENT_VERSION` |
| **Person `resolve()`** | `govtIdHash` | `@@unique([organizationId, govtIdHash])` | — | ✅ | safe | **Returns the existing Person.** Genuinely idempotent — a unique violation is caught and retried as a read. |

## 32.3 The two properties that make this work

**Uniqueness lives at the destination, not in the generator.** Even with every
numbering defect unfixed, a duplicate `studentCode` could not reach the database:
`Student @@unique([organizationId, studentCode])` rejects it. A generator must
never be the last line of defence for a value it hands to someone else.

**One Applicant produces at most one Student — enforced, not intended (G-1).**
No existing spec proposes a constraint for this stated business rule:

```sql
CREATE UNIQUE INDEX student_one_per_applicant
  ON "Student" ("sourceApplicantId")
  WHERE "sourceApplicantId" IS NOT NULL;
```

Partial, because `createdVia: MIGRATION` legitimately has a null
`sourceApplicantId`. With it, `1 Applicant → 1 Student` is a database fact rather
than a convention two concurrent requests can break.

---

# 33. Concurrency

## 33.1 The mechanism, per scenario

| Scenario | Protection | Outcome |
| :--- | :--- | :--- |
| **Two admins approve the same applicant simultaneously** | `SELECT … FOR UPDATE` on the applicant as the transaction's first statement, then re-read the status | Second blocks; on release it sees `APPROVED` and gets `400 INVALID_TRANSITION`. Currently **unprotected** (W-1). |
| **Two `admit()` calls for the same applicant** | Same row lock, plus `Student.sourceApplicantId` unique, plus `Student @@unique([organizationId, personId])` | Second gets `409` naming the created student. **One Student.** |
| **The same child seat-confirmed at two branches, admitted concurrently** | `Person @@unique([organizationId, govtIdHash])` resolves both to one Person; `Student @@unique([organizationId, personId])` rejects the second | Second gets a conflict naming the existing `studentCode` — not a crash, not a duplicate |
| **Two requests create an Enrollment for one admission and year** | Partial unique index `(admissionId, academicYearId) WHERE kind='PRIMARY' AND status NOT IN (SUPERSEDED, CANCELLED)` | Second rejected by Postgres |
| **Two requests generate a `studentCode`** | The allocation is a **single** `INSERT … ON CONFLICT DO UPDATE … RETURNING` — the row lock is held for one statement | Both succeed with distinct values. No deadlock. |
| **Two admins transfer the same student** | `SELECT … FOR UPDATE` on Student + the one-active-admission partial index | Second sees no `ACTIVE` admission → `409` |
| **Bulk promotion runs while an admin edits an enrollment** | Optimistic `version` on Enrollment; the per-student transaction takes a row lock | Whichever commits second gets `409 STALE_ENROLLMENT_VERSION` and the job reports that student as failed with a reason |
| **Retry after a network timeout** | The first request may have committed. The unique constraints and the state guard make the retry a `409` naming what exists (§32). | Client can proceed |
| **Queue retry after a successful transaction** | The outbox relay is at-least-once. Consumers are idempotent; `AuditLog.eventId` is unique. | No duplicate audit rows, no duplicate side effects |
| **Two clerks enter the same child simultaneously (Person)** | Unique index on `govtIdHash`, unique violation caught and retried as a read | Exactly one Person; the other call returns it |
| **Concurrent roll-number assignment in one class** | Partial unique index on `(academicUnitId, academicYearId, rollNumber)` | Second rejected |
| **Two receipts allocated concurrently** | `GAPLESS` — the counter row is locked until the caller commits | Serialised, no gaps. This is the one place correctness is deliberately chosen over throughput. |

## 33.2 Row locking in Prisma — the mechanic implementers will otherwise miss

**Prisma has no row-lock API.** `findUnique` and `findFirst` take no lock.
Writing `await tx.applicant.findUnique(...)` and believing it serialises anything
is the mistake this section exists to prevent.

The lock must be an explicit raw statement, and it must be the **first**
statement in the transaction:

```
SELECT "id", "admissionStatus"
FROM "Applicant"
WHERE "id" = $1 AND "organizationId" = $2 AND "branchId" = $3
FOR UPDATE
```

Under `READ COMMITTED`, `FOR UPDATE` re-evaluates the row after the blocking
transaction commits, so the second caller sees the **updated** status. That is
what makes the re-check in §31.1 step 2 meaningful rather than decorative.

## 33.3 Deadlock avoidance

Locks are always acquired in the same order across every operation:

```
Person  →  Student  →  Admission  →  Enrollment  →  NumberSequenceCounter
```

Numbering is **last** and is held for exactly one statement in `MONOTONIC` mode.
Two `admit()` calls at different branches never contend: they use different
`ADMISSION_NO` counters, and the shared `STUDENT_CODE` counter is held for one
statement each.

## 33.4 Isolation level

`READ COMMITTED` — the Postgres default and Prisma's default. `SERIALIZABLE` is
**not** used: every invariant here is protected by an explicit lock or a unique
constraint, and `SERIALIZABLE` would introduce serialization failures that every
caller would then have to retry, for no additional guarantee.

---

# 34. Numbering Engine

## 34.1 One engine, and only one

The existing `NumberingService` **becomes** the central business-identifier
engine. **A second generator is never created**, and in particular
`studentCode` is not generated by the Student module.

It generates: `studentCode`, `admissionNo`, `applicationNo`, `admissionFormNo`,
`employeeCode`, receipt, invoice, TC and certificate numbers.

It does **not** own primary keys — those are UUID v7 and are never generated
here. It does **not** own **where** a value is stored or **whether it is unique**
at its destination; that is the destination table's constraint (§32.3).

**It does not own roll numbers.** A roll number is a position in a class list,
frequently regenerated alphabetically once the list settles, and it is not a
monotonic sequence. It belongs to Enrollment (§14 taxonomy). The claim in
`admissions-production-audit.md` §7 that numbering handles roll numbers and
student ids is false (C-3).

## 34.2 The rewrite

| Change | Detail |
| :--- | :--- |
| **add** `scope` | `SequenceScope` — `ORGANIZATION` \| `BRANCH`. Closes N-1. |
| **change** `branchId` | `String` → `String?`, null when `scope = ORGANIZATION` |
| **add** `allocationMode` | `AllocationMode` — `GAPLESS` \| `MONOTONIC` |
| **change** `purpose` | `String` → `SequencePurpose` enum. A typo currently creates a silent parallel sequence. |
| **change** `resetStrategy` | `String` → `ResetStrategy` enum — `NEVER` \| `YEARLY` |
| **replace** `@@unique([branchId, purpose])` | Two partial indexes, one per scope |
| **replace** the counter's unique index | A **functional** index over a coalesced year — §34.4 |
| **replace** allocation | One `INSERT … ON CONFLICT DO UPDATE … RETURNING` — §34.5 |
| **remove** `ApplicantService.ensureNumberConfig` | Silently inventing a numbering scheme is worse than failing loudly. Configs belong in tenant provisioning. |
| **freeze** `prefix` and `sequencePadding` for `NEVER` sequences | §13.6 |

## 34.3 The purpose table

| Purpose | Scope | Reset | Mode | Example |
| :--- | :--- | :--- | :--- | :--- |
| `STUDENT_CODE` | **ORGANIZATION** | **NEVER** | MONOTONIC | `STU0000012345` |
| `EMPLOYEE_CODE` | ORGANIZATION | NEVER | MONOTONIC | `EMP0000000418` |
| `ADMISSION_NO` | BRANCH | YEARLY | MONOTONIC | `MUM-2026-0042` |
| `ADMISSION_FORM` | BRANCH | YEARLY | MONOTONIC | `ADM-2026-0117` |
| `APPLICATION` | BRANCH | YEARLY | MONOTONIC | `APP-2026-0117` |
| `RECEIPT` | BRANCH | YEARLY | **GAPLESS** | `RCP-2026-000241` |
| `INVOICE` | BRANCH | YEARLY | **GAPLESS** | `INV-2026-000108` |
| `TC_NUMBER` | BRANCH | YEARLY | **GAPLESS** | `TC-2026-0033` |
| `CERTIFICATE` | BRANCH | YEARLY | MONOTONIC | `BON-2026-0451` |

## 34.4 Gapless versus monotonic

An earlier note in this project said *"a permanent `studentCode` cannot have holes
or collisions."* **Half of that is wrong.** Collisions are fatal; holes are
cosmetic. Nobody audits student codes for continuity.

Financial and statutory documents are different — GST invoice numbering and
receipt books are checked for continuity, and a missing number is a question an
auditor will ask.

| Mode | Guarantee | Allocation | Cost | Used by |
| :--- | :--- | :--- | :--- | :--- |
| **`MONOTONIC`** | Unique, increasing. **Gaps permitted.** | Its own short transaction; commits immediately | None | `studentCode`, `admissionNo`, `applicationNo`, `admissionFormNo`, `employeeCode` |
| **`GAPLESS`** | Unique, increasing, **no gaps** | Inside the caller's transaction; rolls back with it | The counter row is locked until the caller commits, serialising that purpose for that scope | `RECEIPT`, `INVOICE`, `TC_NUMBER` |

This resolves C-7: `numbering-review.md` §2B (wrap it in the caller's
transaction) and §2C (that throttles throughput) are **both right, for different
purposes**. Paying serialization for receipts is correct. Paying it for every
admission form is not.

## 34.5 The NULL trap, and the fix

`@@unique([configId, academicYearId])` looks correct and **silently does not
work** when `academicYearId` is null — which is exactly the `resetStrategy: NEVER`
case that `STUDENT_CODE` uses. §6.2 explains the consequence.

```sql
CREATE UNIQUE INDEX counter_config_year_unique
  ON "NumberSequenceCounter" (
    "configId",
    COALESCE("academicYearId", '00000000-0000-0000-0000-000000000000')
  );
```

The functional index is specified rather than `UNIQUE NULLS NOT DISTINCT` because
the Postgres version is not pinned anywhere in the repository — no
`docker-compose`, and `migration_lock.toml` records only the provider. On 15+ the
`NULLS NOT DISTINCT` form is cleaner and self-documenting. **Pin the version**
(§50 Q2); an assumption that lives only in someone's head is a deployment
surprise.

## 34.6 Allocation

One statement replaces `numbering.service.ts:92–131`:

```sql
INSERT INTO "NumberSequenceCounter"
       ("id", "configId", "academicYearId", "currentValue", "updatedAt")
VALUES ($1, $2, $3, 1, now())
ON CONFLICT ("configId", COALESCE("academicYearId", '000…000'))
DO UPDATE SET "currentValue" = "NumberSequenceCounter"."currentValue" + 1,
              "updatedAt"    = now()
RETURNING "currentValue";
```

No find-then-create, no `try`/`catch`, no race window, and **no aborted
transaction** — which closes N-3, the defect that activates the moment numbering
runs inside `admit()`.

**Order of operations** — placeholders resolve *before* the increment, so no
lookup sits inside the lock window (closes N-4):

```
1. Load config                      (cacheable — configs change rarely)
2. Resolve {branchCode} and {year}  ← BEFORE touching the counter
3. Execute the statement above
4. Format the string
5. Return
```

## 34.7 Rules

| Rule | Detail |
| :--- | :--- |
| **Numbers are never reused** | Not after a rollback, not after a void. A voided receipt keeps its number and is marked void. Reissuing breaks every audit that assumed sequence uniqueness. |
| **There is no reset endpoint** | A branch wanting to restart configures `resetStrategy: YEARLY`. It does not get a button that rewinds a live counter. |
| **There is no "generate a number" endpoint** | Allocation happens only inside a business operation that is about to persist the result. An endpoint that hands out numbers on request guarantees gaps and invites misuse. |
| **A format must contain `{sequence}`** | Validated at config creation. Without it every generated value is identical and the failure surfaces as a confusing unique violation at the destination. |
| **Generated values are persisted, not derived** | Changing a format next year must never alter an ID card printed this year. |
| **A `preview` endpoint exists** | So administrators can see the effect of a format change without burning a value — the absence of which is why people test formats by creating throwaway applicants. |
| **Provisioning, not auto-creation** | Every organization needs `STUDENT_CODE` and `EMPLOYEE_CODE` at creation; every branch needs the branch-scoped set. This is tenant onboarding, and it is the direct replacement for `ensureNumberConfig`. |

---

# 35. Domain Events

## 35.1 The event catalogue

Every event carries an auto-generated UUID v7 `eventId`, `eventName`,
`occurredAt`, `aggregateId`, `aggregateType`. Per `docs/core/events.md` the
payload carries **what** happened; `RequestContext` supplies **who**
(`userId`, `role`, `requestId`, `organizationId`, `branchId`, `academicYearId`).
Actor and tenant identity are **not** duplicated into payloads.

| Event | Producer | Aggregate | Payload (beyond context) | Sync/Async | Outbox | Consumers |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `applicant.created` | Applicant | Applicant | `applicantId`, `applicationNo`, `admissionFormNo` | async | ✅ | audit |
| `applicant.person_resolved` | Workflow | Applicant | `applicantId`, `personId`, `matchConfidence` | async | ✅ | audit |
| `applicant.submitted` | Workflow | Applicant | `applicantId` | async | ✅ | audit, communication |
| `applicant.offer_issued` | Workflow | Applicant | `applicantId`, `offerExpiresAt` | async | ✅ | communication, seat allocation |
| `applicant.offer_expired` | Expiry job | Applicant | `applicantId` | async | ✅ | waitlist release |
| `applicant.seat_confirmed` | Workflow | Applicant | `applicantId` | async | ✅ | seat allocation, finance |
| `applicant.rejected` | Workflow | Applicant | `applicantId`, `reason` | async | ✅ | audit, communication |
| `applicant.deferred` / `.withdrawn` | Workflow | Applicant | `applicantId`, `reason` | async | ✅ | audit |
| `admission.transitioned` | Workflow | Applicant | `applicantId`, `oldStatus`, `newStatus`, `actionType` | async | ✅ | audit *(exists today)* |
| **`student.created`** | `admit()` / migration | **Student** | `studentId`, `studentCode`, `personId`, `createdVia`, `sourceApplicantId?` | async | ✅ **required** | **everything** — fees, library, transport, portal, search, analytics |
| `student.updated` | Student | Student | `studentId`, changed fields | async | ✅ | audit, search |
| `student.code_assigned` | `admit()` | Student | `studentId`, `studentCode` | async | ✅ | ID cards, audit |
| `student.code_corrected` | Break-glass | Student | `studentId`, `oldCode`, `newCode`, `reason` | async | ✅ | audit at `severity: WARN`, search, ID cards |
| `student.status_changed` | Lifecycle | Student | `studentId`, `from`, `to`, `reason` | async | ✅ | fees, library, transport, portal |
| `student.branch_transferred` | Transfer | Student | `studentId`, `fromBranchId`, `toBranchId`, `effectiveDate` | async | ✅ | fees, transport, communication, reporting |
| `student.archived` | Archival | Student | `studentId` | async | ✅ | auth (suspend account), search |
| `admission.created` | `admit()` / transfer / readmit | Admission | `admissionId`, `studentId`, `admissionNo`, `admissionType`, `previousAdmissionId?` | async | ✅ | fees, certificates, reporting |
| `admission.closed` | Exit | Admission | `admissionId`, `exitReason`, `exitDate` | async | ✅ | fees (settlement), certificates (TC), transport |
| **`enrollment.created`** | `admit()` / promote / repeat / correct / transfer / readmit | **Enrollment** | `enrollmentId`, `studentId`, `admissionId`, `academicYearId`, `academicUnitId`, `programId`, `originType`, `previousEnrollmentId?` | async | ✅ **required** | attendance, exams, fees, timetable |
| `enrollment.superseded` | Correct / transfer | Enrollment | `oldEnrollmentId`, `newEnrollmentId`, `changeReason` | async | ✅ | **attendance and marks** — they hold rows against the old id |
| `enrollment.status_changed` | Promote / dropout / complete | Enrollment | `enrollmentId`, `from`, `to` | async | ✅ | fees, attendance |
| `enrollment.bulk_promoted` | Bulk job | Job | `jobId`, `branchId`, `fromYear`, `toYear`, `counts` | async | ✅ | audit — **one** event, not N |
| `enrollment.rollnumbers_assigned` | Roll-number job | AcademicUnit | `academicUnitId`, `academicYearId`, `count` | async | ✅ | audit |
| `person.created` / `.merged` / `.government_id_attached` | Person | Person | per I1 §8 | async | ✅ | audit, search index |
| `numbering_config.updated` | Numbering | Config | `configId`, changed fields | async | ✅ | audit — it alters every future identifier |

## 35.2 Events deliberately **not** created

| Rejected | Why |
| :--- | :--- |
| `student.viewed` | Read volume would swamp the log. Reads are covered by request logging; **exports** are audited separately (§30.4) because that is the risky one. |
| `numbering.allocated` | Thousands a day, inside other operations, and the number is already visible on the record that carries it. The event that matters is the **configuration** change. |
| One event per student in a bulk promotion **for audit** | `enrollment.bulk_promoted` carries the job id and counts. Individual `enrollment.created` rows still go to the outbox for downstream *state*, but audit records the batch. |
| `student.deleted` | There is no delete. The allowlist entry (`audit.listener.ts:13`) becomes dead and should be removed. |
| A separate `student.promoted` | Promotion is an Enrollment fact. Naming it after Student would imply Student changed, which is exactly the misconception this design fights. |

## 35.3 Naming and registration rules

1. All events live in `src/common/events/` — `student.events.ts`,
   `enrollment.events.ts`, extending the existing `admissions.events.ts` — and
   are exported through `index.ts`. Module-local `events/` directories are
   prohibited.
2. `src/common/events/examples/student-created.event.ts` is an **example file**.
   The real event replaces it; the example is deleted so nobody imports the wrong
   one.
3. Every new event name is added to `registeredEventNames` in
   `audit.listener.ts`. **An unregistered event bypasses audit silently** — this
   is the most likely omission during implementation.
4. Naming is `module.action` in `snake_case`, matching `AuditEventMapper`'s
   inference. Where inference would be wrong, the event supplies
   `metadata.action` and `metadata.module` explicitly.

---

# 36. Transactional Outbox Recommendation

## 36.1 The problem

Today: `await prisma.$transaction(...)` then `await eventBus.publish(...)`
(`workflow.service.ts:60`, `:126`). The ordering is right — the event is not
published before the data commits. The **durability** is not: the bus is in-process
and in-memory, so a crash, a restart or a container eviction between commit and
publish loses the event permanently.

For `applicant.updated` that is an annoyance. For **`student.created`** it is a
correctness failure: a Student exists that no downstream module ever heard about.
No fee schedule, no library membership, no portal account, no search index entry
— and no way to discover the omission except by reconciliation.

## 36.2 The recommendation

```
                    ┌──────────────── one transaction ────────────────┐
   admit()  ──────▶ │  Student · Admission · Enrollment · History      │
                    │  + OutboxEvent rows                             │
                    └──────────────────────┬──────────────────────────┘
                                           │ COMMIT
                                           ▼
                              ┌────────────────────────┐
                              │  OutboxRelay           │  polls, FOR UPDATE SKIP LOCKED
                              └───────────┬────────────┘
                                          ▼
                              ┌────────────────────────┐
                              │  EventBus  (unchanged) │
                              └───────────┬────────────┘
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              AuditListener        Communication          Future modules
                                                       (all unchanged)
```

**The key property: the outbox sits *behind* the `EventBus` abstraction.** No
consumer changes. `AuditListener` continues to subscribe exactly as it does
today. The Anti-Gravity dependency direction is preserved, and the whole change
is invisible to every existing subscriber.

## 36.3 `OutboxEvent`

| Field | Type | Note |
| :--- | :--- | :--- |
| `id` | UUID v7 | |
| `eventId` | String, **unique** | The `DomainEvent.eventId`, so a consumer can deduplicate |
| `eventName` | String | |
| `aggregateType`, `aggregateId` | String | |
| `payload` | Json | The full serialised event |
| `contextSnapshot` | Json | `userId`, `role`, `requestId`, `organizationId`, `branchId`, `academicYearId` — **captured at write time** |
| `organizationId` | String | Scoping and partitioning |
| `status` | enum | `PENDING`, `PUBLISHED`, `FAILED` |
| `attempts` | Int | |
| `nextAttemptAt` | DateTime | Exponential backoff |
| `lastError` | String? | |
| `createdAt`, `publishedAt?` | DateTime | |

`@@index([status, nextAttemptAt])` drives the relay.

**Why `contextSnapshot` is essential.** `AuditEventMapper` reads `who` from
`RequestContextService`, which is `AsyncLocalStorage`. The relay runs on a timer,
**outside any request**, so that store is empty and every audit row would be
attributed to nobody. The snapshot, captured inside the transaction and replayed
by the relay, is what preserves attribution. Missing it is the single most likely
way to implement this outbox and silently destroy the audit trail.

## 36.4 The relay

| Property | Specification |
| :--- | :--- |
| Trigger | Interval poll (2 s), plus an immediate in-process nudge after commit so the happy path stays sub-second |
| Selection | `SELECT … WHERE status='PENDING' AND nextAttemptAt <= now() ORDER BY createdAt LIMIT 100 FOR UPDATE SKIP LOCKED` — safe with multiple instances |
| Publication | Restores `contextSnapshot` into `AsyncLocalStorage`, then calls `eventBus.publish()` |
| Success | `status = PUBLISHED`, `publishedAt` set |
| Failure | `attempts++`, exponential backoff, `lastError` recorded; `FAILED` after 10 attempts, alerted |
| Ordering | Per aggregate, by `createdAt`. **Global ordering is not guaranteed** and consumers must not assume it. |
| Delivery | **At-least-once.** Consumers must be idempotent. |
| Retention | `PUBLISHED` rows pruned after 7 days |

## 36.5 What must be idempotent as a result

| Consumer | Deduplication |
| :--- | :--- |
| `AuditListener` | **`AuditLog.eventId String? @unique`** — a new column, and a Phase 0 prerequisite. Without it a relay retry writes a duplicate audit row and there is no way to tell it from a real second event. |
| Communication | Its existing `DeliveryLog` keyed by event id |
| Future modules | Contract: consumers dedupe on `eventId` |

## 36.6 What does *not* go through the outbox

Events published entirely outside a transaction — `user.logged_in`,
`authorization.permission_denied`, workspace navigation changes — keep publishing
directly. There is no transaction to attach them to, and routing them through the
outbox would add latency for no durability gain.

**The rule:** *if the event describes something a transaction just committed, it
goes in the outbox. Otherwise it publishes directly.*

---

# 37. Audit Integration

## 37.1 The rule

Business modules **never** import `AuditService` or `AuditRepository`. They
publish domain events. Audit is a subscriber. This is already the architecture
(`docs/core/audit.md`) and it is not modified — Student and Enrollment simply
comply.

```
StudentService ──publish──▶ EventBus ──▶ AuditListener ──▶ AuditLog
                                             │
                                    RequestContextService  (who)
```

## 37.2 Coverage

| Operation | Event | Audit action | Severity |
| :--- | :--- | :--- | :--- |
| Student created | `student.created` | `CREATE` | INFO |
| Student demographics corrected | `student.updated` **with `metadata.changes`** | `UPDATE` | INFO |
| Student archived / restored | `student.archived` / `student.status_changed` | `UPDATE` | INFO / **WARN** on restore |
| Student withdrawn / graduated / suspended / expelled | `student.status_changed` | `UPDATE` | INFO, **WARN** for expulsion |
| Student transferred | `student.branch_transferred` | `EXECUTE` | **WARN** |
| Student promoted | `enrollment.created` (`originType: PROMOTION`) | `CREATE` | INFO |
| Student readmitted | `admission.created` (`type: READMISSION`) | `CREATE` | INFO |
| Student merged | `person.merged` | `EXECUTE` | **CRITICAL** |
| `studentCode` assigned | `student.code_assigned` | `CREATE` | INFO |
| **`studentCode` corrected** | `student.code_corrected` | `UPDATE` | **CRITICAL** |
| Enrollment created | `enrollment.created` | `CREATE` | INFO |
| Enrollment superseded | `enrollment.superseded` | `UPDATE` | INFO |
| Enrollment cancelled | `enrollment.status_changed` | `UPDATE` | **WARN** |
| Bulk promotion | `enrollment.bulk_promoted` | `EXECUTE` | INFO |
| **Student export** | `student.exported` | `EXECUTE` | **WARN** — actor, filter, row count |
| Sensitive identifier revealed | `student.sensitive_read` | `EXECUTE` | **CRITICAL** — one read, one row, with a stated purpose |

## 37.3 Field-level diffs

`AuditLog.changes` accepts `[{ field, oldValue, newValue }]`. Student demographic
corrections **must** populate it — "the record changed" is not an audit trail
when the question is "who changed the date of birth, and from what".

`docs/core/audit.md` notes the current weakness: state transitions share the
generic `.updated` event name, so a client cannot separate "this year was locked"
from "this year was renamed". Student and Enrollment avoid it by giving every
lifecycle transition **its own event name** rather than reusing `.updated`.

## 37.4 Three streams, not one

Frequently and wrongly merged:

| Stream | Purpose | Retention | Access |
| :--- | :--- | :--- | :--- |
| **Domain events** | Integration; may be replayed | 7 days after publication (outbox) | Internal |
| **Audit log** | Who changed what; legally significant; immutable | Academic/financial 7+ years, security 3 years, operational 1–2 | Role-boundary-enforced query API |
| **Application logs** | Debugging | Short | Operators |

---

# 38. API Contract Plan

All routes are `/v1`, follow `docs/core/response-contract.md` verbatim, and
**introduce no new envelope**. List endpoints return the service result unchanged
so pagination lifts onto the envelope `meta` (§7.4).

## 38.1 Applicant and admission workflow (delta)

| Method | Path | Purpose | Scope | Permission | Tx | Idem | Events |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/admissions/applicants` | Register; accepts nested `guardians[]` | branch+year | `admissions.create` | ✅ **new** | none | `applicant.created`, `guardianship.created` |
| `GET` | `/admissions/applicants` | List / search | branch+year | `admissions.view` | — | — | — |
| `GET` | `/admissions/applicants/:id` | Detail | branch+year **scoped lookup** | `admissions.view` | — | — | — |
| `PATCH` | `/admissions/applicants/:id` | Edit while non-terminal | branch+year | `admissions.update` | ✅ | — | `applicant.updated` |
| `POST` | `/admissions/applicants/:id/workflow` | Transition (13 states) | branch+year | per §17.1 | ✅ | state guard | per transition |
| `POST` | `/admissions/applicants/:id/preferences` | Program preferences | branch+year | `admissions.update` | ✅ | — | — |
| `POST` | `/admissions/applicants/:id/defer` | Deferment | branch+year | `admissions.update` | ✅ | state guard | `applicant.deferred` |
| `POST` | `/admissions/applicants/:id/withdraw` | Applicant-initiated exit | branch+year | `admissions.update` | ✅ | state guard | `applicant.withdrawn` |
| **`POST`** | **`/admissions/applicants/:id/admit`** | **§31.1** | branch+year | `admissions.approve` + `student.create` | ✅ | row lock + uniques | `student.created`, `admission.created`, `enrollment.created`, `student.code_assigned` |
| `GET` | `/admissions/applicants/:id/history` | Workflow history | branch+year **scoped** | `admissions.view` | — | — | — |
| ~~`POST`~~ | ~~`/admissions/applicants/check-duplicates`~~ | **Removed** — replaced by `/persons/match` | | | | | |
| ~~`POST`~~ | ~~`/admissions/applicants/:id/enrollment`~~ | **Removed** — enrollment is created by `admit()` | | | | | |

## 38.2 Student

| Method | Path | Purpose | Scope | Permission | Tx | Events |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/students` | Search and list (§39) | branch, or org with permission | `student.view` | — | — |
| `GET` | `/students/lookup?code=STU…` | **Resolve a code to a student** | org | `student.view` | — | — |
| `GET` | `/students/:studentId` | Profile + current enrollment | scoped | `student.view` | — | — |
| `PATCH` | `/students/:studentId` | Correct current demographics | scoped | `student.update` | ✅ | `student.updated` + `changes` |
| `GET` | `/students/:studentId/admissions` | Full admission history | scoped | `student.view` | — | — |
| `GET` | `/students/:studentId/enrollments` | Full enrollment history | scoped | `student.view` | — | — |
| `GET` | `/students/:studentId/timeline` | Merged `WorkflowHistory` across all three | scoped | `student.view` | — | — |
| `POST` | `/students/:studentId/branch-transfer` | §20 | scoped | `student.transfer` | ✅ | `student.branch_transferred`, `admission.closed`, `admission.created`, `enrollment.created` |
| `POST` | `/students/:studentId/readmit` | §23 direct path | scoped | `student.create` | ✅ | `admission.created`, `enrollment.created` |
| `POST` | `/students/:studentId/withdraw` | Lifecycle, reason required | scoped | `student.lifecycle` | ✅ | `student.status_changed`, `admission.closed` |
| `POST` | `/students/:studentId/graduate` | Lifecycle | scoped | `student.lifecycle` | ✅ | `student.status_changed` |
| `POST` | `/students/:studentId/suspend` · `/reinstate` | Lifecycle, reason required | scoped | `student.lifecycle` | ✅ | `student.status_changed` |
| `POST` | `/students/:studentId/archive` · `/restore` | Archival | org | `student.delete` (repurposed) | ✅ | `student.archived` |
| `POST` | `/students/:studentId/correct-code` | Break-glass (§13.4) | org | `student.code.correct` | ✅ | `student.code_corrected` |
| `GET` | `/students/export` | CSV/XLSX | scoped | `student.export` | — | `student.exported` |
| **none** | ~~`POST /students`~~ | A Student is born only from `admit()`, readmission or migration | | | | |
| **none** | ~~`DELETE /students/:id`~~ | There is no delete | | | | |

## 38.3 Enrollment

| Method | Path | Purpose | Scope | Permission | Tx | Events |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/enrollments` | List by unit / program / year / status | branch+year | `enrollment.view` | — | — |
| `GET` | `/enrollments/:id` | Detail | scoped | `enrollment.view` | — | — |
| `POST` | `/enrollments/:id/promote` | Next year | branch | `enrollment.promote` | ✅ | `enrollment.created`, `enrollment.status_changed` |
| `POST` | `/enrollments/:id/repeat` | Same unit, next year | branch | `enrollment.promote` | ✅ | same |
| `POST` | `/enrollments/:id/correct` | Placement correction, reason required | branch+year | `enrollment.correct` | ✅ | `enrollment.superseded`, `enrollment.created` |
| `POST` | `/enrollments/:id/transfer` | Mid-year section/program move | branch+year | `enrollment.correct` | ✅ | same |
| `POST` | `/enrollments/:id/cancel` | Void, reason required | branch+year | `enrollment.cancel` | ✅ | `enrollment.status_changed` |
| `PATCH` | `/enrollments/:id/roll-number` | Assign, until lock | branch+year | `enrollment.rollnumber.manage` | ✅ | — |
| `POST` | `/enrollments/bulk-promote` | **`202` + `jobId`** (§22.2) | branch | `enrollment.promote` | per student | `enrollment.bulk_promoted` |
| `POST` | `/enrollments/assign-roll-numbers` | Alphabetical regeneration for a unit | branch+year | `enrollment.rollnumber.manage` | ✅ | `enrollment.rollnumbers_assigned` |
| `GET` | `/enrollments/jobs/:jobId` | Job progress and failures | branch | `enrollment.promote` | — | — |
| **none** | ~~`POST /enrollments`~~ | Every Enrollment has an origin operation | | | | |
| **none** | ~~`DELETE`~~ | Cancel or supersede | | | | |

## 38.4 Person and numbering

| Method | Path | Purpose | Permission |
| :--- | :--- | :--- | :--- |
| `POST` | `/persons/match` | Fuzzy candidates for the admission UI | `admissions.view` |
| `GET` | `/persons/:id` | Identity linkage — **never personal detail** | `student.view` |
| `POST` | `/persons/:id/government-id` | Attach a late-arriving Aadhaar | `admissions.update` |
| `POST` | `/persons/:id/merge` | Merge (deferred build, §40) | `ORG_ADMIN`+ |
| `POST` | `/persons/match-decisions` | Record a reviewed non-match | `admissions.update` |
| `GET`/`POST`/`PATCH` | `/numbering/configs` | Manage sequences | `ORG_ADMIN`+ |
| `POST` | `/numbering/configs/:id/preview` | Render a sample **without consuming a number** | `BRANCH_ADMIN`+ |
| **none** | ~~`POST /numbering/generate`~~ | §34.7 | |

## 38.5 Error contract

Every rule a client can trigger, with its status and `error.code`:

| Rule broken | Status | `error.code` | `error.details` |
| :--- | :--- | :--- | :--- |
| Resource outside the caller's scope | `404` | `NotFoundException` | — (never `403`) |
| Applicant not `SEAT_CONFIRMED` | `409` | `APPLICANT_NOT_SEAT_CONFIRMED` | `currentStatus` |
| Applicant already admitted | `409` | `APPLICANT_ALREADY_ADMITTED` | `studentId`, `studentCode`, `admissionId`, `enrollmentId` |
| Person already has a Student in this org | `409` | `STUDENT_ALREADY_EXISTS` | `studentId`, `studentCode` |
| Second `ACTIVE` admission | `409` | `ACTIVE_ADMISSION_EXISTS` | `admissionId`, `admissionNo` |
| Enrollment already exists for the year | `409` | `ENROLLMENT_EXISTS_FOR_YEAR` | `enrollmentId` |
| Roll number already used in that class | `409` | `ROLL_NUMBER_TAKEN` | `enrollmentId` |
| Correction without a reason | `400` | `CHANGE_REASON_REQUIRED` | |
| Invalid workflow transition | `400` | `INVALID_TRANSITION` | `from`, `to`, `allowed[]` |
| Academic year locked | `403` | `ACADEMIC_YEAR_LOCKED` | `academicYearId` |
| Academic unit not in the caller's branch/program/year | `400` | `ACADEMIC_UNIT_MISMATCH` | |
| Branch transfer by a `BRANCH_ADMIN` | `403` | `ForbiddenException` | |
| Transfer blocked by open workflows | `409` | `TRANSFER_BLOCKED` | `blockers[]` |
| Stale enrollment version | `409` | `STALE_ENROLLMENT_VERSION` | `expectedVersion` |
| Editing a `COMPLETED` enrollment | `403` | `ForbiddenException` | |
| Numbering not provisioned | `500` | `NUMBERING_NOT_PROVISIONED` | `purpose`, `scope` |
| Padding/prefix change on a `NEVER` sequence | `400` | `SEQUENCE_WIDTH_IMMUTABLE` | |

## 38.6 Which identifier appears in which API position

| Position | Identifier | Rationale |
| :--- | :--- | :--- |
| Internal resource path | `/students/:studentId` — **UUID** | Stable, non-guessable-in-practice, correction-free |
| Human lookup | `/students/lookup?code=STU0000000123` — **query parameter** | A code is a search term, not a resource address, because it has a (narrow) correction path |
| List filters | `academicUnitId`, `programId`, `academicYearId`, `status` — UUIDs and enums | |
| Search text | `q=` matching code, name, mobile, DOB, admission no, application no | §39 |
| Response bodies | **Both** `id` and `studentCode`, always | The client needs one to act and one to display |

**Should external clients see UUIDs at all?** For the staff web client, yes —
it is a trusted first-party consumer and needs a stable handle. For **parent and
student portals**, no: those endpoints resolve the subject from the authenticated
principal and never accept a `studentId` in a path. For **third-party
integrations**, the exported identifier is the `studentCode`, and the integration
resolves it through `/students/lookup`. This keeps UUID v7's embedded creation
timestamp out of untrusted hands and keeps the portal free of the BOLA shape that
`:studentId` in a path invites.

---

# 39. Search Architecture

## 39.1 PostgreSQL is sufficient. Elasticsearch is not introduced.

| Query | Mechanism | Index |
| :--- | :--- | :--- |
| **Exact `studentCode`** | Equality | `@@unique([organizationId, studentCode])` |
| **`studentCode` prefix** (`STU00001*`) | `LIKE 'x%'` | btree with `text_pattern_ops` |
| **Name, fuzzy** | `ILIKE '%x%'` and trigram similarity | **GIN `gin_trgm_ops`** on `displayName` — requires `pg_trgm` |
| **Mobile** | Equality on a normalised last-10-digits column | btree |
| **DOB** | Equality, usually combined with a name | btree, composite with `organizationId` |
| `admissionNo` | Equality | `@@unique([branchId, admissionNo])` |
| `applicationNo` | Equality | existing unique |
| **Guardian name** | Join through `Guardianship` → `Guardian`, trigram on the guardian's name | GIN |
| List by academic unit / year | Equality | composite btree, §41 |

**When to revisit:** more than ~2 million students in one organization, or p95
search latency above 300 ms with the indexes in place and `ANALYZE` current. Not
before. A trigram GIN index on a few hundred thousand rows answers a fuzzy name
search in single-digit milliseconds, and introducing a second datastore buys a
consistency problem, a reindexing problem and an operational dependency in
exchange for nothing measurable.

## 39.2 Normalisation

| Input | Stored as | Why |
| :--- | :--- | :--- |
| Mobile | `mobileNormalized` — last 10 digits, non-digits stripped | `+91 98765 43210`, `098765 43210` and `9876543210` are one number |
| Name | `displayName` for display; `nameNormalized` on **Person** for matching | Case-folded, punctuation-stripped, whitespace-collapsed |
| `studentCode` | Uppercase, stored as generated | Search upper-cases the input, so `stu0000000123` matches |
| DOB | `DateTime` at UTC midnight | Avoids the timezone-shifted-by-one-day class of bug |

## 39.3 Scope and the cross-branch question

The one real policy decision in search. A `BRANCH_ADMIN` searches a
`studentCode` belonging to another branch. What happens?

| Option | Verdict |
| :--- | :--- |
| Return the full record | ❌ Branch isolation is a stated requirement |
| Return `403` | ❌ Confirms the code exists — an enumeration oracle |
| **Return nothing (empty result)** unless the caller holds `student.view.organization` | ✅ **Chosen.** Indistinguishable from a code that does not exist. |
| Return a reduced projection to any org member | ⚠️ Rejected for the default. Genuinely useful for sibling and transfer enquiries, so it is available **by permission**: `student.view.organization` returns `studentCode`, `displayName`, `branchName`, `status` and nothing else for out-of-branch hits. |

**Defaults:**

| Dimension | Default | Widened by |
| :--- | :--- | :--- |
| Organization | Always the caller's. Never widened. | nothing |
| Branch | `ctx.branchId` | `student.view.organization` → reduced projection |
| Academic year | **Not applied to Student search.** Student is not year-scoped. | An explicit `academicYearId` filter searches *enrollments* |
| Lifecycle status | `ACTIVE` only | `includeInactive=true` |
| Archived | Included when `includeInactive=true` | — archival is not a disappearance (§19.1) |

## 39.4 Result behaviour

| Aspect | Specification |
| :--- | :--- |
| Pagination | `page` / `limit`, default 20, max 100. Keyset pagination on `(createdAt, id)` for exports, where `OFFSET` degrades. |
| Sorting | `studentCode`, `displayName`, `createdAt`. Default `displayName asc`. An unrecognised `sortBy` falls back to the default rather than erroring. |
| Duplicates | One row per Student. A guardian-name match that hits two guardians for one student yields **one** row — `DISTINCT ON (Student.id)`. |
| Ranking | Exact `studentCode` first, then exact mobile, then trigram similarity descending, then name alphabetically. Deterministic, so the same query always paginates the same way. |
| Empty vs forbidden | Always empty. Never `403`. |
| Audit | Ordinary reads are not evented (§35.2). **Exports are** (§30.4). |

---

# 40. Database Constraints

**The rule: an invariant that only the service enforces is not an invariant.**
Everything below is what the *database* refuses, not what a service remembers to
check. Prisma cannot express partial unique indexes or `CHECK` constraints, so
those are raw SQL appended to the generated migration — written out here so they
are not reinvented or forgotten.

## 40.1 Declarative constraints

| Model | Constraint | Purpose |
| :--- | :--- | :--- |
| `Person` | `@@unique([organizationId, govtIdHash])` | One government id per org. Postgres treats NULLs as distinct, so any number of people may have no Aadhaar. |
| `Person` | `@@unique([personAId, personBId])` on `PersonMatchDecision` | A reviewed pair is recorded once |
| **`Student`** | `@@unique([organizationId, studentCode])` | **The identity invariant.** Also the last line of defence against a numbering bug. |
| **`Student`** | `@@unique([organizationId, personId])` | **One Student per human per organization.** Resolves the two-branch collision. |
| `Student` | `@@unique([id, organizationId])` | Enables composite references |
| `Admission` | `@@unique([branchId, admissionNo])` | Branch-scoped human reference |
| `Admission` | `@@unique([id, studentId])`, `@@unique([id, studentId, branchId])` | Targets for the composite FK |
| `Enrollment` | `@@unique([id, studentId])` | Propagated to Attendance, Marks and Fees |
| `Enrollment` | Composite FK `(admissionId, studentId, branchId) → Admission(id, studentId, branchId)` | §18.3 — two invariants in one key |
| `Applicant` | `@@unique([branchId, academicYearId, admissionFormNo])`, same for `applicationNo` | Existing, unchanged |
| `WorkflowHistory` | `@@index([entityType, entityId, timestamp])` | Polymorphic history reads |
| `OutboxEvent` | `@@unique([eventId])` | Deduplication |
| `AuditLog` | **`eventId String? @unique`** — *new column* | Makes at-least-once delivery safe (§36.5) |
| `UserIdentityLink` | `@@unique([linkedType, linkedId])`, `@@unique([userId, linkedType, linkedId])` | One account per domain identity |

## 40.2 Partial unique indexes — raw SQL

```sql
-- 1. One Applicant per person per branch per year, among live applications
CREATE UNIQUE INDEX applicant_one_active
  ON "Applicant" ("personId", "branchId", "academicYearId")
  WHERE "personId" IS NOT NULL
    AND "deletedAt" IS NULL
    AND "admissionStatus" NOT IN
        ('REJECTED','WITHDRAWN','CANCELLED','DEFERRED');

-- 2. One Applicant produces at most one Student            ← closes G-1
CREATE UNIQUE INDEX student_one_per_applicant
  ON "Student" ("sourceApplicantId")
  WHERE "sourceApplicantId" IS NOT NULL;

-- 3. One ACTIVE Admission per Student
CREATE UNIQUE INDEX admission_one_active_per_student
  ON "Admission" ("studentId")
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

-- 4. One PRIMARY Enrollment per Admission per academic year
CREATE UNIQUE INDEX enrollment_one_primary_per_year
  ON "Enrollment" ("admissionId", "academicYearId")
  WHERE "enrollmentKind" = 'PRIMARY'
    AND "deletedAt" IS NULL
    AND "enrollmentStatus" NOT IN ('SUPERSEDED','CANCELLED');

-- 5. Roll number unique within a class for a year
CREATE UNIQUE INDEX enrollment_rollno_unique
  ON "Enrollment" ("academicUnitId", "academicYearId", "rollNumber")
  WHERE "rollNumber" IS NOT NULL
    AND "deletedAt" IS NULL
    AND "enrollmentStatus" NOT IN ('SUPERSEDED','CANCELLED');

-- 6. Numbering: one config per purpose per scope
CREATE UNIQUE INDEX numbering_config_org_purpose
  ON "NumberSequenceConfig" ("organizationId", "purpose")
  WHERE "scope" = 'ORGANIZATION' AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX numbering_config_branch_purpose
  ON "NumberSequenceConfig" ("branchId", "purpose")
  WHERE "scope" = 'BRANCH' AND "deletedAt" IS NULL;

-- 7. Numbering: one counter per config per year — the NULL trap fix (§34.5)
CREATE UNIQUE INDEX counter_config_year_unique
  ON "NumberSequenceCounter" (
    "configId",
    COALESCE("academicYearId", '00000000-0000-0000-0000-000000000000')
  );

-- 8. One bulk-promotion job in flight per branch and target year
CREATE UNIQUE INDEX promotion_job_one_active
  ON "PromotionJob" ("branchId", "targetAcademicYearId")
  WHERE "status" IN ('QUEUED','RUNNING');
```

> **Index 4's `SUPERSEDED` exclusion is essential and is the single most likely
> thing to be omitted.** Without it, the Primary-1 → Primary-2 correction is
> rejected, because the old and new rows share an admission and an academic year.

## 40.3 `CHECK` constraints

```sql
-- MIGRATION is the only creation mode permitting a null sourceApplicantId
ALTER TABLE "Student" ADD CONSTRAINT student_origin_check
  CHECK ("createdVia" = 'MIGRATION' OR "sourceApplicantId" IS NOT NULL);

-- A superseded enrollment has both a successor and a reason
ALTER TABLE "Enrollment" ADD CONSTRAINT enrollment_supersede_check
  CHECK ("enrollmentStatus" <> 'SUPERSEDED'
         OR ("supersededById" IS NOT NULL
             AND "changeReason" IS NOT NULL
             AND length(trim("changeReason")) > 0));

-- A closed admission has a date and a reason
ALTER TABLE "Admission" ADD CONSTRAINT admission_exit_check
  CHECK ("status" NOT IN ('COMPLETED','CANCELLED','TRANSFERRED_OUT')
         OR ("exitDate" IS NOT NULL AND "exitReason" IS NOT NULL));

-- personId present from SUBMITTED onward
ALTER TABLE "Applicant" ADD CONSTRAINT applicant_person_check
  CHECK ("admissionStatus" = 'DRAFT' OR "personId" IS NOT NULL);

-- Plausible dates
ALTER TABLE "Student" ADD CONSTRAINT student_dob_check
  CHECK ("dob" > '1900-01-01' AND "dob" <= CURRENT_DATE);

ALTER TABLE "Enrollment" ADD CONSTRAINT enrollment_exit_order
  CHECK ("exitDate" IS NULL OR "exitDate" >= "createdAt"::date);

-- Numbering scope integrity
ALTER TABLE "NumberSequenceConfig" ADD CONSTRAINT numbering_scope_check
  CHECK (("scope" = 'BRANCH') = ("branchId" IS NOT NULL));

-- studentCode is never blank
ALTER TABLE "Student" ADD CONSTRAINT student_code_nonblank
  CHECK (length(trim("studentCode")) > 0);
```

## 40.4 What the database cannot enforce, and therefore needs a test

Stated explicitly so these are not assumed covered:

| Invariant | Why it cannot be a constraint | Test |
| :--- | :--- | :--- |
| `Enrollment.academicYearId` = `AcademicUnit.academicYearId` (INV-ENR-010) | Would need a composite FK through `AcademicUnit(id, academicYearId)` — **achievable**, and recommended: add `@@unique([id, academicYearId])` to `AcademicUnit` and make it a composite FK. Until then, service-enforced. | Integration + raw SQL |
| `Enrollment.branchId` = `AcademicUnit.branchId` | Same; the composite FK to Admission already pins the branch, so the remaining risk is a unit from another branch | Integration |
| `AcademicYear.isLocked` respected | Cross-table state | Integration |
| A student has at most one Student per Person **across a merge** | Enforced by merge logic, asserted after | Integration |
| Transfer blocked by open workflows | Cross-module | E2E |

---

# 41. Indexing Strategy

Derived from the query patterns, not from guessing.

## 41.1 `Student`

| Index | Serves |
| :--- | :--- |
| `@@unique([organizationId, studentCode])` | Exact code lookup — the most common single read |
| `("organizationId", "studentCode" text_pattern_ops)` | Code **prefix** search |
| `@@unique([organizationId, personId])` | `admit()`'s existing-student check; readmission |
| `@@index([organizationId, branchId, status])` | "All active students at this branch" — the list screen |
| **GIN** `("displayName" gin_trgm_ops)` | Fuzzy name search — requires `pg_trgm` |
| `@@index([organizationId, mobileNormalized])` | Search by mobile |
| `@@index([organizationId, dob])` | Search by DOB, usually combined with a name |
| `@@index([sourceApplicantId])` | Applicant → Student navigation (also the partial unique) |
| `@@index([personId])` | Person → roles |

## 41.2 `Enrollment` — the highest-volume table

| Index | Serves |
| :--- | :--- |
| **`@@index([studentId, academicYearId, enrollmentStatus])`** | **The current-enrollment probe** (§11.4) — the single hottest query in the system |
| `@@index([academicUnitId, academicYearId, enrollmentStatus])` | **Class list** — the second hottest |
| `@@index([admissionId, academicYearId])` | Enrollment history for a spell |
| `@@index([studentId, createdAt])` | Full history, chronological |
| `@@index([branchId, academicYearId, enrollmentStatus])` | Branch headcount and reporting |
| `@@index([programId, academicYearId])` | Program-wise reporting |
| `@@index([previousEnrollmentId])` | Provenance chain walking |
| Partial unique ×2 (§40.2 #4, #5) | Also serve as lookup indexes |

## 41.3 `Admission`, `Person`, `WorkflowHistory`, `OutboxEvent`

| Table | Index | Serves |
| :--- | :--- | :--- |
| `Admission` | `@@index([studentId, status])` | Current + historical admissions |
| `Admission` | `@@index([branchId, admissionDate])` | Admission register |
| `Admission` | `@@unique([branchId, admissionNo])` | Human lookup |
| `Person` | `@@unique([organizationId, govtIdHash])` | `resolve()` — deterministic path |
| `Person` | `@@index([organizationId, phoneHash, dob])` | MEDIUM-confidence matching |
| `Person` | `@@index([organizationId, nameNormalized, dob])` | LOW-confidence matching |
| `WorkflowHistory` | `@@index([entityType, entityId, timestamp])` | Timeline for any entity |
| `OutboxEvent` | `@@index([status, nextAttemptAt])` | The relay's selection query |

## 41.4 Query-pattern coverage

| Pattern | Index used | Expected shape |
| :--- | :--- | :--- |
| Search by code | unique | Index-only scan, ~0.1 ms |
| Search by name (fuzzy) | GIN trigram | Bitmap scan, <10 ms at 500k rows |
| List by academic unit | `[academicUnitId, academicYearId, enrollmentStatus]` | Index scan, ~40 rows |
| List by branch + year | `[branchId, academicYearId, enrollmentStatus]` | Index scan + limit |
| Get current enrollment | `[studentId, academicYearId, enrollmentStatus]` | **At most one row**, guaranteed by the partial unique |
| Get enrollment history | `[studentId, createdAt]` | ~12 rows |
| Get admission history | `[studentId, status]` | 1–3 rows |
| Student profile | PK | Single row + composed sub-reads |
| Branch headcount | `[branchId, academicYearId, enrollmentStatus]` | Index-only count |

## 41.5 Extensions required

| Extension | For | Blocking |
| :--- | :--- | :--- |
| `pg_trgm` | Fuzzy name search | Phase 0 — availability must be confirmed, not assumed |
| `btree_gist` | Exclusion constraints on `PersonAddress` validity windows (S2) and effective-dated config (F2) | Only when S2/F2 land |

## 41.6 Deliberately not indexed

`religionId`, `casteId`, `categoryId`, `bloodGroupId`, `genderId` and the other
master FKs on Student. They are **low cardinality** — an index on a column with
six distinct values is not used by the planner for filtering and only costs write
throughput. Reports that group by them do a sequential scan, which at branch
scale is correct. Revisit only with a measured plan showing otherwise.

---

# 42. Testing Strategy

## 42.1 The governing principle

> **A test that runs through Prisma proves the service is careful today. A test
> that runs raw SQL proves the design.**

Every invariant in §40 gets a **raw SQL** test that bypasses the service layer
entirely. Anything else proves only that the current code path happens not to
violate it.

## 42.2 Unit

| Area | Cases |
| :--- | :--- |
| Student Code | Format rendering; padding; prefix; **padding immutable for `NEVER`** (§13.6); value persisted not recomputed |
| Student identity | Which fields are immutable; update DTO rejects `status`, `studentCode`, `organizationId`, `personId` |
| Student lifecycle | Every legal transition; every illegal one rejected; reason enforcement rejects `""` not just `null` |
| Admission state machine | All 13 states × all transitions; the transition table matches the enum exhaustively (a compile-time-ish test that catches an added state with no rules) |
| Enrollment rules | Supersede helper always sets `supersededById` + `changeReason`; `originType` correct per operation; no demographic field is ever written to Enrollment |
| Numbering | Format validation requires `{sequence}`; placeholders resolve before increment; scope/branchId consistency |
| Person matching | HIGH/MEDIUM/LOW confidence tiers; `DISTINCT` decisions exclude pairs |
| Identifier taxonomy | `studentCode` never appears as an FK column in the generated schema — **a schema-introspection test** |

## 42.3 Integration (real Postgres)

| Area | Cases |
| :--- | :--- |
| **Transaction boundary** | `admit()` fails at Enrollment → **zero** Students, zero Admissions, zero WorkflowHistory, zero outbox rows |
| | `admit()` succeeds → exactly one of each, and the outbox rows are present **in the same transaction** |
| **Unique constraints** | Every index in §40.2, each violated deliberately |
| **Branch isolation** | Branch A cannot read, update, delete, transition or enroll Branch B's applicant — **all seven vectors in §8.2** |
| **Organization isolation** | Same across organizations |
| **Academic-year isolation** | Write into a locked year → `403`; prior-year enrollment not returned by a current-year query |
| **Numbering** | 1,000 `STUDENT_CODE` allocations with `resetStrategy: NEVER` → **exactly one counter row**, values 1…1000 *(fails against today's code — catches the NULL trap)* |
| | Allocation inside a transaction where the counter does not yet exist → succeeds *(fails against today's code — catches the aborted-transaction handler)* |
| | `MONOTONIC` rollback → number burned, gap, **no duplicate** |
| | `GAPLESS` rollback → counter rolled back, **no gap** |
| **Outbox** | Relay publishes; `contextSnapshot` restores actor attribution; a duplicate relay pass writes **one** `AuditLog` row |
| **Composite FK** | Raw SQL insert of an Enrollment whose `studentId` ≠ its Admission's → **rejected by Postgres** |
| | Raw SQL insert whose `branchId` ≠ its Admission's → **rejected** |

## 42.4 Concurrency — the tests the current audit says are missing

Each runs N real parallel connections against real Postgres. **None of these
exist today**, and the admissions audit names enrollment, guardian and numbering
concurrency as explicit gaps.

| # | Test | Expected |
| :--- | :--- | :--- |
| 1 | 50 concurrent `admit()` calls, 50 distinct applicants, one organization | 50 distinct `studentCode`s. **No duplicates, no deadlock.** Gaps permitted. |
| 2 | 2 concurrent `admit()` calls, **same** applicant | One Student. The other gets `409 APPLICANT_ALREADY_ADMITTED` with the created ids. |
| 3 | 2 concurrent approvals of the same applicant | One succeeds; the other `400 INVALID_TRANSITION` |
| 4 | Same child seat-confirmed at two branches, admitted concurrently | **One** Person, **one** Student; the second is a conflict naming the existing `studentCode` |
| 5 | 20 concurrent `resolve()` for one Aadhaar | Exactly one Person; the other 19 return it; **no unique-violation surfaced to the caller** |
| 6 | 2 concurrent Enrollments for one admission + year | Second rejected by the partial unique index |
| 7 | 2 concurrent branch transfers of one student | Second `409 NO_ACTIVE_ADMISSION` |
| 8 | Bulk promotion running while an admin edits an enrollment in the batch | One wins; the other `409 STALE_ENROLLMENT_VERSION`; the job reports it as failed **with a reason** |
| 9 | 20 concurrent `GAPLESS` receipt allocations | Values 1…20, **no gaps, no duplicates** |
| 10 | Branch A and Branch B allocate `ADMISSION_NO` concurrently | Independent counters, **no cross-branch contention** |
| 11 | Two concurrent callers for a purpose with no counter yet | Both succeed; one counter row; values 1 and 2 |
| 12 | Concurrent roll-number assignment in one class | Second rejected |
| 13 | Two concurrent primary-guardian changes for one ward | Exactly one active primary — **never zero** *(regression for the untransacted toggle, §24.2)* |

## 42.5 HTTP / E2E

Full lifecycle, through the API, with real auth and real scope headers:

| # | Journey |
| :--- | :--- |
| 1 | Register → submit → review → approve → confirm seat → **admit** → verify Student, Admission, Enrollment, `studentCode`, and all four events |
| 2 | Search by code, by name, by mobile, by DOB, by admission no, by application no |
| 3 | Promote across three academic years → **1 Student, 1 Admission, 3 Enrollments, `studentCode` unchanged** |
| 4 | Branch transfer → Admission #1 closed, #2 opened with a new `admissionNo`, `Student.branchId` moved, **`studentCode` unchanged**; rejected for a `BRANCH_ADMIN` |
| 5 | Readmission after a gap → **no second Student** |
| 6 | Placement correction → both rows readable; partial index #4 not violated |
| 7 | Bulk promote 500 students → job completes, counts correct; re-run skips all 500 |
| 8 | Export → `student.exported` audit row with actor, filter and row count |
| 9 | Response envelope shape on success, on validation failure, on conflict — **`error.details` present and correct** |

## 42.6 Security

| # | Test | Expected |
| :--- | :--- | :--- |
| 1 | Branch A `GET` Branch B's student by UUID | **`404`, not `403`** |
| 2 | Branch A `PATCH` Branch B's student | `404` |
| 3 | Branch A admits Branch B's applicant | `404` |
| 4 | **Branch A creates an enrollment for Branch B's applicant** | `404` *(the cross-branch write, G-2)* |
| 5 | Org A reads Org B's student | `404` |
| 6 | Enrollment into another branch's academic unit | `400 ACADEMIC_UNIT_MISMATCH` |
| 7 | Write into a locked academic year | `403 ACADEMIC_YEAR_LOCKED` |
| 8 | `STAFF` attempts a branch transfer | `403` |
| 9 | `BRANCH_ADMIN` attempts a `studentCode` correction | `403` |
| 10 | Update DTO carrying `status` / `studentCode` / `organizationId` | `400` — `forbidNonWhitelisted` |
| 11 | Spoofed `x-organization-id` for another tenant | `403` |
| 12 | Portal: `PARENT` requests a `studentId` that is not their ward | `404` — and the endpoint takes no `studentId` at all |
| 13 | Cross-branch `studentCode` search without `student.view.organization` | **Empty result**, indistinguishable from a non-existent code |
| 14 | Read a student record as any role | **No Aadhaar in the response** under any role |

## 42.7 Failure-mode tests

| # | Test | Expected |
| :--- | :--- | :--- |
| 1 | Process killed between commit and relay publish | Event published on restart. **Nothing lost.** |
| 2 | Consumer throws | Other consumers unaffected; the transaction already committed |
| 3 | Relay publishes twice | One `AuditLog` row (`eventId` unique) |
| 4 | Database connection lost mid-transaction | Full rollback; applicant still `SEAT_CONFIRMED`; retry succeeds |
| 5 | Numbering config missing at `admit()` | `500 NUMBERING_NOT_PROVISIONED` — **not** a silently invented config |
| 6 | Duplicate request after a client timeout | `409` naming exactly what exists |
| 7 | Bulk promotion killed at student 1,400 | Job shows 1,399 done; resume completes the rest; **no duplicates** |
| 8 | Communication provider down during `admit()` | **Admission succeeds.** The notification retries independently. |

## 42.8 Coverage gates

| Area | Gate |
| :--- | :--- |
| `admit()` transaction | 100% of branches |
| State machines (applicant, admission, enrollment, student) | Every transition, legal and illegal |
| Every §40 constraint | One raw-SQL test each |
| Every §8.2 BOLA vector | One test each |
| Numbering | Both allocation modes, both reset strategies, the NULL trap, the aborted-transaction case |

---

# 43. Migration Strategy

## 43.1 First, determine which world you are in

Do **not** assume there is no data. Run this before choosing a path:

```sql
SELECT
  (SELECT count(*) FROM "Applicant")             AS applicants,
  (SELECT count(*) FROM "Applicant"
     WHERE "admissionStatus" IN ('APPROVED'))    AS approved,
  (SELECT count(*) FROM "Enrollment")            AS enrollments,
  (SELECT count(*) FROM "Guardian")              AS guardians,
  (SELECT count(*) FROM "NumberSequenceCounter") AS counters;
```

| Result | Path |
| :--- | :--- |
| All zero, or development-only data in every environment | **Path A — clean slate.** Recommended. |
| Any environment holds real applicants or enrollments | **Path B — backfill.** |

## 43.2 Path A — clean slate (recommended)

The planning documents assess the current data as development-only, and
`02-applicant.md` §10 Q1 reaches the same conclusion for the same reason: a
nullable-for-legacy column is a permanent scar for a temporary problem.

| Step | Action |
| :--- | :--- |
| A1 | Confirm with the environment owners, in writing, that no environment holds production data |
| A2 | Delete `Enrollment`, `ApplicantGuardianMapping`, `WorkflowHistory`, `Applicant`, `Guardian`, `NumberSequenceCounter` rows |
| A3 | Apply the schema migrations as one ordered set (§43.4) |
| A4 | Seed `NumberSequenceConfig` for every organization (`STUDENT_CODE`, `EMPLOYEE_CODE`) and every branch (`ADMISSION_NO`, `ADMISSION_FORM`, `APPLICATION`, `RECEIPT`, `INVOICE`, `TC_NUMBER`, `CERTIFICATE`) |
| A5 | Verify (§43.5) |

`programId` on Applicant becomes `NOT NULL` immediately, with no legacy
exception — which is the whole reason to prefer this path.

## 43.3 Path B — backfill

If any environment holds real data. Deterministic, resumable, verifiable.

| Order | Step | Detail |
| :--- | :--- | :--- |
| B1 | **Back up.** Point-in-time snapshot before anything. | Non-negotiable — several steps are destructive |
| B2 | Create `Person`, `PersonSensitive`, `Student`, `Admission`, `OutboxEvent` (all additive) | Reversible by application rollback |
| B3 | Add nullable `Applicant.personId`, `Applicant.programId`, and the new timestamps | Additive |
| B4 | **Backfill `Person`** — run every Applicant and Guardian through `resolve()`, hashing `aadhaarNo` into `govtIdHash` and encrypting the value into `PersonSensitive` | Deterministic: same input → same Person |
| B5 | **Backfill `Applicant.programId`** from the applicant's Enrollment where one exists | Applicants with no enrollment have **no source** — they require operator assignment or must stay `DRAFT`. §50 Q9. |
| B6 | **Create a Student for each Applicant that has an Enrollment**, in `createdAt` order so `studentCode` allocation is deterministic and reproducible | `createdVia: MIGRATION`, `sourceApplicantId` set |
| B7 | **Duplicate detection before code allocation** — report every case where two applicants resolved to one Person. **Halt and require operator resolution.** Allocating codes first makes the merge harder. | |
| B8 | **Create an Admission for each new Student** from its Enrollment's branch and year; allocate `ADMISSION_NO` | `admissionType: MIGRATION`, `admissionDate` = the enrollment's `createdAt` |
| B9 | **Rewrite `Enrollment`** — add `studentId`, `admissionId`, `originType: MIGRATION`, `enrollmentKind: PRIMARY`, `version`; drop `applicantId @unique` and the cascade; drop `futureStudentId`; make `applicantId` a plain nullable column | **Destructive** — expand/contract per `docs/core/migrations.md` §5 |
| B10 | **Migrate `WorkflowHistory`** to `(entityType='APPLICANT', entityId=applicantId)`; drop the old column and cascade | |
| B11 | Convert `Applicant.admissionStatus` to the enum; existing values map one-to-one | `APPROVED` keeps its name but changes meaning (§17) — communicate it |
| B12 | Rewrite numbering (scope, mode, enums, the functional counter index) and seed the organization-scoped configs | |
| B13 | Drop `Applicant.aadhaarNo`, `Guardian.aadhaarNo`, `Applicant.photoFileId` | **Destructive** |
| B14 | Tighten to `NOT NULL`: `Applicant.programId`, `Applicant.personId` where non-`DRAFT` | Only after B5 verifies clean |
| B15 | **Create the partial unique indexes last** | They will fail on pre-existing violations — which is the point. Reconcile first. |
| B16 | Verify (§43.5) |

**Step B15 will surprise.** The data may already be invalid: nothing currently
prevents two active primary guardians, and nothing prevents two applicants for
one person in one year. Index creation is the moment that surfaces. Budget for
reconciliation rather than discovering it during a deploy window.

## 43.4 Migration ordering

Additive first, destructive last, each as its own migration folder so a failure
stops at a known point (Postgres DDL is transactional, so nothing is
half-applied):

```
1. add Person, PersonSensitive, OutboxEvent, AuditLog.eventId    additive
2. add Student, Admission                                        additive
3. numbering rewrite + functional counter index                  mixed
4. Applicant: add columns, convert status enum                   mixed
5. WorkflowHistory polymorphic                                   destructive
6. Enrollment rewrite                                            destructive
7. drop aadhaarNo, photoFileId                                   destructive
8. partial unique indexes + CHECK constraints                    constraint
```

Take a point-in-time backup immediately before migrations 5, 6 and 7. There is no
`migrate down`; the backup **is** the rollback path for a destructive step.

## 43.5 Verification

Every one of these must return zero, or the count stated:

```sql
-- Every Student has a Person, and no Person has two Students in one org
SELECT count(*) FROM "Student" s LEFT JOIN "Person" p ON p.id = s."personId"
  WHERE p.id IS NULL;                                         -- expect 0
SELECT count(*) FROM (SELECT "organizationId","personId" FROM "Student"
  GROUP BY 1,2 HAVING count(*) > 1) x;                        -- expect 0

-- Every Enrollment has a Student and an Admission, and they agree
SELECT count(*) FROM "Enrollment" e JOIN "Admission" a ON a.id = e."admissionId"
  WHERE a."studentId" <> e."studentId" OR a."branchId" <> e."branchId";  -- 0

-- studentCode: unique per org, no blanks, one width
SELECT count(*) FROM (SELECT "organizationId","studentCode" FROM "Student"
  GROUP BY 1,2 HAVING count(*) > 1) x;                        -- expect 0
SELECT count(DISTINCT length("studentCode")) FROM "Student";  -- expect 1

-- One Applicant → at most one Student
SELECT count(*) FROM (SELECT "sourceApplicantId" FROM "Student"
  WHERE "sourceApplicantId" IS NOT NULL
  GROUP BY 1 HAVING count(*) > 1) x;                          -- expect 0

-- Exactly one counter per NEVER-reset config
SELECT count(*) FROM "NumberSequenceCounter" c
  JOIN "NumberSequenceConfig" g ON g.id = c."configId"
  WHERE g."resetStrategy" = 'NEVER'
  GROUP BY c."configId" HAVING count(*) > 1;                  -- expect 0 rows

-- No Aadhaar left in plaintext
SELECT count(*) FROM information_schema.columns
  WHERE column_name ILIKE '%aadhaar%'
    AND table_name IN ('Applicant','Guardian','Student');     -- expect 0

-- Prisma agrees with the database
-- pnpm migrate:verify   → zero drift
```

Migration itself is audited: one `EXECUTE` audit row per migration step with
counts, so "where did these students come from?" has an answer years later.

## 43.6 Rollback

| Step type | Rollback |
| :--- | :--- |
| Additive (1–4) | Roll back the **application only**. Leave the schema; drop the unused objects in a later release. |
| Destructive (5–7) | **Point-in-time restore.** There is no reverse migration and the data is already gone. |
| Constraints (8) | `DROP INDEX` / `DROP CONSTRAINT` — safe and instant |
| Backfill data (Path B) | Every backfilled Student carries `createdVia: MIGRATION`, so a targeted cleanup is possible — but a restore is still preferred |

---

# 44. Configuration Strategy

## 44.1 The boundary test

> **A fact _about_ the thing is a column. A rule about _how the system behaves_
> is configuration.**

`Branch.code` is a fact — a column. "How many days an offer stays open" is a rule
— configuration. Without this test, a configuration engine becomes the place
everything lands, and then every read needs it.

## 44.2 Core invariant versus configurable

| Rule | Core invariant | Configurable | Why |
| :--- | :---: | :---: | :--- |
| Student UUID is v7 and permanent | ✅ | ❌ | Technical identity |
| `studentCode` uniqueness per organization | ✅ | ❌ | Identity invariant. Its *scope* is not a customer choice. |
| **`studentCode` format** (prefix, width) | | ✅ **at provisioning, then frozen** | Genuine institutional variation; §13.6 freezes it after first allocation |
| `studentCode` immutable after assignment | ✅ | ❌ | Every printed artefact depends on it |
| Student is **not** academic-year scoped | ✅ | ❌ | The design's central premise |
| Enrollment **is** academic-year scoped | ✅ | ❌ | Same |
| One Student per Person per organization | ✅ | ❌ | Identity invariant |
| One `ACTIVE` Admission per Student | ✅ | ❌ | A student cannot be admitted twice at once |
| One `PRIMARY` Enrollment per admission per year | ✅ | ❌ | Otherwise "duplicate enrollment" has no meaning |
| Student ≠ User | ✅ | ❌ | |
| No hard delete | ✅ | ❌ | |
| Supersede-never-edit for placement | ✅ | ❌ | Audit integrity |
| **Admission workflow states** | ✅ the 13 states and the transition graph | ✅ **which states an institution uses** | The graph is core semantics; skipping `FEE_PENDING` is policy. A configurable state *graph* is a rules engine — out of scope, §50 Q10. |
| Which transitions require remarks | | ✅ | Institutional rigour differs |
| Offer validity period | | ✅ | |
| Deferment allowed, and seat held during deferment | | ✅ | |
| **Readmission requires a fresh application** | | ✅ `ALWAYS` \| `NEVER` \| `AFTER_GAP_YEARS` | §23.2 |
| Branch transfer approval level | | ✅ default `ORG_ADMIN` | |
| Branch transfer blocked by open workflows | | ✅ default **on** | |
| Academic unit types and hierarchy | | ✅ | `AcademicUnitType` already offers nine values plus `CUSTOM` |
| **Roll number assignment policy** | | ✅ `MANUAL` \| `SEQUENTIAL_ON_ADMISSION` \| `ALPHABETICAL_ON_LOCK` | §50 Q7 |
| Roll numbers immutable after class-list lock | ✅ | ❌ | Otherwise "lock" means nothing |
| Student account auto-provisioning + minimum age | | ✅ | |
| Archive-after-N-years | | ✅ | |
| Primary guardian required below age N | | ✅ | An adult learner may have none |
| Document requirements per `type × program × quota × category` | | ✅ | Institutions run their own admission policy |
| Numbering allocation mode per purpose | ✅ per the §34.3 table | ❌ | Gaplessness is a statutory property, not a preference |

## 44.3 Where configuration lives

The Configuration Engine (F2) with three-tier resolution
**SYSTEM → ORGANIZATION → BRANCH**, most specific wins, falling back to the
registry default. Typed key definitions, not free key/value — a `key TEXT, value
TEXT` table is untyped garbage within a year.

**Policy values are effective-dated.** A branch changing a rule on 1 November
must not retroactively change how an operation raised on 20 October is decided.
So a policy read is `resolve(key, scope, asOf)`, never `resolve(key, scope)`.
`asOf` defaults to now; any operation with a governing date passes that date.

**Long-running jobs bind a config version at start.** A promotion run over 2,000
students that reads config per student can otherwise behave differently for
student 1 and student 2,000 because an admin edited it mid-run.

## 44.4 If F2 has not landed

Student and Enrollment must not block on it, and must not invent a second
configuration mechanism. Interim rule:

> Read every configurable value through a single `StudentConfigProvider`
> interface with hard-coded defaults. When F2 lands, its implementation is
> swapped behind that interface and **no call site changes**.

What is explicitly **not** acceptable: scattering `process.env` reads, adding
settings columns to `Branch`, or hard-coding values inline at their call sites.

---

# 45. Small Institution vs Enterprise Scaling

## 45.1 One architecture, no variants

**There is no `SmallSchoolStudent` and no `LargeSchoolStudent`.** There is no
institution-type branch anywhere in Student or Enrollment code (§28.1). The
difference between a 500-student single-branch school and a 100,000-student
50-branch organization is **data volume and configuration**, not code.

| | Small: 1 branch, 500 students | Large: 50 branches, 100,000+ students |
| :--- | :--- | :--- |
| Schema | Identical | Identical |
| Code paths | Identical | Identical |
| `studentCode` | `STU0000000001`… | `STU0000094218`… — same sequence, same width |
| Numbering counters | 1 org + 1 branch set | 1 org + 50 branch sets — **no cross-branch contention** |
| Context resolution | Auto-resolves (one branch, no ambiguity) | `409 CONTEXT_SELECTION_REQUIRED` prompts a choice |
| Enrollment rows/year | ~500 | ~100,000 |
| Enrollment rows after 12 years | ~6,000 | **~1.2 million** |
| Search | Trivial | Trigram GIN, sub-100 ms |
| Promotion | One synchronous-feeling job | 50 branch jobs, resumable, partial-failure reported |
| Bottleneck | None | The `STUDENT_CODE` counter — one row per organization |

## 45.2 The one shared bottleneck, quantified

`STUDENT_CODE` is organization-scoped, so **every admission in one organization
serialises on one counter row**. Is that acceptable at 100,000 students?

- Allocation is a **single statement** (`INSERT … ON CONFLICT DO UPDATE …
  RETURNING`) in `MONOTONIC` mode, committing in its own short transaction — lock
  hold is sub-millisecond, not the caller's whole transaction.
- Even at a pessimistic 2 ms per allocation, that is ~500 admissions/second.
- A 50-branch organization admitting 20,000 students over a two-week season needs
  roughly **0.02 admissions/second** on average, with a peak burst of perhaps 5.

Three to four orders of magnitude of headroom. This is why `MONOTONIC` exists and
why `studentCode` uses it: a `GAPLESS` `studentCode` would hold the counter for
each caller's entire transaction and turn a non-problem into one.

## 45.3 What scales, and where it breaks

| Concern | Where it starts to matter | Answer |
| :--- | :--- | :--- |
| Enrollment table size | ~5 million rows | Partition by `academicYearId`. The schema is already partition-friendly — every hot query filters on it. |
| Search latency | ~2 million students per org | Revisit only with measurement (§39.1) |
| Bulk promotion duration | ~10,000 students per branch | Already a resumable job; parallelise by academic unit |
| Outbox throughput | ~1,000 events/second | Batch size and poll interval are tunable; the relay is multi-instance safe (`SKIP LOCKED`) |
| `AuditLog` growth | ~50 million rows | Tiered retention (§37.4) and cold archive |
| Report queries across 50 branches | Immediately | Read replica; the model already supports org-wide aggregation because `organizationId` is on every relevant table |

**None of these require changing the Student identity model.** That is the test
this section exists to pass.

---

# 46. Module Dependency Graph

## 46.1 The graph

```
CROSS-CUTTING  (imported by anything; import nothing from business modules)
┌──────────────────────────────────────────────────────────────────────────┐
│  Context · Events(+Outbox) · Audit · Logger · Authorization · Auth       │
│  Configuration(F2) · DataProtection(F1) · Communication                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ (business modules depend downward only)
FOUNDATION
    Organization ──▶ Branch ──▶ AcademicYear
                        └─────▶ Program ──▶ AcademicUnit
                        └─────▶ Numbering (F3)

IDENTITY
    Person ◀────────────────┐
      ▲                     │
      │                  Guardian ─▶ Guardianship
    Student ─────────────────┘
      │  ▲                  Address · Document   (attach to Person/Student)
      │  │
ADMISSION                   ENROLLMENT
    Applicant                  Enrollment
    Workflow                       │
    Admission ─────────────────────┘
      │                            │
      └──────────┬─────────────────┘
                 ▼
        Program · AcademicUnit · AcademicYear

CONSUMERS  (all one-way, inward)
    Attendance · Examination · Fees · Library · Transport · Hostel
    Certificates · Alumni · Reports · Analytics · Parent Portal
                 │
                 └──▶ Student / Enrollment / Admission     ← never the reverse
```

## 46.2 Allowed edges

| From | May import | Must never import |
| :--- | :--- | :--- |
| `identity/person` | numbering, organization, F1 | student, admissions, enrollment |
| `identity/student` | person, numbering, organization | admissions, enrollment, **any consumer**, audit |
| `admissions/applicant` | person, numbering, academic structure | student *(only the workflow orchestrator does)*, enrollment |
| `admissions/workflow` | applicant | student, enrollment |
| `admissions/admission` | student, numbering | enrollment |
| **`admissions` orchestrator (`admit()`)** | person, student, admission, enrollment, numbering | consumers |
| `enrollment` | student, academic structure | **admissions**, consumers |
| any consumer | student, enrollment, admission | — |
| any business module | `EventBus` (abstraction) | `AuditService`, `AuditRepository`, any event adapter |

## 46.3 Forbidden edges, and how each is prevented

| Forbidden | Prevention |
| :--- | :--- |
| `Student → Fees / Attendance / Examination / Library / Transport` | Student has **no relation fields** to any of them. They hold `studentId`; Student holds nothing back. Enforced by a lint rule on imports and reviewed at every PR. |
| `Student → Audit` | Student publishes events; `AuditListener` subscribes. `AuditService` is never injected into a business module. |
| `Student → Communication` | Communication subscribes to `student.created`. Student does not know it exists. |
| `Enrollment → Admissions` | Enrollment holds `admissionId` as a schema FK, not a code import. |
| `Student → Auth` | The link is `UserIdentityLink`, owned by Auth. Student never reads it. |
| `Student → Document` | `photoDocumentId` is a plain `String?` with **no foreign key**, so Student compiles and migrates whether or not S3 exists. |
| `Person → anything role-specific` | Person holds only matching keys (§11.2). |
| Any back edge | A business module importing a consumer fails review. The dependency direction is the invariant, not a preference. |

## 46.4 Cross-module reference matrix — `studentId` or `enrollmentId`?

The decision that determines whether Student can stay stable for ten years.

| Module | `studentId` | `enrollmentId` | `admissionId` | `personId` | Why |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Attendance** | ✅ denormalized | ✅ **primary** | | | Attendance is a fact about a *placement in a year*. `enrollmentId` makes year-scoping automatic and stops Std 9 attendance leaking into Std 10. `studentId` rides along via the composite FK so "this student's attendance" needs no join. |
| **Examination / marks** | ✅ denormalized | ✅ **primary** | | | A result belongs to an academic session and a placement. A student who repeats Std 9 has two enrollments and two independent result sets — impossible to model on `studentId` alone. |
| **Fees — invoice / demand** | | ✅ **primary** | | | The liability arises from a year's placement. Fee structures are branch-and-year scoped. |
| **Fees — receipt / ledger / credit note** | ✅ **primary** | ⚠️ optional | | | Money is paid by and held against the *person's account*, and a credit from 2026 must be usable in 2027. Splitting the ledger by year makes carry-forward impossible. |
| **Library** | ✅ **primary** | | | | Membership and loan history span years. A book borrowed in Std 9 and returned in Std 10 must not straddle two enrollments. |
| **Transport** | ✅ **primary** + `academicYearId` + validity window | ❌ | | | Routes are configured per year, but a student on a superseded enrollment must not lose their bus seat. `studentId` + year + window models the assignment history correctly; `enrollmentId` would break on every correction. |
| **Hostel** | ✅ **primary** + `academicYearId` + validity window | ❌ | | | Same reasoning as transport. |
| **Communication** | ✅ *about whom* | | | ✅ *to whom* | Recipients are Persons (guardians are Persons). Audience **selection** queries Enrollment ("all of Std 9-A"), but the delivery record targets a Person. |
| **Certificates — Transfer Certificate** | | | ✅ **primary** | | A TC certifies a **spell of study** — entry date, exit date, exit reason. That is exactly `Admission`. |
| **Certificates — bonafide, marksheet** | | ✅ **primary** | | | Certifies a placement in a year |
| **Certificates — character certificate** | | | ✅ **primary** | | Covers the whole spell |
| **Alumni** | ✅ **primary** | | ⚠️ for "which spell" | | An alumnus is a person who was a student |
| **Discipline** | ✅ **primary** | ⚠️ context | | | Follows the student across years |
| **Health records** | ✅ **primary** | | | | A student-role fact |
| **Documents** | ✅ or | ✅ or | ✅ or | ✅ | Polymorphic owner, per §26.1 |
| **Reports / analytics** | ✅ | ✅ | ✅ | | Reads everything; **writes nothing** |
| **Parent portal** | ✅ via `Guardianship` | ✅ for the current year | | ✅ | Resolves from the authenticated principal, never from a path parameter |

### The rule that generalises it

> **Store `enrollmentId` when the fact would be wrong if attached to a different
> academic year. Store `studentId` when the fact would be wrong if it disappeared
> at promotion. Store `admissionId` when the fact is about a spell of study.
> Store `personId` when the fact is about the human regardless of role.**

Most academic modules attach to **Enrollment**, and that is what makes
year-scoping automatic rather than something every query has to remember.

### Why Student survives all of it

Every module in that table holds a reference **inward**. Not one of them requires
a column on Student, a relation field on Student, or a change to Student's
lifecycle. Adding Attendance in 2027 and Alumni in 2031 touches Student's schema
**zero times** — which is the property this whole design exists to guarantee.

---

# 47. Implementation Sequence

Derived from the dependency graph in §46, not from preference. Each phase has an
**exit criterion**; a phase is not done because the code compiles.

## PHASE 0 — BLOCKING FOUNDATION WORK ✅ CLOSED (2026-08-09)

> **Status: all twelve items closed and verified.** Implemented on branch
> `feat/phase0-identity-foundation`, migration
> `20260808000000_phase0_foundation`.
>
> **Environment facts established by probing rather than assuming:**
>
> | Question | Answer |
> | :--- | :--- |
> | Postgres version (§50 Q2) | **18.1**. `UNIQUE NULLS NOT DISTINCT` is available, but the functional `COALESCE` index is used anyway so an older managed instance cannot silently break the identifier the ERP is built on. |
> | `pg_trgm`, `btree_gist` | Available, and now **installed by the migration** so a database reached by migrations alone is ready for the Phase 2 trigram indexes. |
> | Existing data (§43.1, §50 Q9) | 1 applicant (`SUBMITTED`), **0 enrollments**, 1 guardian, 3 numbering configs, 2 counters. |
> | Migration path chosen | **Neither A nor B as written.** The data was development-only, but deleting a live developer's rows was not this task's call — so the migration *preserves and backfills* instead. Every conversion is an in-place cast or an add-backfill-tighten sequence, and each aborts rather than coercing a value it cannot map. Cheap here, and it makes the same migration safe for an environment that turns out to hold real rows. |
> | One deletion, deliberate | A `NumberSequenceConfig` with `purpose: "Sample Value"` — created through a Swagger example, exactly the defect the free-string column allowed. It had issued no numbers. Configs with an unmappable purpose *that have counters* abort the migration instead. |
>
> **One blueprint assumption corrected by measurement.** §40.2 assumed raw
> partial and functional indexes might register as drift against the CI gate.
> Tested directly: `prisma migrate diff --from-url` **ignores** both. The
> §40.2 approach is compatible with `pnpm migrate:verify`, which reports zero
> drift on the development and test databases with all eight raw indexes and
> four `CHECK` constraints in place.
>
> **Verification:** 332 unit · 374 integration · 80 e2e, all passing; lint 0
> errors; typecheck and build clean; 11/11 database invariants confirmed by
> raw SQL that bypasses the service layer.



> **Nothing in Phases 1–8 may start until every item here is closed.** These are
> not preparatory niceties. Three of them would corrupt data or leak it across
> tenants the first time `admit()` runs.

| # | Item | Why it blocks | Exit criterion |
| :--- | :--- | :--- | :--- |
| **0.1** | **Numbering: the `NULL`-distinct counter index** (N-1 §6.2) | Every `STUDENT_CODE` allocation creates a fresh counter returning `1`. **Duplicate student codes, indefinitely.** | 1,000 `NEVER`-reset allocations → **exactly one** counter row, values 1…1000  ✅ Functional `COALESCE` unique index. 200 allocations → **one** counter row. |
| **0.2** | **Numbering: replace `create`-in-`try`/`findFirst`-in-`catch`** (N-3) | Aborts the whole transaction the first time a counter does not exist — which is the first `admit()` on any new sequence | Allocation inside a transaction with no pre-existing counter succeeds  ✅ Single `INSERT … ON CONFLICT DO UPDATE`. Allocation inside a transaction with no pre-existing counter succeeds. |
| **0.3** | **Numbering: org scope, allocation modes, enums, transactional allocation** (N-1, N-2, N-4) | `studentCode` per organization is inexpressible; allocation outside the caller's transaction burns numbers | `SequenceScope`, `AllocationMode`, `SequencePurpose`, `ResetStrategy` enums exist; `generateNextNumber` is always called with a `tx`; `ensureNumberConfig` deleted  ✅ `SequenceScope`/`AllocationMode`/`SequencePurpose`/`ResetStrategy` enums; `allocate(params, tx)`; `ensureNumberConfig` deleted. Moved to `src/infrastructure/numbering/`. |
| **0.4** | **BOLA: scope every lookup and every write** in Applicant, Workflow, Enrollment (§8.2) | `admit()` will reuse these exact patterns. Building on them multiplies the defect. | All 7 vectors in §8.2 return `404`; `findUnique({where:{id}})` absent from these modules  ✅ All 7 vectors return 404. `findUnique({where:{id}})` absent from these modules; writes re-assert scope and check the affected count. |
| **0.5** | **`Enrollment` rewrite** — drop `applicantId @unique` and `onDelete: Cascade` (E-1, E-2) | Promotion is impossible and a delete destroys academic history | A student can hold two enrollments; deleting an applicant does not remove an enrollment  ✅ `applicantId` nullable, non-unique, `ON DELETE SET NULL`. `futureStudentId` dropped. |
| **0.6** | **`WorkflowHistory` → polymorphic** | Admission and Enrollment cannot share the audit engine | Existing applicant rows migrated, not stranded  ✅ `(entityType, entityId)` + own scope columns. The existing row migrated, not stranded. |
| **0.7** | **`Applicant.admissionStatus` → enum + 4 new states** (A-1) | A free string permits `"aproved"`; the offer→confirm→admit path does not exist | Raw SQL setting an invalid status is rejected  ✅ 13-state enum. Raw SQL setting `'aproved'` is rejected. |
| **0.8** | **Transactional outbox + `AuditLog.eventId @unique`** (G-3, G-4) | `student.created` is the event every future module builds on. Losing it is unrecoverable. Without `eventId`, a relay retry duplicates audit rows. | Kill the process between commit and publish → the event still arrives; a double relay pass writes one audit row  ✅ `OutboxEvent` with `contextSnapshot`; relay with `FOR UPDATE SKIP LOCKED`; `AuditLog.eventId` unique. |
| **0.9** | **Row locking available** — `SELECT … FOR UPDATE` via `$queryRaw` in a shared helper (G-10) | Prisma has no row-lock API; without it "two admins approve at once" is unprotected | Two concurrent approvals → one succeeds, one `400`  ✅ `RowLockService` — allowlisted tables, scoped `WHERE`, `FOR UPDATE`. |
| **0.10** | **Soft-delete convention decided** (F-4) | Student/Enrollment must not add a third variant to `deletedAt` vs `isDeleted` | Written down; Student and Enrollment use `deletedAt`  ✅ `deletedAt` for Student and Enrollment. The platform-wide `isDeleted` inconsistency stays recorded as separate work. |
| **0.11** | **`pg_trgm` availability confirmed and Postgres version pinned** (§41.5, §50 Q2) | Search design depends on trigram GIN; the counter index form depends on the version | Version recorded in the repository; extension creatable in every environment  ✅ Postgres **18.1**; both extensions created by the migration. |
| **0.12** | **Data-path decision made** (§43.1) | Path A and Path B are different projects | The query in §43.1 has been run and the answer recorded in writing  ✅ Probed, not assumed. Backfilling migration chosen over deletion — see the note above. |

**Not blockers, verified:** execution context (§8.1 — already single-writer and
correct), response contract (§7.4 — canonical, one documented inconsistency
Student simply avoids), migration baseline (F-7 — clean, CI asserts zero drift).

## PHASE 1 — Identity foundation

**Depends on:** Phase 0.
**Build:** `Person`, `PersonMatchDecision`, `PersonMergeLog`; `PersonService`
with `resolve()`, `findCandidates()`, `attachGovernmentId()`; F1's
`IdentityHashService` for the blind index.
**Do not build:** merge execution (§40 keeps it possible; §50 Q8 decides the
two-person rule first).
**Exit:** 20 concurrent `resolve()` for one Aadhaar → exactly one Person, no
unique-violation surfaced. Same Aadhaar in two organizations → two independent
Persons, no linkage discoverable from either side.

## PHASE 2 — Student identity

**Depends on:** Phase 1, Phase 0.3.
**Build:** `Student` model with every constraint in §40; `StudentService`
(read, correct demographics); `studentCode` allocation; search (§39);
`student.*` events; permissions.
**Do not build:** `admit()`, lifecycle transitions, transfer.
**Exit:** a Student can be created **only** through a seeded fixture or the
migration importer — there is no `POST /students`. `studentCode` is unique per
organization and immutable. Search by code, name, mobile and DOB all work with
the §41 indexes. Cross-branch reads return `404`.

## PHASE 3 — Admission model and the state machine

**Depends on:** Phase 2.
**Build:** `Admission` model and constraints; the 13-state applicant machine with
its transition table, row locking, remarks enforcement and scope checks; offer
issue and the expiry job; `Applicant.personId`/`programId` wired to `resolve()`
at submit; `ApplicantProgramPreference`.
**Exit:** every legal transition works and every illegal one is rejected. Two
concurrent approvals → one `400`. Offer expiry runs **through the engine** and
writes a `WorkflowHistory` row. `applicant_one_active` rejects a second live
application.

## PHASE 4 — Enrollment as a module

**Depends on:** Phase 3.
**Build:** `src/modules/enrollment/`; the rewritten model with the composite FK;
the supersede-and-link helper; create, correct, transfer, cancel; roll-number
assignment; the `AcademicUnit` validation in §28.3; the `isLocked` guard.
**Exit:** raw SQL cannot insert an Enrollment whose student or branch disagrees
with its Admission. A correction produces a `SUPERSEDED`/`ACTIVE` pair without
violating partial index #4. A write into a locked year is `403`.

## PHASE 5 — `admit()`

**Depends on:** Phases 1–4. **The keystone.**
**Build:** the single transaction in §31.1, exactly as specified — pre-transaction
validation, row lock, Person resolve, create-or-reuse Student, Admission,
Enrollment, applicant transition to `ADMITTED`, three `WorkflowHistory` rows,
outbox writes.
**Exit:** the acceptance scenarios in §42.5 #1 and the concurrency tests in §42.4
#1–#4 all pass. A failure anywhere inside leaves **zero** rows. 50 concurrent
admissions produce 50 distinct codes with no deadlock.

## PHASE 6 — Lifecycle

**Depends on:** Phase 5.
**Build:** student lifecycle transitions; branch transfer (§20); readmission
(§23); promotion, repeat and reversal (§22); the bulk-promotion job with
progress, partial failure and resumption; roll-number regeneration; archival.
**Exit:** twelve-year journey → 1 Person, 1 Student, 1 Admission, 12 Enrollments,
`studentCode` unchanged, **zero demographic fields duplicated**. Transfer keeps
the code and opens a new `admissionNo`. Readmission creates **no second Student**.
Bulk promotion resumes cleanly after a kill.

## PHASE 7 — Supporting relationships

**Depends on:** Phase 6. Each item is independent and may be parallelised.

| Item | Contract already fixed in |
| :--- | :--- |
| Guardian → `Guardianship` (Person↔Person, org-scoped, the two partial indexes) | §24 |
| Address (`Address` + `PersonAddress`) | §25 |
| Document (`Document`, `DocumentVersion`, `DocumentRequirement`) + the checklist that gives `DOCUMENT_PENDING` meaning | §26 |
| `UserIdentityLink` + optional account provisioning | §27 |
| Configuration engine (F2) behind `StudentConfigProvider` | §44.4 |

**Exit:** a second financial guardian is rejected; a primary handover that fails
mid-operation leaves the original primary intact; `admit()` performs **zero**
guardian re-mapping.

## PHASE 8 — Hardening

**Depends on:** Phase 7.
**Build:** the full §42 suite — every raw-SQL constraint test, all 13 concurrency
tests, all 14 security tests, all 8 failure-mode tests; index verification under
seeded volume; the migration (§43) with its verification queries; the Postman
collection; documentation updates (§9.1 corrections applied to the source
documents).
**Exit:** every gate in §42.8 met; §43.5 returns clean; `pnpm migrate:verify`
reports zero drift.

## 47.1 Sequencing rationale

| Ordering | Why |
| :--- | :--- |
| Numbering before Student | `studentCode` allocation is the first thing Student does, and the current engine would corrupt it |
| BOLA before `admit()` | `admit()` copies the existing lookup patterns; fixing them afterwards means fixing them twice |
| Outbox before Student | `student.created` is the event every future module builds on. Retrofitting durability means replaying events nobody kept. |
| Person before Student | `admit()` step 3 calls `resolve()`; and Person is what makes readmission and the two-branch collision resolvable |
| Enrollment before `admit()` | `admit()` writes an Enrollment; the module must exist and be correct first |
| Lifecycle after `admit()` | Transfer, readmission and promotion all reuse `admit()`'s building blocks |
| Guardian/Address/Document after lifecycle | Their contracts are fixed here (§24–§26) so Student's schema is final either way; they cannot force a Student change |
| Testing last as a **phase**, not as a practice | Each phase ships with its own tests. Phase 8 is the cross-cutting, volume and adversarial work that only makes sense once the whole path exists. |

---

# 48. What NOT To Do

Every item below is either a defect that exists in the repository today, or a
mistake this design is specifically shaped to prevent.

## Identity

```
DO NOT make Student academic-year scoped.
DO NOT put academicYearId on Student. Not even "just for reporting".
DO NOT create a new Student every academic year.
DO NOT create a Student at APPROVED. 5–20% of approvals never join, and each
       would be a permanent ghost in every count, fee run and register.
DO NOT allow one Applicant to produce two Students — and DO NOT rely on the
       service to prevent it. Use the partial unique index (§40.2 #2).
DO NOT make Student = User. No userId on Student, no studentId on User.
DO NOT put currentClass / currentSection / currentAcademicYear /
       currentProgram / currentRollNumber on Student as source-of-truth fields.
DO NOT add a currentEnrollmentId pointer. The academic year in the execution
       context already makes "current" a one-row indexed query (§11.4).
DO NOT move display names, photos, addresses or contact details onto Person.
       Person holds matching keys only.
DO NOT store Aadhaar on Student, Applicant or Guardian.
DO NOT let Student become a document container. One nullable photo reference.
```

## Identifiers

```
DO NOT use studentCode as a foreign key.
DO NOT use studentCode as a primary key.
DO NOT encode the year, branch or organization into studentCode. Every one of
       them becomes false, and B/C/D in §13.2 are rejected for exactly that.
DO NOT change sequencePadding or prefix on a NEVER-reset sequence after the
       first allocation — mixed-width codes break sort order and printed layouts.
DO NOT confuse studentCode with rollNumber, admissionNo, applicationNo or
       admissionFormNo. §14 is the taxonomy.
DO NOT generate roll numbers from the numbering engine.
DO NOT recompute a stored identifier at read time. Changing a format next year
       must never alter an ID card printed this year.
DO NOT expose UUIDs to parent/student portals or third-party integrations.
       UUID v7 leaks its creation timestamp.
```

## Numbering

```
DO NOT create a second numbering engine. Not in Student, not anywhere.
DO NOT generate a student code from an application-level counter, a timestamp,
       a random string, or COUNT(*) + 1.
DO NOT declare @@unique([configId, academicYearId]) and assume it works.
       NULLs are distinct in Postgres; use the functional COALESCE index.
DO NOT use find-then-create for counters. One INSERT … ON CONFLICT statement.
DO NOT catch a unique violation inside a transaction and then query — the
       transaction is already aborted.
DO NOT resolve format placeholders after incrementing the counter.
DO NOT auto-create numbering configs at runtime. A missing config is a
       provisioning failure, and it must fail loudly.
DO NOT add a "generate a number" endpoint or a counter-reset endpoint.
DO NOT make studentCode GAPLESS. Gaps are cosmetic; the serialization is not.
```

## Access and tenancy

```
DO NOT call findUnique({ where: { id } }) in Student, Enrollment, Admission,
       Applicant or Workflow code.
DO NOT perform a resource lookup by UUID without scope validation.
DO NOT return 403 for an out-of-scope resource. Return 404 — a 403 confirms
       it exists.
DO NOT read an unscoped row and then update({ where: { id } }).
DO NOT stamp the caller's context onto a row whose parent belongs elsewhere.
       That is the live cross-branch write in enrollment.service.ts:67–69.
DO NOT trust client-supplied organizationId / branchId / academicYearId in a
       body or a query parameter. They come from the validated context.
DO NOT read x-branch-id or any raw header inside a service.
DO NOT write to request.context. It is Readonly and will not compile.
DO NOT add another context mechanism for Student. The platform's is correct.
DO NOT use @AllowUnresolvedContext() on a Student or Enrollment route.
DO NOT accept a studentId path parameter on a parent or student portal
       endpoint. Resolve the subject from the authenticated principal.
```

## Lifecycle and history

```
DO NOT allow arbitrary status updates. No PATCH accepts a status field.
DO NOT use database deletion as normal lifecycle management.
DO NOT hard-delete a Student, an Admission or an Enrollment. Ever.
DO NOT move archived rows to a shadow table — it breaks every FK and report.
DO NOT hide archived students from search. Archive is a write lock.
DO NOT edit a historical Enrollment. Supersede it and link the pair.
DO NOT implement promotion by mutating the previous Enrollment.
DO NOT implement branch transfer by changing historical Enrollment records or
       by mutating Admission.branchId.
DO NOT reopen a closed Enrollment. Supersede instead — both rows stay visible.
DO NOT allow a correction without a non-blank changeReason.
DO NOT delete the losing row on a Person merge. Leave a tombstone.
DO NOT follow merge chains. Collapse A→B→C to A→C.
```

## Events, audit and transactions

```
DO NOT publish a critical event with eventBus.publish() after a commit and
       hope. Write an outbox row inside the transaction.
DO NOT forget contextSnapshot on the outbox row. The relay runs outside any
       request, so AsyncLocalStorage is empty and every audit row would be
       attributed to nobody.
DO NOT inject AuditService or AuditRepository into a business module.
DO NOT forget to register a new event name in audit.listener.ts —
       an unregistered event bypasses audit silently.
DO NOT define events inside a feature module directory.
DO NOT put actor or tenant identity into an event payload. Context supplies it.
DO NOT emit one event per student in a bulk operation.
DO NOT perform network I/O — SMS, email, HTTP, file upload, virus scan —
       inside a transaction.
DO NOT let Communication failure roll back an admission.
DO NOT pass a tx client to a method that ignores it. NumberingService already
       has the parameter and is currently called without it.
DO NOT rely on findUnique for locking. Prisma has no row-lock API.
```

## Coupling

```
DO NOT let Attendance, Fees, Examination, Library, Transport, Hostel,
       Certificates or Alumni become dependencies of Student.
DO NOT add a relation field on Student pointing at a consumer module.
DO NOT make Enrollment import Admissions.
DO NOT branch on AcademicUnitType, Program.level or Branch.institutionType
       anywhere in Student or Enrollment code.
DO NOT hard-code Class, Section, Standard, Division, Semester, FY/SY/TY.
DO NOT create separate codebases, models or branches for different
       institution sizes or types.
DO NOT hard-code school-specific admission rules. Configuration or nothing.
DO NOT put unrelated business logic into common/.
```

## Scope and process

```
DO NOT introduce Elasticsearch for Student CRUD search.
DO NOT build a seat-capacity check against a seat matrix that does not exist.
       Say it is not happening (§2.2) rather than shipping a fake check.
DO NOT solve platform context problems inside Student services.
DO NOT work around a Phase 0 blocker inside Student. Fix the platform.
DO NOT assume there is no existing data. Run the §43.1 query first.
DO NOT create the partial unique indexes before reconciling existing
       violations — the data may already be invalid.
DO NOT trust documentation over code. §9.1 lists ten places they disagreed.
```

---

# 49. Architecture Invariants

Non-negotiable. Each names its enforcement mechanism, because an invariant
without one is a hope.

## Student

| # | Invariant | Enforced by |
| :--- | :--- | :--- |
| **INV-STU-001** | Student UUID is permanent and never reassigned | No update path exists |
| **INV-STU-002** | Student UUID is UUID v7 | `@default(uuid(7))` |
| **INV-STU-003** | `studentCode` is a separate business identifier from the UUID | Two columns, distinct purposes (§14) |
| **INV-STU-004** | `studentCode` is unique **per organization** | `@@unique([organizationId, studentCode])` |
| **INV-STU-005** | `studentCode` is immutable after assignment, except by the audited `SUPER_ADMIN` break-glass path in §13.4 | No update path; the exception is a dedicated operation |
| **INV-STU-006** | **Student is not academic-year scoped** | No `academicYearId` column. Ever. |
| **INV-STU-007** | Student is organization-scoped and `organizationId` never changes | No update path |
| **INV-STU-008** | One Student per Person per organization | `@@unique([organizationId, personId])` |
| **INV-STU-009** | **One Applicant produces at most one Student** | Partial unique index on `sourceApplicantId` (§40.2 #2) |
| **INV-STU-010** | A Student exists only through `admit()`, readmission or the migration importer | No `POST /students`; `CHECK` on `createdVia`/`sourceApplicantId` |
| **INV-STU-011** | Student is never hard-deleted | No service method, no endpoint |
| **INV-STU-012** | Student holds no academic placement fields | Schema review; §48 |
| **INV-STU-013** | Student identity does not depend on Authentication | No `userId` column; `UserIdentityLink` is owned by Auth |
| **INV-STU-014** | Student does not depend on the Audit implementation | Events only; `AuditService` never injected |
| **INV-STU-015** | Student status changes only through named lifecycle operations | No DTO accepts `status` |
| **INV-STU-016** | `Student.branchId` is a pointer, not identity | No composite FK on it — child rows would break at transfer |
| **INV-STU-017** | Archived students remain searchable and reportable | Flag in place; no shadow table |
| **INV-STU-018** | Student survives every academic-year transition | Enrollment carries the year |

## Enrollment

| # | Invariant | Enforced by |
| :--- | :--- | :--- |
| **INV-ENR-001** | Enrollment **is** academic-year scoped | Required `academicYearId` |
| **INV-ENR-002** | One `PRIMARY` Enrollment per Admission per academic year | Partial unique index (§40.2 #4) |
| **INV-ENR-003** | An Enrollment's student equals its Admission's student | Composite FK (§18.3) |
| **INV-ENR-004** | An Enrollment's branch equals its Admission's branch | Same composite FK |
| **INV-ENR-005** | Historical Enrollments are never edited; a change supersedes | `CHECK` on `SUPERSEDED` requiring successor + reason |
| **INV-ENR-006** | A superseded Enrollment has a non-blank `changeReason` | `CHECK` with `length(trim(...)) > 0` |
| **INV-ENR-007** | Roll number is unique within a class for a year | Partial unique index (§40.2 #5) |
| **INV-ENR-008** | Roll number is immutable after the class list is locked | Service guard + config |
| **INV-ENR-009** | No Enrollment without an Admission; no Admission without a Student | Required FKs |
| **INV-ENR-010** | `Enrollment.academicYearId` = `AcademicUnit.academicYearId` | Composite FK once `AcademicUnit @@unique([id, academicYearId])` exists; service-enforced until then |
| **INV-ENR-011** | No Enrollment write into a locked academic year | Service guard on `isLocked` |
| **INV-ENR-012** | Enrollment carries no demographic field | Schema review |
| **INV-ENR-013** | `resultOutcome` is written only by Examination | Module boundary |
| **INV-ENR-014** | Enrollment is never hard-deleted | Cancel or supersede |

## Admission

| # | Invariant | Enforced by |
| :--- | :--- | :--- |
| **INV-ADM-001** | `Admission.branchId` is immutable | No update path; the composite FK depends on it |
| **INV-ADM-002** | One `ACTIVE` Admission per Student | Partial unique index (§40.2 #3) |
| **INV-ADM-003** | `admissionNo` is unique per branch | `@@unique([branchId, admissionNo])` |
| **INV-ADM-004** | A closed Admission has an exit date and reason | `CHECK` |
| **INV-ADM-005** | An Admission never spans branches | INV-ADM-001 + the composite FK |
| **INV-ADM-006** | A branch transfer closes one Admission and opens another | §20.2 |
| **INV-ADM-007** | Cancelling an application and cancelling an admission are different states | Separate enums on separate models |

## Applicant and workflow

| # | Invariant | Enforced by |
| :--- | :--- | :--- |
| **INV-APP-001** | `admissionStatus` is an enum | Prisma enum + database type |
| **INV-APP-002** | Status changes only through the workflow engine, including for `SUPER_ADMIN` | No direct write path |
| **INV-APP-003** | One active application per person per branch per year | Partial unique index (§40.2 #1) |
| **INV-APP-004** | `personId` is present from `SUBMITTED` onward | `CHECK` |
| **INV-APP-005** | Every transition writes a `WorkflowHistory` row | Inside the transaction |
| **INV-APP-006** | `ADMITTED` is terminal and is the only state `admit()` produces | Transition table |
| **INV-APP-007** | Only `SEAT_CONFIRMED` is admissible | `admit()` guard + row lock |
| **INV-APP-008** | The applicant's demographics are a frozen snapshot | Student carries its own copy |

## Numbering

| # | Invariant | Enforced by |
| :--- | :--- | :--- |
| **INV-NUM-001** | One config per purpose per scope | Two partial unique indexes |
| **INV-NUM-002** | One counter per config per year, **including when the year is null** | Functional `COALESCE` unique index |
| **INV-NUM-003** | `branchId` present exactly when scope is `BRANCH` | `CHECK` |
| **INV-NUM-004** | **The generated value is unique at its destination** | The destination table's own constraint. **The engine is not trusted.** |
| **INV-NUM-005** | `currentValue` never decreases | No decrement path, no reset endpoint |
| **INV-NUM-006** | A format contains `{sequence}` | Validated at config create/update |
| **INV-NUM-007** | Numbers are never reused, not after rollback or void | Design rule |
| **INV-NUM-008** | Prefix and padding are immutable on `NEVER`-reset sequences | API rejection (§13.6) |
| **INV-NUM-009** | Allocation never happens outside a business operation about to persist the result | No generate endpoint |

## Security and tenancy

| # | Invariant | Enforced by |
| :--- | :--- | :--- |
| **INV-SEC-001** | Every Student/Enrollment access respects the execution scope | `organizationId` + branch scope in every `WHERE` |
| **INV-SEC-002** | An out-of-scope resource returns `404`, never `403` | Service convention + tests |
| **INV-SEC-003** | Writes re-assert scope in the `WHERE`, not just in a prior read | `updateMany` + count assertion |
| **INV-SEC-004** | A write's scope columns come from the resource's lineage, never from the request context | §29.1 |
| **INV-SEC-005** | No service reads a raw scope header | Code review + grep |
| **INV-SEC-006** | The request context is immutable to consumers | `Readonly` type — fails to compile |
| **INV-SEC-007** | Aadhaar never appears in a list or bulk response | F1 D7 |
| **INV-SEC-008** | Bulk export is separately permissioned and separately audited | `student.export` + `student.exported` |
| **INV-SEC-009** | Portal endpoints resolve the subject from the principal, never from a path | §38.6 |

## Events and transactions

| # | Invariant | Enforced by |
| :--- | :--- | :--- |
| **INV-EVT-001** | Events describing committed data are written to the outbox **inside** the transaction | §36 |
| **INV-EVT-002** | The outbox row carries a `contextSnapshot` | Schema `NOT NULL` |
| **INV-EVT-003** | Delivery is at-least-once; consumers deduplicate on `eventId` | `AuditLog.eventId @unique` |
| **INV-EVT-004** | Business modules publish through the `EventBus` abstraction only | No adapter import |
| **INV-EVT-005** | Every event name is registered in `audit.listener.ts` | Coverage test |
| **INV-EVT-006** | No network I/O inside a transaction | Code review |
| **INV-EVT-007** | `admit()` is one transaction — Student, Admission, Enrollment, applicant transition, history, outbox | §31.1 |
| **INV-EVT-008** | A cross-module call inside a transaction passes the `tx` client | Signature convention |

---

# 50. Open Questions

Must be resolved before the phase they block. An assumption recorded here is
cheap; an assumption made silently in code is not.

| # | Question | Blocks | Options and recommendation |
| :--- | :--- | :--- | :--- |
| **Q1** | **What triggers a new Admission when a student moves school → junior college inside one branch?** | Phase 6 — `admit()` vs `promote()` at the boundary | An earlier design said "when `Program.level` changes", but `ProgramLevel` is **nullable** with only three values (`SCHOOL`, `COLLEGE`, `DEGREE`), so it cannot carry the rule. (a) branch change is the *only* trigger, and Std 10→11 stays one Admission; (b) an explicit `Program.requiresNewAdmission` flag set per institution; (c) an operator choice at promotion time. **Recommendation: (b)** — institutions genuinely differ, and a flag is honest where a derived rule is not. |
| **Q2** | **Which Postgres version is targeted?** | **Phase 0.11** | Nothing pins it — no `docker-compose`, and `migration_lock.toml` records only the provider. On 15+, `UNIQUE NULLS NOT DISTINCT` is clearer than the functional `COALESCE` index. The spec uses the functional index because it works everywhere, but a version assumption living only in someone's head is a deployment surprise. **Pin it in the repository.** |
| **Q3** | **Is seat capacity in scope, and where does it live?** | Phase 5 — the "validate capacity" step | `AcademicUnit` has **no capacity column**, so no capacity check is possible today. (a) omit it, as §2.2 does, and add it later; (b) add `AcademicUnit.capacity Int?` now and a soft warning; (c) build a full seat matrix with quota-wise allocation. **Recommendation: (a) for this build, (b) next** — capacity is a fact about the unit, so it is a column, not configuration. A seat matrix is its own module. |
| **Q4** | **Should Program become organization-scoped, or gain an org-level template?** | Cross-branch reporting; branch transfer fidelity (§20.4, F-1) | `Program`, `AcademicYear` and `AcademicUnit` are all branch-scoped with no `organizationId`, so "the same programme" at two branches is two UUIDs and cross-branch grouping must use names. (a) accept it and group by name in reports; (b) add an org-level `ProgramTemplate` that branch programs instantiate; (c) make `Program` org-scoped and branch-linked. **Recommendation: (b)**, as academic-structure work **after** this build. It does not block Student, and (c) is a large migration. |
| **Q5** | **`Branch.code` is globally unique across all tenants.** Intended? | Multi-tenant onboarding | Two organizations cannot both have a branch coded `MAIN`, which will surface at the second customer. **Recommendation: change to `@@unique([organizationId, code])`.** Small migration, real defect. Does not block Student. |
| **Q6** | **`User.phone` is globally unique.** Families share numbers. | Parent portal (Phase 7) | Two guardians in one household cannot both have accounts. §14 Q7 of the frozen decisions explicitly notes a mobile cannot be globally unique across users. **Recommendation: relax to unique per role or per organization, with verification required.** An Auth-module change; recorded here because the portal will hit it immediately. |
| **Q7** | **Who assigns roll numbers, and when?** | Phase 4 | Manual, sequential on admission, or alphabetical regeneration once the class list settles (common Indian practice). Alphabetical regeneration means roll numbers **change** after admission. **Recommendation: configurable per branch, defaulting to `ALPHABETICAL_ON_LOCK`**, mutable until lock and immutable after. |
| **Q8** | **What happens to attendance and marks already recorded against a superseded Enrollment?** | Blocks **Attendance (O1)**, not this build — but the answer must exist before Attendance is designed | (a) history stays with the old enrollment; only future records attach to the new one; (b) migrate records to the new enrollment; (c) forbid corrections after a configurable cut-off. **Recommendation: (a) plus (c)** — keep history where it happened, and stop late corrections once results are frozen. |
| **Q9** | **Path A or Path B, and if B, how is `programId` backfilled?** | **Phase 0.12** | Program lives only on Enrollment today, so an applicant who never enrolled has no program. (a) nullable for legacy rows — honest, but then the constraint is not a real invariant; (b) operator assignment before migrating; (c) **delete existing applicants and start clean**. **Recommendation: (c) if and only if §43.1 confirms development-only data**, in writing. |
| **Q10** | **Are the 13 admission states themselves configurable?** | Phase 3 | Institutions differ on whether they use `WAITLISTED`, `FEE_PENDING` or `DEFERRED`. (a) all 13 exist; configuration selects which are *reachable*; (b) a configurable state graph. **Recommendation: (a)** — a configurable graph is a rules engine, and a rules engine whose output is the admission lifecycle is a much larger commitment than it looks. |
| **Q11** | **Does a Person merge need a second approver?** | Phase 1 (design), merge execution (deferred) | Merge is irreversible and moves an entire academic history. A two-person rule is standard at that blast radius but doubles friction for what is usually an obvious data-entry fix. **Recommendation: single-actor for v1**, with the mandatory reason and full `PersonMergeLog` as the control. |
| **Q12** | **What is the minimum signal for a MEDIUM Person match?** | Phase 1 tuning | Currently `phoneHash + dob`. One household mobile serves every child, so in a 1,000-student school this may fire on every sibling admission and become noise staff learn to dismiss. **Recommendation: ship as specified, instrument the false-positive rate, tune with real data** — and accept that shipping a knowingly-noisy heuristic is the trade being made. |

---

# 51. Final Architecture Decision Record

## 51.1 Confidence legend

| | Meaning |
| :--- | :--- |
| **DECIDED** | User-approved or frozen. Not re-opened by this document. |
| **RECOMMENDED** | This document's judgement, with reasoning. Change it deliberately, not by drift. |
| **REQUIRES R&D** | Needs measurement or investigation before committing |
| **BLOCKED** | Cannot proceed until a named prerequisite closes |

## 51.2 The record

| # | Decision | Final choice | Confidence | Reason |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Student identity | A permanent, organization-scoped learner identity, separate from Person, Applicant, Admission, Enrollment and User | **DECIDED** | User requirement; the four-layer model is the only shape that survives promotion, transfer and readmission |
| 2 | Student UUID | UUID v7, `@default(uuid(7))`, immutable | **DECIDED** | User requirement; matches every existing model |
| 3 | Student Code format | `STU` + fixed-width digits; prefix and width configurable **at provisioning, then frozen**; nothing volatile encoded | **RECOMMENDED** | §13.2 — B, C and D each encode something that becomes false |
| 4 | Student Code scope | Unique per **organization** | **RECOMMENDED** (corrects frozen §3 Q13/Q15) | A global sequence leaks tenant volume through gaps and serialises creation platform-wide |
| 5 | Student Code mutable | **No** — one audited `SUPER_ADMIN` break-glass correction, before any certificate or receipt | **DECIDED** + **RECOMMENDED** narrowing | Permanence is the requirement; a provisioning typo still needs a fix |
| 6 | Student Code as FK | **Never** | **DECIDED** | It has a correction path; correctable values must not be pointed at |
| 7 | Student academic-year scoped | **No** | **DECIDED** | The central premise |
| 8 | Enrollment academic-year scoped | **Yes** | **DECIDED** | |
| 9 | Student = User | **No.** `UserIdentityLink`, owned by Auth | **DECIDED** | One human, many roles; identity must not depend on login |
| 10 | Applicant → Student | **1:1**, enforced by a partial unique index on `sourceApplicantId` | **DECIDED** (rule) + **RECOMMENDED** (mechanism) | The rule was stated; no spec proposed a constraint (G-1) |
| 11 | When Student is created | At joining, inside `admit()`, on `SEAT_CONFIRMED → ADMITTED` | **DECIDED** | An approval that never joins must not become a ghost |
| 12 | Student + Admission + first Enrollment | **One transaction** | **DECIDED** | Partial student creation is unrecoverable in practice |
| 13 | Person abstraction | **Yes** — thin, org-scoped, matching keys only | **RECOMMENDED** | Solves the two-branch collision, readmission, siblings and guardian-as-student with one table (§11.2) |
| 14 | Admission layer | **Yes**, between Student and Enrollment | **RECOMMENDED** | Nowhere else can hold a spell of study, which is what a TC certifies |
| 15 | Enrollment module placement | **Own top-level module**, not under `admissions/` | **RECOMMENDED** | A twelve-year concern must not hang off a three-month one |
| 16 | Promotion | New Enrollment; old row → `PROMOTED`, never edited | **DECIDED** | |
| 17 | Branch transfer | Close Admission #1, open #2 with a new `admissionNo`; move `Student.branchId`; **`studentCode` unchanged** | **DECIDED** | |
| 18 | Organization transfer | **Not a workflow.** New Student, new code in the target org; source history retained; `StudentExternalRef` records provenance | **RECOMMENDED** | Person, code and the entire academic structure are tenant-scoped (§21.1) |
| 19 | Readmission | Existing Student + new Admission; a fresh application is **configurable** | **DECIDED** (shape) + **RECOMMENDED** (config) | Institutions genuinely differ |
| 20 | Deletion | Archive and terminal lifecycle statuses. **No hard delete anywhere.** | **DECIDED** | |
| 21 | Personal-data erasure | Crypto-erasure of sensitive fields; the row and the academic record survive | **RECOMMENDED** | DPDP Act 2023 against a user base of children |
| 22 | Numbering | **One** central engine, rewritten. No second generator. | **DECIDED** | |
| 23 | Allocation modes | `MONOTONIC` (identity, gaps fine) and `GAPLESS` (financial/statutory) | **RECOMMENDED** | Resolves C-7 — both halves of the numbering review were right |
| 24 | Roll number | Owned by **Enrollment**, not numbering; mutable until class-list lock | **RECOMMENDED** | It is a position in a list, regenerated alphabetically, not a sequence |
| 25 | Events | Domain events through `EventBus`; the catalogue in §35 | **DECIDED** (architecture exists) | |
| 26 | Outbox | **Transactional outbox behind the `EventBus` abstraction** | **RECOMMENDED** | Losing `student.created` is unrecoverable; placing it behind the abstraction means **zero** consumer changes |
| 27 | Audit | Event-driven only; business modules never import audit | **DECIDED** (architecture exists) | |
| 28 | `AuditLog.eventId` unique | **Add it** | **RECOMMENDED** | At-least-once delivery duplicates audit rows without it (G-4) |
| 29 | Search | **PostgreSQL** — btree, `text_pattern_ops`, trigram GIN. No Elasticsearch. | **RECOMMENDED** | Sufficient to ~2M students/org; revisit only on measurement |
| 30 | Cross-branch code search | Empty result by default; reduced projection with `student.view.organization` | **RECOMMENDED** | `403` is an enumeration oracle; full disclosure breaks isolation |
| 31 | Downstream reference | `enrollmentId` for year-scoped facts, `studentId` for person-scoped, `admissionId` for spell-scoped, `personId` for human-scoped — matrix in §46.4 | **RECOMMENDED** | The rule that keeps Student unchanged as modules are added |
| 32 | Concurrency on `admit()` | Explicit `SELECT … FOR UPDATE` via `$queryRaw` + state re-check + unique constraints | **RECOMMENDED** | Prisma has no row-lock API; without it, concurrent approval is unprotected (G-10) |
| 33 | Idempotency | State guard + row lock + unique constraint; duplicates answered with an **informative `409`**. No idempotency-key table in this build. | **RECOMMENDED** | Needs no new infrastructure and gives the client everything it needs to proceed |
| 34 | Isolation level | `READ COMMITTED` | **RECOMMENDED** | Every invariant has an explicit lock or constraint; `SERIALIZABLE` would add retries for no gain |
| 35 | Denormalized current placement | **None on Student.** The context's academic year makes it a one-row indexed query. | **RECOMMENDED** | A stored pointer is five maintenance points and one stale-data bug |
| 36 | Soft-delete convention | `deletedAt` for Student and Enrollment; the platform-wide `isDeleted` inconsistency recorded as separate work | **RECOMMENDED** | Do not add a third variant |
| 37 | Seat capacity | **Out of scope.** No capacity column exists. | **RECOMMENDED** | A fake check is worse than a stated absence (§50 Q3) |
| 38 | Configuration | F2 three-tier, effective-dated; interim `StudentConfigProvider` with defaults | **RECOMMENDED** | Student must not block on F2 and must not invent a second mechanism |
| 39 | Small vs large institution | **One architecture.** Configuration and data volume only. | **DECIDED** | |
| 40 | Execution context | Consume the platform's. **Not a blocker** — already single-writer and correct. | **DECIDED** (verified) | Corrects the brief's assumption (C-6) |
| 41 | Response contract | The canonical envelope. Student introduces none. | **DECIDED** | |
| 42 | Merge (Student/Person) | Designed for, **not built**. Tombstone + repoint + log (§19.3). | **RECOMMENDED** | Architecture must not preclude it; building it now is speculative |
| 43 | Migration path | Path A (clean slate) if §43.1 confirms dev-only data; otherwise Path B | **BLOCKED** on §50 Q9 | Do not assume there is no data |
| 44 | Postgres version | Pin it | **BLOCKED** on §50 Q2 | Determines the counter index form and `pg_trgm` availability |

## 51.3 Self-audit against the quality gate

| Question | Answer |
| :--- | :--- |
| Could a developer following this create a Student model impossible to evolve? | **No.** Student holds identity and current demographics only. Every consumer references inward (§46.4). Adding Attendance in 2027 or Alumni in 2031 touches Student's schema zero times. |
| Could any future module force a change to Student identity? | **No.** §46.4 assigns every module a reference target; none needs a column on Student. |
| Can a student pass ten academic years as one identity? | **Yes.** 1 Person, 1 Student, 1 Admission, 10 Enrollments, zero demographic fields copied (§18.4). |
| Can `studentCode` stay stable while placement changes? | **Yes.** It encodes nothing volatile (§13.2) and §13.4 enumerates every event that does not change it. |
| Can two admins simultaneously approve one applicant without duplicating a Student? | **Yes** — row lock + state re-check + three unique constraints (§33.1). **Not today**: `workflow.service.ts:62` takes no lock, which is Phase 0.9. |
| Can one branch reach another's student by guessing a UUID? | **Not under this design** — scope in every `WHERE`, `404` on miss. **Yes today**, across seven vectors (§8.2), which is Phase 0.4. |
| Can an institution customise the admission workflow and code format without forking? | **Partly, and the limit is stated.** Code prefix/width, offer validity, deferment, readmission policy, roll-number policy, document requirements and which states are reachable are all configuration. The 13-state *graph* is not (§50 Q10) — a configurable state graph is a rules engine, and that is a deliberate, recorded refusal rather than an oversight. |
| Small school today, 50 branches later, without changing Student identity? | **Yes.** Identical schema and code paths; the only shared bottleneck has three to four orders of magnitude of headroom (§45.2). |
| Can duplicate Students occur? | **Not through `admit()`** — `@@unique([organizationId, personId])` plus the applicant index. **Possible only** where two Persons exist for one human with no shared Aadhaar; that is what merge (§42, deferred) resolves, and the architecture keeps it possible. |
| Can Student identity survive 20 years? | **Yes.** No year scope, no branch in the identifier, no dependency on an authentication account, no hard delete, and archival keeps the row searchable. |
| Can previous academic-year records leak? | **No.** Every year-scoped read filters on `academicYearId`; Student search is deliberately *not* year-filtered because Student is not year-scoped (§39.3). |
| Can UUID enumeration expose data? | **No.** Guessing a valid UUID outside the caller's scope yields `404`. |

---

## Appendix A — Document control

| | |
| :--- | :--- |
| **Canonical location** | `backend/docs/planning/student-admission-enrollment-architecture.md` |
| **Supersedes on conflict** | The ten conflicts in §9.1, each named with its resolution |
| **Does not supersede** | F1, F2, F3, I1, I2, I3+I4+I5, S1, S2, S3 — this document consolidates and sequences them; they remain the detailed module specs |
| **Must be updated when** | Any §50 question is answered · any §51 decision changes · Phase 0 items close · a new consumer module is added to §46.4 |
| **Review trigger** | Before each phase begins, and whenever a module spec is edited in a way that touches §9.1 |

## Appendix B — Corrections to apply to the source documents

Recorded so the reconciliation in §9.1 does not have to be rediscovered:

| Document | Correction |
| :--- | :--- |
| `01-identity-core/03-05-admission-student-enrollment.md` §6.1 step 7 | `admit()` transitions to **`ADMITTED`**, not "`APPROVED` (terminal)" |
| `01-identity-core/02-applicant.md` §3.3 | Thirteen states, not twelve |
| `01-identity-core/03-05-…md` §3.1 | Add the partial unique index on `sourceApplicantId` (G-1) |
| `00-foundation/03-numbering.md` §3.1/§7 | `prefix` and `sequencePadding` are immutable on `NEVER`-reset sequences (G-5) |
| `admissions/admissions-production-audit.md` §7 | Numbering is not transaction-safe, and it generates neither roll numbers nor student ids (C-3) |
| `admissions/admissions-production-audit.md` §8 | The middleware no longer reads scope headers (C-5) |
| `admissions/security-review.md` §3B | The BOLA finding covers reads only; §8.2 here lists seven vectors including a cross-branch **write** (G-2) |
| `admissions/numbering-review.md` §2A | The `try`/`catch` race handler is **not** an acceptable fallback inside a transaction (C-9) |
| `core/audit.md` | `student.*` events are allowlisted but have **no producer**; `student.deleted` should be removed — there is no delete (C-4) |
| `planning/README.md` | Add this document to the status table |
