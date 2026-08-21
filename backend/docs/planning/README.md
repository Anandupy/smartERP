# CampusFlow — Module Planning

**Specification, not exploration.** Every document here is meant to be
implementable without re-deriving decisions. If a question is still open it goes
in that document's *Open questions* section, never into an assumption.

## How to use this folder

**If you are implementing a module:** read `00-foundation/` in full first — those
rules apply to every module — then read that module's document. Do not begin a
module whose *Open questions* section is non-empty; raise them instead.

**If you are planning a module:** copy [`_TEMPLATE.md`](_TEMPLATE.md), fill all
eleven sections, and update the status table below. A module is `planned` only
when every section is filled and *Open questions* is empty.

**Ground rules that apply everywhere:**

- Planning happens before code. An approved plan is not authorisation to build —
  implementation is a separate, explicit instruction.
- Prisma models are edited in `prisma/modules/**/*.prisma`, never in
  `prisma/schema.prisma` (see [`../prisma-guide.md`](../prisma-guide.md)).
- Every decision records *why*. A decision without reasoning gets re-litigated.

## The build blueprint

Before implementing anything in the Admission → Enrollment → Student path, read
[`student-admission-enrollment-architecture.md`](student-admission-enrollment-architecture.md).

It is not another module spec. It consolidates **F3, I1, I2, I3+I4+I5** and their
supporting modules into one dependency-ordered plan, verifies each against the
actual repository, and records the ten places where the specs and the code
disagree (§9.1). It also defines **Phase 0 — blocking foundation work**: four
defects in existing code that would corrupt `studentCode` or leak data across
tenants the first time `admit()` runs. Where it and a module spec conflict, it
states which is correct and why; Appendix B lists the corrections to fold back
into the specs.

## The operational reference

Once Phases 0–5.5 landed, the blueprint became a *plan that has been carried
out*. What it does not do is describe the system that now exists as one
lifecycle.

[`core-admission-lifecycle-specification.md`](core-admission-lifecycle-specification.md)
does. It is the **single operational reference for the complete
Person → Applicant → Guardian → Workflow → Admission → Student → Enrollment
lifecycle**: every field with its owner and its rule, every workflow edge, every
constraint, every error code, every event, the ID survival map, the field
ownership matrix, a form-stage reference detailed enough to build a frontend
from, and thirty-six edge cases with their expected business result.

It is a **reconciliation, not a redesign**. Every statement carries a status —
`IMPLEMENTED` · `VERIFIED` · `DECIDED` · `RECOMMENDED` · `PROPOSED` ·
`DEFERRED` · `REQUIRES BUSINESS DECISION` · `REQUIRES R&D` — and where a spec
and the code disagree, both are stated and one is named correct rather than one
being quietly corrected.

**Its verdict is `NOT READY TO FREEZE`, narrowly and on one axis.** The
Person/Student/Admission/Enrollment core is sound and verified end to end. The
**guardian boundary is not**: the architecture states in three places that
guardianship is a Person↔Person relationship and that this is *why* `admit()`
need do nothing about guardians — and it is not implemented that way. `Guardian`
is a branch-scoped table holding its own plaintext Aadhaar and address, linked
to `Applicant`, so **a student admitted today has no guardian**, and a migrated
student can never have one. Alongside that sit three further defects: a
non-transactional primary-guardian toggle that can leave a child with *no*
primary guardian, absent financial-guardian exclusivity, and **no tenant scoping
or permission on any guardian route** — which today returns a full plaintext
government identifier cross-tenant.

Read §8, §46 and §47 first if you are picking up that work; §33 if you are
building the frontend; §41 if you are building a module on top.

## Core domain freeze

[`core-domain-freeze-v1-audit.md`](core-domain-freeze-v1-audit.md) (2026-08-15)
is the final hardening/freeze audit of the whole
Person → Applicant → Guardian → Address → Documents → Admission Workflow →
Student → Admission → Enrollment core. **Verdict: READY TO FREEZE** — zero
BLOCKING defects found; every previously-known carry-forward item was
re-verified against current code (one, Applicant master-reference
validation, turned out already closed and was removed from the open list);
Fees/roll-number/capacity compatibility all PASS. No code changed as part of
this audit — see the document for the full carry-forward classification.

## Status

| # | Module | Status | Document |
| :--- | :--- | :--- | :--- |
| **★** | **Admission → Enrollment → Student — build blueprint** | `planned` ⚠️ 12 open questions, 12 Phase-0 blockers | [`student-admission-enrollment-architecture.md`](student-admission-enrollment-architecture.md) |
| **★★** | **Core admission lifecycle — operational reference** | `reconciled` ✅ guardian blockers closed 2026-08-16 (§8.7) — `BILLING` address resolution and Guardian→Person backfill for pre-existing rows remain `DEFERRED` | [`core-admission-lifecycle-specification.md`](core-admission-lifecycle-specification.md) |
| **P0** | Foundation blockers *(numbering, BOLA, outbox, row locks)* | `implemented` ✅ 2026-08-09 | blueprint §47 Phase 0 |
| **P1** | Identity foundation — Person, crypto, blind index | `implemented` ✅ 2026-08-09 ⚠️ recovery custody ceremony outstanding | [`../core/key-custody.md`](../core/key-custody.md) |
| **P2** | Student identity | `implemented` ✅ 2026-08-10 | blueprint §11, §13, §39, §41 |
| **P3** | Admission domain & applicant state machine | `implemented` ✅ 2026-08-11 ⚠️ 2 CHECK constraints `NOT VALID` pending one legacy row | blueprint §15–§17, §31, §33, §40 |
| **P4** | Enrollment — academic placement | `implemented` ✅ 2026-08-12 ⚠️ class-list lock derives from the year until F2 | blueprint §18, §28, §40, §41 |
| **P5** | `admit()` — applicant → student conversion | `implemented` ✅ 2026-08-13 ⚠️ an existing Student is refused, not readmitted | blueprint §31.1, §33, §35, §38 |
| **P5.5** | Pipeline verification & hardening | `verified` ✅ 2026-08-13 ⚠️ 2 carry-forward items | this document, *Pipeline verification* |
| **F1** | Data protection & key custody | `planned` ⚠️ 1 legal question + backup-retention prerequisite | [`00-foundation/01-data-protection.md`](00-foundation/01-data-protection.md) |
| **F2** | Configuration engine | `planned` ⚠️ 2 open questions | [`00-foundation/02-configuration.md`](00-foundation/02-configuration.md) |
| **F3** | Numbering & identity engine | `planned` ⚠️ 2 open questions | [`00-foundation/03-numbering.md`](00-foundation/03-numbering.md) |
| — | Cross-cutting principles | `not started` | `00-foundation/00-principles.md` |
| **I1** | Person | `planned` ⚠️ 2 open questions | [`01-identity-core/01-person.md`](01-identity-core/01-person.md) |
| **I2** | Applicant *(exists — needs changes)* | `planned` ⚠️ 2 open questions | [`01-identity-core/02-applicant.md`](01-identity-core/02-applicant.md) |
| **I3+I4+I5** | Admission, Student, Enrollment *(one unit)* | `planned` ⚠️ 3 open questions | [`01-identity-core/03-05-admission-student-enrollment.md`](01-identity-core/03-05-admission-student-enrollment.md) |
| **S1** | Guardian & family | `implemented` ✅ 2026-08-16 — `Guardian.personId` (nullable) + `Guardianship`, Defects 1/2/4/5/6 fixed; DOB backfill for pre-existing Guardian rows and `BILLING` financial-guardian resolution `DEFERRED`, see the reference §8.7 | [`02-guardian-family/01-guardian.md`](02-guardian-family/01-guardian.md) |
| **S2** | Address | `implemented` ✅ 2026-08-15 — `Address` + `PersonAddress`, no `Household` (§9.2 DECIDED); see the reference §10 | [`03-address/01-address.md`](03-address/01-address.md) |
| **S3** | Document | `implemented` ✅ 2026-08-17 — foundation only: `DocumentType`/`DocumentRequirement`/`Document`/`DocumentVersion`, storage+scan ports, `DOCUMENT_CHECKLIST_SATISFIED` wired for real. Real virus scanning, cloud storage and direct parent upload `DEFERRED`, see the spec. Re-verified 2026-08-21 against numbering, Postman and the Applicant document workflow — no functional gaps; `DocumentRequirement` now rejects an exact duplicate (same type/branch/program/quota/category/stage) the same way `DocumentType` already did | [`document-management-specification.md`](document-management-specification.md) |
| **S4** | Employee / staff | `planned` ⚠️ 3 open questions | [`05-employee/01-employee.md`](05-employee/01-employee.md) |
| **A1** | Program & academic unit *(exists)* | `not started` | `06-academic-structure/` |
| **A2** | Academic year & calendar *(exists, calendar missing)* | `not started` | `06-academic-structure/` |
| **A3** | Subject & curriculum | `planned` ⚠️ 3 open questions | [`06-academic-structure/03-subject-curriculum.md`](06-academic-structure/03-subject-curriculum.md) |
| **A4** | Timetable | `not started` | `07-timetable/` |
| **A5** | Promotion rules | `not started` | `06-academic-structure/` |
| **O1** | Attendance | `not started` | `08-attendance/` |
| **O2** | Examination & results | `not started` | `09-examination/` |
| **O3** | Finance | `not started` | `10-finance/` |
| **O4** | Certificates & TC | `not started` | `11-certificates/` |
| **O5** | Library / transport / hostel | `not started` | `12-operational/` |
| **P1** | Government reporting | `not started` | `13-gov-reporting/` |
| **P2** | Migration & tenant onboarding | `not started` | `14-migration/` |
| **P3** | Bulk jobs & concurrency | `not started` | `15-jobs/` |
| **P4** | Reporting & analytics | `not started` | `16-analytics/` |
| **P5** | Deployment, backup, key-recovery runbook | `not started` ⚠️ **blocks F1** | `17-platform/` |

Statuses: `not started` → `in discussion` → `planned` → `implemented`

## Already built — not re-planned here

Auth, authorization, communication, workspace, maintenance, system settings, and
the admissions masters (Religion, Caste, Category, Gender, BloodGroup, Language,
Disability, RelationType, **Quota**, **AdmissionSource**). See
[`../modules/`](../modules/) and [`../core/`](../core/) for their documentation.

## Planning order

Dependency-ordered, not preference-ordered:

1. **F1 — Data protection** — decides the shape of Person and every identifier column
2. **I1 — Person**
3. **I3 + I4 + I5 — Admission, Student, Enrollment as ONE unit**
4. **I2 — Applicant** — the delta against what exists today
5. **F3 — Numbering** — only once its outputs are known
6. **F2 — Configuration**
7. Supporting → academic → operational → platform

> **Why Admission, Student and Enrollment are one unit.** Chronologically a
> person becomes a student at the *end* of the admission funnel. Structurally it
> is the reverse: Enrollment references Admission, which references Student. All
> three are written in a single transaction at joining, so they must be designed
> together. Planning them separately would produce three specs that disagree.

## Where the admission pipeline stops today

Phase 3 built the funnel and stopped at its end; Phase 5 carries it the rest of
the way. An application now reaches `ADMITTED` — but only through `admit()`.

| Reached by the workflow | Not built |
| :--- | :--- |
| `Applicant` through thirteen states, `ApplicantProgramPreference`, `Admission`, `Enrollment`, `WorkflowHistory`, the offer window and its expiry sweep, and `admit()` — the full Applicant → Student → Admission → Enrollment conversion | Student lifecycle transitions, branch transfer, readmission, promotion, repeat, bulk jobs |

`AdmissionApplicationStatus.ADMITTED` is reachable by exactly one edge, marked
`orchestratedOnly`, which the generic workflow endpoint cannot invoke. Reaching
it means a Student, an Admission and an Enrollment were written in the same
transaction; a status-only route would produce an applicant marked admitted with
nothing behind them. See the `admit()` section below.

Two CHECK constraints — `applicant_person_from_submitted_check` and
`applicant_program_from_submitted_check` — are `NOT VALID`. They are enforced on
every insert and update; the initial scan is skipped so that one pre-existing
`SUBMITTED` applicant, which has neither a person nor a programme and no
Enrollment to derive one from, is grandfathered rather than invented. The
migration carries the two-line `VALIDATE CONSTRAINT` script to run once that row
is resolved.

## Enrollment — the placement contract downstream modules consume

Phase 4 moved Enrollment out of `admissions/` into `src/modules/enrollment/` and
rebuilt it as the academic-placement spine. The dependency runs one way:
`enrollment → identity` and `enrollment → academic structure`, and **never**
`enrollment → admissions`. The schema holds an `admissionId`; the module holds no
import.

**Which id a future module should reference**, and this is the whole point of
keeping the three layers apart:

| The fact varies with | Reference | Examples |
| :--- | :--- | :--- |
| The academic year | **`enrollmentId`** | Attendance, examination, timetable, year-scoped fees |
| The human, for life | **`studentId`** | Library membership, guardian links, profile, long-term history |
| One spell of study | **`admissionId`** | Transfer certificate, admission register, branch admission history |

**What Enrollment owns and what it does not.** It owns placement — programme,
academic unit, roll number, status and provenance. It owns the `resultOutcome`
*column* and not the decision, which belongs to Examination (INV-ENR-013);
nothing in the module writes it and no route can. It holds no demographic field
at all (INV-ENR-012): twelve years of school is one Person, one Student, one
Admission and twelve thin rows.

**Placement is immutable.** Branch, year, admission, student, programme, unit,
kind and origin are fixed at write time. A wrong placement is not edited — it is
**superseded**: the original closes as `SUPERSEDED` naming its successor and its
reason, and a replacement is written carrying `previousEnrollmentId` and an
`originType` that distinguishes an operator's `CORRECTION` from a genuine
mid-year `TRANSFER`. One helper does this for correction and transfer today, and
for promotion and repeat in Phase 6, so provenance cannot be forgotten by
whoever writes the fourth caller.

**There is no `POST /enrollments` and no `DELETE`.** Every placement has an
origin operation behind it, and academic history is cancelled or superseded
rather than removed. `createInitialEnrollment` is reachable only from code, takes
an optional transaction client and opens none of its own when given one — which
is what lets Phase 5's `admit()` write Student, Admission and Enrollment
atomically.

Three things are enforced by the database rather than by a service that could be
bypassed: one composite foreign key makes an enrolment's student and branch
always match its admission's; a second makes its unit belong to its branch,
programme and year; and a partial unique index allows exactly one live `PRIMARY`
placement per admission per year — excluding `SUPERSEDED` and `CANCELLED`, which
is what makes correction possible at all.

Two deliberate deviations, both recorded rather than hidden:

- The two self-referencing foreign keys are `DEFERRABLE INITIALLY DEFERRED`.
  With immediate checking there is no order that works: inserting the
  replacement first trips the one-live-placement index, and closing the original
  first trips the supersede CHECK that demands a successor which does not exist
  yet. Prisma does not model deferrability, and it introduces no drift.
- **There is no class-list lock column anywhere in the schema**, and Phase 4 did
  not invent one — a second lock competing with `AcademicYear.isLocked` is
  exactly the conflicting model to avoid. Until F2 provides a per-class-list
  lock, `EnrollmentConfigProvider.classListLocked()` derives it from the year,
  which is coarser than the eventual rule and never weaker. F2 is the blocking
  dependency, along with the roll-number policy (§50 Q7), which defaults to
  `MANUAL`.

## `admit()` — the keystone transaction

`POST /v1/admissions/applicants/:applicantId/admit`. The only place a learner
identity is born from an application, and the one operation where a partial
result would be unrecoverable by hand.

**The contract.** The caller supplies the academic unit — the section — and
nothing else that matters. Everything else comes from the applicant's own
lineage: the organization, the branch, the academic year, the programme, the
quota and the admission source. `programId` in particular is *not* an input: it
was offered and confirmed earlier in the funnel and is not the caller's to change
at this moment. The academic unit is an input because nothing earlier records
one — an applicant applies to "Std 1"; which section they join is the decision
being made now.

**One transaction, six participants.** `AdmissionConversionService` writes
nothing itself. It locks the applicant as the first statement, then composes
`PersonService`, `StudentService`, `AdmissionService`, `EnrollmentService` and
`WorkflowService` on a single client:

```
admit()
  └── $transaction(tx)              READ COMMITTED, 15 s
       ├── SELECT … FOR UPDATE      the applicant, first
       ├── re-assert SEAT_CONFIRMED under the lock
       ├── PersonService.resolve(…, tx)
       ├── refuse if a Student already exists for this Person
       ├── StudentService.createControlled(…, tx)      + STUDENT_CODE
       ├── AdmissionService.createControlled(…, tx)    + ADMISSION_NO
       ├── EnrollmentService.createInitialEnrollment(…, tx)
       └── WorkflowService.transition(ADMIT, …, tx)    last
```

Validation that cannot change underneath the operation — scope, permissions,
the academic unit, the year's lock, numbering provisioning — runs *before* the
transaction, so none of it extends the lock hold.

**The status change is last, and it is guarded.** `SEAT_CONFIRMED → ADMITTED` is
the only `orchestratedOnly` edge in the state machine: it exists in the table,
but `POST /workflow/transition` cannot invoke it. Reaching `ADMITTED` means a
Student, an Admission and an Enrollment exist, and no request body can assert
that — there is no DTO field that sets the flag.

**Failure.** Anything at all rolls the whole thing back and leaves the applicant
`SEAT_CONFIRMED` with no student, no admission, no enrolment, no history row and
no outbox row. A `MONOTONIC` number may be burned, which is a gap and acceptable
by definition. Verified by injecting a failure at each of the six steps and
after the last one.

**Concurrency.** Twenty simultaneous requests for one applicant produce one
student, one admission, one enrolment, one code and nineteen conflicts naming
what exists. The row lock serialises the normal case; `Student.sourceApplicantId`
and `@@unique([organizationId, personId])` are what catch the rest — including
the same child seat-confirmed at two branches and admitted at once, where the
government identifier resolves both to one Person and the second admission is
refused rather than splitting the record.

**The readmission boundary.** §31.1 step 5b says an existing Student is reused
and a second Admission opened. That *is* readmission, and readmission closes the
previous spell of study, needs an elevated permission for an expelled student
and records a mandatory reason. Rather than ship a partial version of it under
another name, an existing Student produces `STUDENT_ALREADY_EXISTS` naming the
`studentId` and `studentCode`, and the application is left untouched so it can be
readmitted properly once that operation exists. **This is the one deliberate
deviation from §31.1 and it is the Phase 6 entry point.**

## Pipeline verification — what composing the five phases found

Each phase passed inside its own boundary. Composing them surfaced two defects
that no single phase could have seen, both now fixed.

**A student could be attached to the wrong identity.** Submission places an
applicant in the identity index; `admit()` asked again. For an applicant with a
government identifier the second answer matched, which is why every earlier test
passed — the fixtures all supplied one. For an applicant *without* one,
resolution deliberately never merges on demographics alone (twins share every
signal), so it minted a **second Person**. The Applicant pointed at the first and
the Student at the second, and `@@unique([organizationId, personId])` was being
enforced against a row nothing else referenced. Admission now reuses the
applicant's own `personId` and resolves only for rows that predate the identity
index — a state the database no longer permits anything to enter.

**A branch would have stopped admitting in its second year.** `ADMISSION_NO`
restarts each academic year, but `Admission @@unique([branchId, admissionNo])`
carries no year, so the second year's first admission collided with the first
year's. Two things were wrong: the engine accepted a yearly-resetting format with
no year in it, and `{year}` rendered as an empty string unless a *second* flag
was also set, so a format that asked for the year could silently not get it.
Provisioning now refuses a yearly sequence whose format renders no year, and the
format alone decides what is rendered.

Neither was reachable from the phase suites, and both were found by walking the
chain end to end. That walk is now
[`test/integration/pipeline.integration-spec.ts`](../../test/integration/pipeline.integration-spec.ts),
which asserts the composed invariants rather than repeating the phase suites:
one of each row per admission, traceability in both directions with no
demographic search, the record surviving its sources, the layers staying
separate, and the shapes promotion, readmission and branch transfer will need.

### Which count answers which question

Four tables, four different questions, and conflating them is the most likely
reporting error:

| Question | Count | Why not the others |
| :--- | :--- | :--- |
| How many applied? | `Applicant` | Includes everyone rejected, withdrawn and cancelled |
| How many people do we teach? | `Student` | A readmitted student is one person, not two |
| How many did we admit this year? | `Admission` | A readmission is a second admission for the same student |
| How many are placed in a class? | `Enrollment` | One per student per year, and the only year-scoped count |

### Carried forward

- **`applicant_person_from_submitted_check` and `applicant_program_from_submitted_check`
  remain `NOT VALID`.** The development database still holds the single
  grandfathered row they were written around — `019f8f56-ece4-71d0-8b71-054cd7e234ea`,
  `SUBMITTED` since 2026-07-23 with no person and no programme. The test database
  has zero violations and could be validated today; validating one environment
  and not the other would be a divergence waiting to surprise a deploy, so both
  stay as they are. Both constraints are enforced on every insert and update
  regardless — verified by test. To finish: resolve or delete that row, then run
  the two `VALIDATE CONSTRAINT` statements in the Phase 3 migration.
- **The guardian boundary.** Reconciling the whole lifecycle end to end found
  that guardianship is still `Applicant`-scoped rather than Person↔Person, so it
  does **not** survive `admit()` — and that no guardian route carries tenant
  scoping or a permission, which leaks a plaintext government identifier across
  tenants today. Four blocking issues, detailed in
  [`core-admission-lifecycle-specification.md`](core-admission-lifecycle-specification.md)
  §8, §46 and §47. The scoping fix (§47 R2) is contained and should ship on its
  own, ahead of the model change (R1).
- **Legacy plaintext `aadhaarNo` on `Applicant` and `Guardian`.** Still present
  and still read only through `PersonService`. `Student`, `Admission` and
  `Enrollment` have no such column and no event or audit payload carries the
  value — asserted by test. Migrating the columns out belongs with the Guardian
  work, which needs `Guardian → Person` first.

## Background — reasoning archive

`../domain/` holds the exploratory work behind these decisions. Read it for
*why*; read this folder for *what*.

| Document | Contents |
| :--- | :--- |
| [`../domain/01-04-review-of-frozen-decisions.md`](../domain/01-04-review-of-frozen-decisions.md) | Audit of the frozen Q&A Sections 1–4; seven identified defects |
| [`../domain/05-06-admission-enrollment.md`](../domain/05-06-admission-enrollment.md) | Sections 5–6 answered — the 4-layer model |
| [`../domain/07-15-remaining-sections.md`](../domain/07-15-remaining-sections.md) | Sections 7–15 answered |
| [`../domain/16-27-missing-sections.md`](../domain/16-27-missing-sections.md) | Twelve areas the 295-question set never asks about |
| [`../domain/identity-core-implementation-plan.md`](../domain/identity-core-implementation-plan.md) | Identity core plan — superseded in part by this folder |
| `../domain/plan.md` | ⚠️ **SUPERSEDED — do not follow.** An earlier draft whose "Step 1 partially landed" section describes code that was subsequently reverted. Safe to delete. |
