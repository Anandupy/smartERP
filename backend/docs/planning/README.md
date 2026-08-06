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

## Status

| # | Module | Status | Document |
| :--- | :--- | :--- | :--- |
| **F1** | Data protection & key custody | `planned` ⚠️ 1 legal question + backup-retention prerequisite | [`00-foundation/01-data-protection.md`](00-foundation/01-data-protection.md) |
| **F2** | Configuration engine | `not started` | `00-foundation/02-configuration.md` |
| **F3** | Numbering & identity engine | `planned` ⚠️ 2 open questions | [`00-foundation/03-numbering.md`](00-foundation/03-numbering.md) |
| — | Cross-cutting principles | `not started` | `00-foundation/00-principles.md` |
| **I1** | Person | `planned` ⚠️ 2 open questions | [`01-identity-core/01-person.md`](01-identity-core/01-person.md) |
| **I2** | Applicant *(exists — needs changes)* | `planned` ⚠️ 2 open questions | [`01-identity-core/02-applicant.md`](01-identity-core/02-applicant.md) |
| **I3+I4+I5** | Admission, Student, Enrollment *(one unit)* | `planned` ⚠️ 3 open questions | [`01-identity-core/03-05-admission-student-enrollment.md`](01-identity-core/03-05-admission-student-enrollment.md) |
| **S1** | Guardian & family *(partially exists)* | `not started` | `02-guardian-family/` |
| **S2** | Address | `not started` | `03-address/` |
| **S3** | Document | `not started` | `04-documents/` |
| **S4** | Employee / staff | `not started` | `05-employee/` |
| **A1** | Program & academic unit *(exists)* | `not started` | `06-academic-structure/` |
| **A2** | Academic year & calendar *(exists, calendar missing)* | `not started` | `06-academic-structure/` |
| **A3** | Subject & curriculum | `not started` | `06-academic-structure/` |
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
