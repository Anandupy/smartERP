# A3 — Subject & Curriculum

> **Status:** `planned` — §10 has three open questions
> **Depends on:** I3+I4+I5 (Enrollment), S4 (Employee), Program, AcademicUnit, AcademicYear
> **Depended on by:** **A4 Timetable, O1 Attendance, O2 Examination** — none of which can exist without this

**New module, and the critical path.** There is no `Subject`, `Curriculum`,
`Course` or `Credit` model. Until this lands, period-wise attendance has nothing
to attach to, marks have no addressable target, NEP electives are
unrepresentable, and timetabling has nothing to schedule.

---

## 1. Purpose

A3 owns **what is taught, to whom, in which year, and by whom** — the subject
catalogue, the year-specific offering of subjects to classes, elective
selection, and teacher allocation.

It does **not** own **when** a class happens (A4 Timetable), whether a student
attended (O1), or what they scored (O2). Those all reference A3; none is part of it.

---

## 2. Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | **`Subject` and `CurriculumSubject` are separate entities** | The central decision. See §2.1. |
| D2 | **Marks and attendance address `(enrollmentId, curriculumSubjectId)`** | This pair fixes student, year, class and subject in one reference — the join everything downstream needs. |
| D3 | **Subjects are offered at the `CLASS` level of the academic-unit tree, not per division** | Div A and Div B of Std 9 study the same syllabus. Offering per division would multiply every curriculum row by the section count. |
| D4 | **Credits live on `CurriculumSubject`, not `Subject`** | The same subject carries different credit weight in different programs and years. NEP and ABC reporting need the year-specific value. |
| D5 | **Elective choice is modelled as a group with min/max selection** | "Choose one of three languages" and "choose any two of five" are the same mechanism with different bounds. |
| D6 | **Subjects support a parent/child hierarchy** | Science → Physics, Chemistry, Biology for practical marks; a combined subject with component papers. Reuses the `parentId` pattern already in `Program` and `AcademicUnit`. |
| D7 | **Teacher allocation lives here; scheduling lives in A4** | *Who teaches Std 9-A Mathematics this year* is a curriculum fact. *At 10:15 on Tuesday in Room 4* is a timetable fact. |
| D8 | **Board differences are expressed in grading and assessment configuration, not in subject structure** | §1 Q8 promises no hardcoded board rules. CBSE and ICSE both have "Mathematics, Std 9"; they differ in how it is assessed and graded. |

### 2.1 Why two entities

| | `Subject` | `CurriculumSubject` |
| :--- | :--- | :--- |
| Example | "Mathematics" | "Mathematics, Std 9, 2026–27, 100 marks, core, 6 credits" |
| Scope | Organization | Branch + program + academic unit + academic year |
| Changes | Almost never | Every year |
| Count | ~50 | thousands |

Collapsing them into one table means either re-creating "Mathematics" for every
class and year — so a subject rename touches thousands of rows and reporting
across years becomes impossible — or losing the year-specific facts (marks,
credits, whether it is elective this year) that assessment depends on.

This is the same split as `Program` (stable) versus `AcademicUnit` (year-scoped
and dynamic), which `docs/modules/academic-unit.md` already establishes and
which is working.

---

## 3. Data model

### 3.1 `Subject` — organization-scoped catalogue

| Field | Type | Null | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID v7` | no | |
| `organizationId` | `String` | no | Shared across branches — "Mathematics" means the same thing |
| `code` | `String` | no | `@@unique([organizationId, code])`. Board codes (`041` for CBSE Maths) go here. |
| `name` | `String` | no | |
| `nameI18n` | `Json?` | yes | Multilingual (§1 Q15) |
| `subjectType` | `SubjectType` | no | `THEORY`, `PRACTICAL`, `THEORY_PRACTICAL`, `PROJECT`, `ACTIVITY`, `LANGUAGE` |
| `parentId` | `String?` | yes | D6 |
| `isActive` | `Boolean` | no | |

### 3.2 `CurriculumSubject` — the year-specific offering

| Field | Type | Null | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID v7` | no | |
| `organizationId`, `branchId`, `academicYearId` | `String` | no | |
| `programId`, `academicUnitId` | `String` | no | Offered at `CLASS` level (D3) |
| `subjectId` | `String` | no | |
| `isElective` | `Boolean` | no | |
| `electiveGroupId?` | `String?` | yes | Required when `isElective` |
| `credits?` | `Decimal?` | yes | D4 — NEP / ABC |
| `maxMarks`, `passMarks` | `Decimal` | no | |
| `hasPractical` | `Boolean` | no | |
| `practicalMaxMarks?`, `practicalPassMarks?` | `Decimal?` | yes | |
| `weeklyPeriods?` | `Int?` | yes | Timetable input (A4) |
| `displayOrder?` | `Int?` | yes | Marksheet ordering |
| `isActive`, `deletedAt?` | | | |

### 3.3 `ElectiveGroup`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID v7` | |
| `academicUnitId`, `academicYearId` | `String` | Scope of the choice |
| `name` | `String` | "Second Language", "Vocational Elective" |
| `minSelect`, `maxSelect` | `Int` | D5 — `1,1` = choose exactly one |
| `selectionDeadline?` | `DateTime?` | |

### 3.4 `StudentSubjectSelection` — per enrollment

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID v7` | |
| `enrollmentId` | `String` | The year of study (I5) |
| `studentId` | `String` | Denormalized, composite-FK enforced (I5 D8) |
| `curriculumSubjectId` | `String` | |
| `selectionType` | `SelectionType` | `CORE_AUTO`, `ELECTIVE_CHOSEN`, `ADDITIONAL` |
| `selectedAt`, `selectedBy` | | |
| `droppedAt?`, `dropReason?` | | Subject changes happen early in a year |

Core subjects are materialised as `CORE_AUTO` rows on enrollment, so marks and
attendance have one uniform target rather than "core is implicit, electives are
rows".

### 3.5 `CurriculumSubjectTeacher` — allocation (D7)

| Field | Type | Notes |
| :--- | :--- | :--- |
| `curriculumSubjectId` | `String` | |
| `academicUnitId` | `String` | **The division** — Div A and Div B may have different teachers |
| `employeeId` | `String` | S4 |
| `isPrimary` | `Boolean` | The subject teacher of record |
| `validFrom`, `validTo?` | | Mid-year changes: maternity cover, resignation |

Note the two different academic-unit references: `CurriculumSubject` is at CLASS
level (D3), allocation is at DIVISION level. That asymmetry is the point — one
syllabus, different teachers per section.

---

## 4. Invariants

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | Subject code unique per organization | `@@unique([organizationId, code])` |
| 2 | One offering per subject per unit per year | `@@unique([academicUnitId, academicYearId, subjectId])` where not deleted |
| 3 | An elective belongs to a group | `CHECK (NOT "isElective" OR "electiveGroupId" IS NOT NULL)` |
| 4 | Pass marks do not exceed max marks | `CHECK ("passMarks" <= "maxMarks")` |
| 5 | Practical marks present only when `hasPractical` | `CHECK (NOT "hasPractical" OR "practicalMaxMarks" IS NOT NULL)` |
| 6 | One active selection per enrollment per curriculum subject | `CREATE UNIQUE INDEX ON "StudentSubjectSelection" ("enrollmentId","curriculumSubjectId") WHERE "droppedAt" IS NULL` |
| 7 | Elective selections respect the group's bounds | Application-validated at submission — a `CHECK` cannot count rows |
| 8 | One primary teacher per curriculum subject per division | `CREATE UNIQUE INDEX ON "CurriculumSubjectTeacher" ("curriculumSubjectId","academicUnitId") WHERE "isPrimary" AND "validTo" IS NULL` |
| 9 | A subject is not its own parent | `CHECK ("parentId" <> "id")` |
| 10 | Allocated teacher holds the competency | Application-validated against `EmployeeSubject` (S4 §3.3) |

Invariant 7 is the one that cannot be a database constraint and therefore needs
an explicit test: "choose exactly one of three languages" is a count across rows.

---

## 5. Provenance

`CurriculumSubject` rows are **year-scoped and never edited across years** —
next year's offering is a new row, so 2026's mark scheme stays intact after 2027
changes the weighting.

Subject selections are soft-dropped (`droppedAt` + reason), never deleted:
attendance and marks may already reference them.

Teacher allocations are date-ranged (D7), so "who taught this in March?" stays
answerable after a mid-year change.

### The correction test

A student switches from French to Sanskrit in the second week:

```
StudentSubjectSelection  French    ELECTIVE_CHOSEN  droppedAt: 2026-06-24
                                                    dropReason: "changed elective within window"
StudentSubjectSelection  Sanskrit  ELECTIVE_CHOSEN  selectedAt: 2026-06-24
```

The French row is retained. Any attendance already marked against it stays
attached to it — the student genuinely did attend those two French classes, and
rewriting that would falsify the register.

---

## 6. Lifecycle

**Curriculum setup, per year:** copy the previous year's offerings → adjust →
activate. The copy step matters: nobody re-enters 40 subjects × 12 classes
annually, and if the system does not offer it they will copy the database by hand.

**Selection:** open → student or staff selects → deadline passes → locked.
After locking, changes require the same privilege as a mark correction.

**Enrollment creates `CORE_AUTO` selections** for every non-elective offering of
that academic unit, so a newly enrolled student immediately has a subject list.

---

## 7. API surface

| Method | Path | Purpose | Roles |
| :--- | :--- | :--- | :--- |
| `GET`/`POST` | `/v1/subjects` | Organization catalogue | `ORG_ADMIN`+ |
| `GET` | `/v1/curriculum?academicUnitId=&academicYearId=` | Offerings for a class | `STAFF`+ |
| `POST` | `/v1/curriculum` | Offer a subject to a class | `BRANCH_ADMIN`+ |
| `POST` | `/v1/curriculum/copy-from-year` | **Bulk copy from a previous year** | `BRANCH_ADMIN`+ |
| `GET`/`POST` | `/v1/elective-groups` | Manage choice groups | `BRANCH_ADMIN`+ |
| `GET` | `/v1/enrollments/:id/subjects` | A student's subject list | `STAFF`+ |
| `PUT` | `/v1/enrollments/:id/subjects/electives` | Submit elective choices | `STAFF`+ |
| `PUT` | `/v1/curriculum/:id/teachers` | Allocate teachers per division | `BRANCH_ADMIN`+ |

| Rule broken | Status | `error.code` |
| :--- | :--- | :--- |
| Elective selection outside group bounds | `400` | `BadRequestException` — names the group and its bounds |
| Selection after the deadline | `403` | `ForbiddenException` |
| Teacher lacks the competency | `400` | `BadRequestException` |
| Duplicate offering | `409` | `ConflictException` |
| `passMarks` above `maxMarks` | `400` | `BadRequestException` |

---

## 8. Events

| Event | When | Consumers |
| :--- | :--- | :--- |
| `curriculum.published` | Year's curriculum activated | Timetable, examination |
| `subject_selection.submitted` | Student's electives confirmed | Attendance register, marks sheet |
| `subject_selection.dropped` | Subject dropped | Attendance, marks |
| `curriculum_teacher.allocated` | Teacher assigned or changed | Timetable, notification |

---

## 9. Dependencies

**Requires:** Program, AcademicUnit, AcademicYear (all exist), Enrollment (I5),
Employee (S4).

**Depended on by, and blocked until this lands:**

| Module | Needs |
| :--- | :--- |
| **A4 Timetable** | `weeklyPeriods`, teacher allocation, subject list per class |
| **O1 Attendance** | `curriculumSubjectId` for period-wise marking |
| **O2 Examination** | `(enrollmentId, curriculumSubjectId)` — the mark's address |
| Government reporting | Subject-wise enrolment counts, credits for ABC |

### The other academic gap

`AcademicYear` is *"just its two dates"* (`docs/modules/academic-year.md` — "Not
in this module"). There is **no calendar**: no terms, holidays, working days or
exam windows. Attendance percentage is uncomputable without working days, so
**A2's calendar is as much a blocker for O1 as A3 is.** It is not part of A3,
but planning O1 before both exist would be premature.

---

## 10. Open questions

| # | Question | Blocks | Options |
| :--- | :--- | :--- | :--- |
| **Q1** | **Are subjects ever offered per division rather than per class?** | D3, invariant 2 | D3 assumes Div A and Div B share a syllabus. That holds in schools. In colleges, two sections of the same year can genuinely take different electives with different mark schemes. Options: (a) keep CLASS-level and model divergence as separate academic units; (b) allow `CurriculumSubject.academicUnitId` at any level, weakening invariant 2. **Recommendation: (a)** — a section with a genuinely different syllabus is a different academic unit, which the existing tree already supports. Needs confirmation against a real college case. |
| **Q2** | **Does attendance reference `CurriculumSubject` or a timetable period?** | O1's data model, and A4's | Referencing the curriculum subject means attendance works before a timetable exists — valuable, since many schools mark daily attendance and never build one. Referencing the period gives room and time context. **Recommendation: `(enrollmentId, curriculumSubjectId, date, periodNumber?)`**, with the period optional. Confirm when A4 is planned. |
| **Q3** | **Where does board-specific grading configuration live?** | D8, and O2 | Grade scales, weightings and pass rules differ per board and must not be hardcoded (§1 Q8). Candidates: on `Program` (which carries board affiliation), in F2 configuration keyed by program, or a dedicated `GradingScheme` entity referenced by curriculum subjects. **Recommendation: a `GradingScheme` entity owned by O2**, referenced from `CurriculumSubject` — grading is assessment's concern, and F2 is for policy values rather than structured rule sets. Decide when O2 is planned. |

---

## 11. Acceptance scenarios

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | Offer Mathematics to Std 9 for 2026–27 | One `CurriculumSubject`; the `Subject` row is reused, not duplicated |
| 2 | Same subject next year with different weighting | New `CurriculumSubject`; **2026's row unchanged** |
| 3 | Student enrolls in Std 9 | `CORE_AUTO` selections created for every non-elective offering |
| 4 | Choose 1 of 3 languages | Exactly one accepted; a second attempt in the same group `400` (invariant 7) |
| 5 | Choose 2 of 5 where the group allows 2 | Both accepted |
| 6 | Submit 3 where the group allows 2 | `400` naming the group and its bounds |
| 7 | Switch elective in week 2 | Old row `droppedAt`; **attendance already marked stays attached to it** |
| 8 | Div A and Div B, different Maths teachers | Two `CurriculumSubjectTeacher` rows, one `CurriculumSubject` (D3) |
| 9 | Allocate a librarian to teach Maths | `400` (invariant 10, S4 D6) |
| 10 | Copy 2026 curriculum into 2027 | All offerings duplicated with new `academicYearId`; **no `Subject` rows created** |
| 11 | Science with Physics, Chemistry, Biology children | Hierarchy resolves; component marks roll up (D6) |
| 12 | **Raw SQL**: `passMarks` above `maxMarks` | Rejected (invariant 4) |
| 13 | **Raw SQL**: elective with no group | Rejected (invariant 3) |
| 14 | **Raw SQL**: two offerings of one subject to one unit in one year | Rejected (invariant 2) |

Scenario 2 is what the two-entity split exists for. 12–14 must run as raw SQL.
