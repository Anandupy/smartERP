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

## Status

| # | Module | Status | Document |
| :--- | :--- | :--- | :--- |
| **★** | **Admission → Enrollment → Student — build blueprint** | `planned` ⚠️ 12 open questions, 12 Phase-0 blockers | [`student-admission-enrollment-architecture.md`](student-admission-enrollment-architecture.md) |
| **P0** | Foundation blockers *(numbering, BOLA, outbox, row locks)* | `implemented` ✅ 2026-08-09 | blueprint §47 Phase 0 |
| **P1** | Identity foundation — Person, crypto, blind index | `implemented` ✅ 2026-08-09 ⚠️ recovery custody ceremony outstanding | [`../core/key-custody.md`](../core/key-custody.md) |
| **P2** | Student identity | `implemented` ✅ 2026-08-10 | blueprint §11, §13, §39, §41 |
| **P3** | Admission domain & applicant state machine | `implemented` ✅ 2026-08-11 ⚠️ 2 CHECK constraints `NOT VALID` pending one legacy row | blueprint §15–§17, §31, §33, §40 |
| **P4** | Enrollment — academic placement | `implemented` ✅ 2026-08-12 ⚠️ class-list lock derives from the year until F2 | blueprint §18, §28, §40, §41 |
| **F1** | Data protection & key custody | `planned` ⚠️ 1 legal question + backup-retention prerequisite | [`00-foundation/01-data-protection.md`](00-foundation/01-data-protection.md) |
| **F2** | Configuration engine | `planned` ⚠️ 2 open questions | [`00-foundation/02-configuration.md`](00-foundation/02-configuration.md) |
| **F3** | Numbering & identity engine | `planned` ⚠️ 2 open questions | [`00-foundation/03-numbering.md`](00-foundation/03-numbering.md) |
| — | Cross-cutting principles | `not started` | `00-foundation/00-principles.md` |
| **I1** | Person | `planned` ⚠️ 2 open questions | [`01-identity-core/01-person.md`](01-identity-core/01-person.md) |
| **I2** | Applicant *(exists — needs changes)* | `planned` ⚠️ 2 open questions | [`01-identity-core/02-applicant.md`](01-identity-core/02-applicant.md) |
| **I3+I4+I5** | Admission, Student, Enrollment *(one unit)* | `planned` ⚠️ 3 open questions | [`01-identity-core/03-05-admission-student-enrollment.md`](01-identity-core/03-05-admission-student-enrollment.md) |
| **S1** | Guardian & family *(partially exists)* | `planned` ⚠️ 2 open questions | [`02-guardian-family/01-guardian.md`](02-guardian-family/01-guardian.md) |
| **S2** | Address | `planned` ⚠️ 2 open questions | [`03-address/01-address.md`](03-address/01-address.md) |
| **S3** | Document | `planned` ⚠️ 3 open questions | [`04-documents/01-document.md`](04-documents/01-document.md) |
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

Phase 3 built the funnel and deliberately stopped at its end. An application can
reach `SEAT_CONFIRMED`; nothing past that exists yet.

| Reached by the workflow | Not built |
| :--- | :--- |
| `Applicant` through thirteen states, `ApplicantProgramPreference`, `Admission` (model, invariants and service), `WorkflowHistory`, the offer window and its expiry sweep | `admit()`, `Enrollment` from an application, `Student` creation from an application, lifecycle transitions, transfer, readmission, promotion |

`AdmissionApplicationStatus.ADMITTED` has **no transition rule at all**, so it is
currently unreachable. That is intentional: reaching it means a Student, an
Admission and an Enrollment were written in one transaction, and a status-only
edge would produce an applicant marked admitted with nothing behind them. Phase 5
adds the operation, not the edge.

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
