# I3 + I4 + I5 — Admission, Student, Enrollment

> **Status:** `planned` — §10 has three open questions
> **Depends on:** F1 (data protection), I1 (Person), F3 (numbering), Program, AcademicUnit, AcademicYear, Branch
> **Depended on by:** everything academic — attendance, examination, finance, certificates, transport, hostel, library

**Specified as one document because these three tables are written in a single
transaction and reference each other through composite keys.** Splitting them
would produce three specs that disagree at the seams.

---

## 1. Purpose

| Model | Owns | Does not own |
| :--- | :--- | :--- |
| **Student** | The permanent learner identity within one organization: `studentCode`, current official demographics, lifecycle status | Academic placement, fees, attendance. Not the *human* — that is Person. |
| **Admission** | One continuous spell of study at one branch: `admissionNo`, joining date, entry level, quota, exit date and reason | Anything that varies year to year |
| **Enrollment** | One academic year of study: program, class/section, roll number, result outcome | Identity, and anything that spans years |

The layering exists because **Applicant dies at approval and Enrollment dies at
promotion**. Neither can hold *"this person joined this branch on this date, under
this quota, at this level, and left on that date for that reason"* — which is
precisely the record a Transfer Certificate is issued against.

---

## 2. Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | **Student, Admission and the first Enrollment are created together in one transaction, at joining** | An approved applicant who never pays and never appears must never become a Student. Otherwise every count, fee run and attendance register carries ghosts forever. |
| D2 | **`studentCode` is `STU` + 10 digits, unique per organization** | No year, branch or org embedded, because §3 Q23 forbids the code changing while branch and year both do. Per-organization rather than global — see `../../domain/01-04-review-of-frozen-decisions.md` D1. |
| D3 | **`Student.branchId` is a mutable pointer; `Admission.branchId` is immutable** | This is the hinge of the whole design. A transfer moves the Student pointer and opens a new Admission; the old Admission keeps pointing at the branch where it actually happened. |
| D4 | **One `ACTIVE` Admission per Student at a time** | A student cannot be simultaneously admitted twice. Enforced by partial index, not by service code. |
| D5 | **Enrollment = one academic year.** Terms, semesters and exams live in the Examination module | Your decision. One grade for the year; promotion creates the next row. |
| D6 | **Structural changes supersede; they never update in place** | `originType` + `previousEnrollmentId` + `supersededById` + mandatory `changeReason`. Your Primary‑1 → Primary‑2 case. |
| D7 | **Branch transfer opens a new Admission; a program change inside a branch does not** | `admissionNo` is branch-scoped and fee structures are branch-scoped (§2 Q3/Q11), so an admission cannot span branches. A Science→Commerce switch in Std 11 must not inflate admission counts. |
| D8 | **Enrollment carries a denormalized `studentId`, kept honest by a composite foreign key** | Every downstream module needs "this student's rows" without a three-table join. The composite FK makes a mismatch unrepresentable rather than merely unlikely. |
| D9 | **Neither Student, Admission nor Enrollment has a hard-delete path** | No service method, no endpoint. Soft delete only, and blocked once history exists. |
| D10 | **`Student.dob` and `nameNormalized` on Person are projections, not duplicates** | Person holds *derived matching keys* — exactly as `nameNormalized` is a projection of the name, `Person.dob` is a projection of `Student.dob`. Single writer, recomputed on correction. |
| D11 | **Aadhaar does not appear on Student at all** | F1: sensitive identifiers attach to `personId` via `PersonSensitive`. Student holds APAAR, ABC, PEN, Saral and UDISE ids in plaintext (F1 D5). |
| D12 | **`resultOutcome` is written only by the Examination module** | Enrollment owns the column; it does not own the decision. |

### Rejected alternatives

| Rejected | Why |
| :--- | :--- |
| Creating Student at `APPROVED` (the original §3 Q3 answer) | 5–20% of approvals never join. Each would be a permanent ghost student. |
| Admission facts as columns on Student (3-layer model) | Breaks the moment a student has more than one spell of study — readmission, branch transfer, school→junior college. |
| One Enrollment per semester | Schools would generate needless rows and "one enrollment per year" stops being a usable uniqueness rule. |
| Editing an Enrollment in place on correction | Destroys the evidence that a correction happened. Fails your "nothing should just appear" requirement. |
| `Enrollment.applicantId @unique` with `onDelete: Cascade` (**current schema**, `schema.prisma:271,279`) | One enrollment per applicant forever, and an applicant deletion destroys the academic record. Both are removed. |

---

## 3. Data model

### 3.1 `Student`

| Field | Type | Null | Why here |
| :--- | :--- | :--- | :--- |
| `id` | `UUID v7` | no | |
| `organizationId` | `String` | no | Identity scope |
| `branchId` | `String` | no | **Mutable pointer** (D3). Not identity. |
| `personId` | `String` | no | The human (I1) |
| `studentCode` | `String` | no | Permanent business identifier (D2) |
| `status` | `StudentStatus` | no | `ACTIVE`, `GRADUATED`, `WITHDRAWN`, `EXPELLED`, `ARCHIVED` |
| `firstName`, `middleName?`, `lastName`, `displayName` | `String` | | **Current official truth**, distinct from the Applicant snapshot |
| `dob` | `DateTime` | no | Official record; Person's copy is the projection (D10) |
| `genderId`, `religionId?`, `casteId?`, `categoryId?`, `motherTongueId?`, `bloodGroupId?` | `String` | | Master FKs — current values, which change (category on obtaining a certificate) |
| `disabilityStatus`, `disabilityTypeId?`, `disabilityNotes?` | | | Restricted-role read |
| `photoFileId?` | `String` | yes | Blob reference |
| `apaarId?`, `abcId?`, `penNo?`, `saralId?`, `udiseStudentId?` | `String` | yes | Plaintext institutional identifiers (D11, F1 D5) |
| `createdVia` | `StudentCreationMode` | no | `ADMISSION` \| `MIGRATION` |
| `sourceApplicantId?` | `String` | yes | Null only when `createdVia = MIGRATION` (§3 Q4) |
| `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `deletedAt?` | | | |

**Uniques:** `[organizationId, studentCode]`, `[organizationId, personId]`,
plus `[id, organizationId]` to enable composite references.

> **`[id, branchId]` is deliberately NOT declared.** `branchId` is mutable, so a
> composite FK on it would break every child row the moment a student transfers.
> Branch consistency is enforced through Admission instead, whose `branchId`
> never changes.

### 3.2 `Admission`

| Field | Type | Null | Why here |
| :--- | :--- | :--- | :--- |
| `id` | `UUID v7` | no | |
| `organizationId`, `branchId` | `String` | no | **`branchId` is immutable** (D3) |
| `studentId` | `String` | no | |
| `admissionNo` | `String` | no | Branch + year scoped, human-facing |
| `admissionType` | `AdmissionType` | no | `REGULAR`, `LATERAL_ENTRY`, `TRANSFER`, `MIGRATION`, `READMISSION`, `BRANCH_TRANSFER`, `RTE` |
| `admissionDate` | `DateTime` | no | The joining date — not the approval date |
| `entryProgramId`, `entryAcademicUnitId` | `String` | no | The level actually joined. Serves lateral entry without special modelling. |
| `quotaId?`, `admissionSourceId?` | `String` | yes | Existing masters |
| `status` | `AdmissionStatus` | no | `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`, `TRANSFERRED_OUT` |
| `sourceApplicantId?`, `previousAdmissionId?` | `String` | yes | Provenance |
| `exitDate?`, `exitReason?`, `exitRemarks?` | | yes | `GRADUATED`, `TRANSFER_OUT`, `BRANCH_TRANSFER`, `DROPPED_OUT`, `EXPELLED`, `DECEASED`, `CANCELLED_BEFORE_JOINING` |

**Uniques:** `[branchId, admissionNo]`, `[id, studentId, branchId]` (enables the
composite FK below), `[id, studentId]`.

### 3.3 `Enrollment` — full rewrite of `schema.prisma:264–291`

| Field | Type | Null | Why here |
| :--- | :--- | :--- | :--- |
| `id` | `UUID v7` | no | |
| `organizationId`, `branchId`, `academicYearId` | `String` | no | |
| `admissionId` | `String` | no | The parent spell of study |
| `studentId` | `String` | no | Denormalized (D8), FK-enforced |
| `programId`, `academicUnitId` | `String` | no | Placement for **this year** |
| `rollNumber?` | `String` | yes | Assigned after the class list settles |
| `enrollmentKind` | `EnrollmentKind` | no | `PRIMARY` \| `SECONDARY` (Phase 2) \| `EXCHANGE` (Phase 3) |
| `enrollmentStatus` | `EnrollmentStatus` | no | `PENDING`, `ACTIVE`, `ON_BREAK`, `PROMOTED`, `DETAINED`, `COMPLETED`, `TRANSFERRED`, `DROPPED_OUT`, `CANCELLED`, `SUPERSEDED` |
| `isRepeat` | `Boolean` | no | Same academic unit as the previous year |
| `resultOutcome?` | `ResultOutcome` | yes | Written by Examination only (D12) |
| `originType` | `EnrollmentOriginType` | no | `ADMISSION`, `PROMOTION`, `REPEAT`, `CORRECTION`, `TRANSFER`, `READMISSION`, `MIGRATION` |
| `previousEnrollmentId?`, `supersededById?`, `changeReason?` | | yes | Provenance (§5) |
| `applicantId?` | `String` | yes | **Provenance only. No cascade.** |
| `exitDate?`, `exitReason?` | | yes | |
| `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `deletedAt?` | | | |

**Uniques:** `[id, studentId]` — propagated to Attendance, Marks and Fees.

### 3.4 The composite foreign key

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

One foreign key enforces two invariants at once: an Enrollment's student always
equals its Admission's student, **and** its branch always equals its Admission's
branch. Both become unrepresentable in Postgres rather than merely checked in a
service someone might forget to call.

Downstream modules inherit this free — `Attendance` references
`(enrollmentId, studentId)`, so an attendance row can never name a student who
is not in that enrollment.

### 3.5 The promotion test

Promoting Riya from Std 9 to Std 10 writes **one row**:

```
Enrollment { admissionId, academicYearId, programId, academicUnitId,
             rollNumber, originType: PROMOTION, previousEnrollmentId }
```

Zero demographic fields copied. Twelve years → one Person, one Student, one
Admission, twelve thin Enrollment rows.

> **If a change ever requires copying a demographic field into Enrollment, the
> design has broken.** Treat it as a red flag, not a convenience.

---

## 4. Invariants

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | One Student per Person per organization | `@@unique([organizationId, personId])` |
| 2 | `studentCode` unique per organization | `@@unique([organizationId, studentCode])` |
| 3 | `admissionNo` unique per branch | `@@unique([branchId, admissionNo])` |
| 4 | One `ACTIVE` Admission per Student | partial index, below |
| 5 | One `PRIMARY` Enrollment per Admission per year | partial index, below |
| 6 | Roll number unique within a class for a year | partial index, below |
| 7 | Enrollment's student = its Admission's student | composite FK (§3.4) |
| 8 | Enrollment's branch = its Admission's branch | composite FK (§3.4) |
| 9 | No Enrollment without an Admission; no Admission without a Student | required FKs |
| 10 | `MIGRATION` is the only creation mode permitting a null `sourceApplicantId` | `CHECK ("createdVia" = 'MIGRATION' OR "sourceApplicantId" IS NOT NULL)` |
| 11 | A superseded Enrollment has both a successor and a reason | `CHECK ("enrollmentStatus" <> 'SUPERSEDED' OR ("supersededById" IS NOT NULL AND "changeReason" IS NOT NULL))` |
| 12 | No hard delete on any of the three | No service method, no endpoint |

```sql
-- 4. One ACTIVE admission per student
CREATE UNIQUE INDEX admission_one_active_per_student
  ON "Admission" ("studentId")
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

-- 5. One PRIMARY enrollment per admission per academic year
CREATE UNIQUE INDEX enrollment_one_primary_per_year
  ON "Enrollment" ("admissionId", "academicYearId")
  WHERE "enrollmentKind" = 'PRIMARY'
    AND "deletedAt" IS NULL
    AND "enrollmentStatus" NOT IN ('SUPERSEDED', 'CANCELLED');

-- 6. Roll number unique within a class for a year
CREATE UNIQUE INDEX enrollment_rollno_unique
  ON "Enrollment" ("academicUnitId", "academicYearId", "rollNumber")
  WHERE "rollNumber" IS NOT NULL
    AND "deletedAt" IS NULL
    AND "enrollmentStatus" NOT IN ('SUPERSEDED', 'CANCELLED');
```

> **The `SUPERSEDED` exclusion in index 5 is essential.** Without it the
> Primary‑1 → Primary‑2 correction is rejected, because the old and new rows
> share an admission and academic year. This is the single most likely thing to
> be omitted during implementation.

---

## 5. Provenance

| Operation | Old row becomes | New row `originType` | Reason required |
| :--- | :--- | :--- | :--- |
| Promotion | `PROMOTED` | `PROMOTION` | no |
| Repeat year | `DETAINED` | `REPEAT`, `isRepeat: true` | no |
| **Placement correction** | `SUPERSEDED` | `CORRECTION` | **yes** |
| Section/program change mid-year | `SUPERSEDED` | `TRANSFER` | **yes** |
| Branch transfer | `TRANSFERRED` + Admission closed | `TRANSFER` under a **new** Admission | **yes** |
| Readmission | previous Admission already closed | `READMISSION` under a new Admission | **yes** |

**The correction test — your Primary‑1 → Primary‑2 case:**

```
Enrollment A   Primary 1   enrollmentStatus: SUPERSEDED
                           supersededById:   B
                           changeReason:     "wrong class selected at admission"

Enrollment B   Primary 2   enrollmentStatus: ACTIVE
                           originType:       CORRECTION
                           previousEnrollmentId: A
```

Row A is never edited and never deleted. Because `originType` distinguishes
`CORRECTION` from `TRANSFER`, a report can tell an operator's **mistake** from a
genuine mid-year **move** — which matters when the registrar is asked why a
student appears in two classes.

Every operation additionally writes a `WorkflowHistory` row, which requires
generalising that table from `applicantId` to polymorphic `(entityType, entityId)`
so Applicant, Admission and Enrollment share one audit engine.

---

## 6. Lifecycle

### 6.1 `admit()` — the critical path

One Prisma transaction. Called when the seat is confirmed and the student
actually joins.

1. Assert Applicant status is `SEAT_CONFIRMED`
2. `PersonService.resolve()` → Person (I1)
3. Assert no existing Student for that Person in this organization (invariant 1)
4. Generate `studentCode` (organization sequence) → create **Student**
5. Generate `admissionNo` (branch sequence) → create **Admission**, `status: ACTIVE`
6. Create first **Enrollment**, `originType: ADMISSION`, `enrollmentStatus: ACTIVE`
7. Transition Applicant → `ADMITTED` (terminal) through the workflow engine —
   **not `APPROVED`**, which now means "offer made, seat provisionally held"
   and sits two states earlier. See [I2 §3.3](02-applicant.md#33-the-state-machine).
8. Write `WorkflowHistory` rows for all three
9. Publish `student.created`, `admission.created`, `enrollment.created`

> **Steps 4 and 5 must generate numbers _inside_ the transaction.** The current
> `NumberingService` increments the counter before the insert
> (`../../admissions/numbering-review.md` §2B), so a failure leaves a hole. A
> gap in a form number is cosmetic; a gap or collision in a permanent
> `studentCode` is not.

Step 3 is what makes the two-branch collision a clean, resolvable conflict
naming the existing student rather than a second identity.

### 6.2 Student lifecycle

```
[ACTIVE] ──graduate──> [GRADUATED] ──> [ARCHIVED]
    ├──withdraw──> [WITHDRAWN]
    └──expel────> [EXPELLED]
```

`ARCHIVED` is read-only but remains searchable and reportable (§3 Q8). There is
no transition out of `ARCHIVED` except by privileged force-correction.

### 6.3 Admission lifecycle

```
[ACTIVE] ──complete──> [COMPLETED]      (course finished)
    ├──hold─────────> [ON_HOLD]         (academic break — no Enrollment that year)
    ├──transfer─────> [TRANSFERRED_OUT] (branch transfer; new Admission opens)
    └──cancel───────> [CANCELLED]       (cancelled after joining; Enrollments voided)
```

**Cancellation is two different things** and they must not share a status:
cancelling an *application* is `Applicant.CANCELLED` and produces no Student at
all; cancelling an *admission after joining* voids the active Enrollment and
triggers refund and TC workflows.

### 6.4 The four enrollment operations

`promote`, `repeatYear`, `correctPlacement`, `transferPlacement` all route
through **one supersede-and-link helper**, so provenance cannot be forgotten by
whoever writes the fourth one. `correctPlacement` and `transferPlacement`
require a non-empty `changeReason`; the helper rejects a blank string, not just
a null.

### 6.5 Branch transfer

`ORG_ADMIN` / `SUPER_ADMIN` only, mandatory reason:

1. Close Admission #1 — `TRANSFERRED_OUT`, `exitReason: BRANCH_TRANSFER`
2. Set the current Enrollment to `TRANSFERRED`
3. Open Admission #2 at the new branch with a **new branch-scoped**
   `admissionNo`, `admissionType: BRANCH_TRANSFER`, `previousAdmissionId: #1`
4. Create the new Enrollment
5. Update `Student.branchId` — the pointer moves; `studentCode` does not change

---

## 7. API surface

| Method | Path | Purpose | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/admissions/applicants/:id/admit` | The §6.1 transaction | `BRANCH_ADMIN`+ |
| `GET` | `/v1/students` | Search and list | `STAFF`+ |
| `GET` | `/v1/students/:id` | One student with current enrollment | `STAFF`+ |
| `PATCH` | `/v1/students/:id` | Correct current demographics | `BRANCH_ADMIN`+ |
| `GET` | `/v1/students/:id/admissions` | Full admission history | `STAFF`+ |
| `POST` | `/v1/students/:id/branch-transfer` | §6.5 | `ORG_ADMIN`+ |
| `POST` | `/v1/admissions/:id/cancel` | Cancel after joining | `ORG_ADMIN`+ |
| `POST` | `/v1/enrollments/:id/promote` | Next year | `BRANCH_ADMIN`+ |
| `POST` | `/v1/enrollments/:id/repeat` | Same unit, next year | `BRANCH_ADMIN`+ |
| `POST` | `/v1/enrollments/:id/correct` | Placement correction | `BRANCH_ADMIN`+ |
| `POST` | `/v1/enrollments/:id/transfer` | Mid-year section/program move | `BRANCH_ADMIN`+ |

**No `POST /v1/students`** — a Student is only ever born from `admit()` or the
migration importer. **No `DELETE` anywhere** (D9).

| Rule broken | Status | `error.code` |
| :--- | :--- | :--- |
| Applicant not `SEAT_CONFIRMED` | `409` | `ConflictException` |
| Person already has a Student in this org | `409` | `ConflictException` — names the existing `studentCode` |
| Second `ACTIVE` admission | `409` | `ConflictException` |
| Roll number already used in that class | `409` | `ConflictException` |
| Correction without a reason | `400` | `BadRequestException` |
| Editing a `COMPLETED` enrollment | `403` | `ForbiddenException` |
| Branch transfer by a `BRANCH_ADMIN` | `403` | `ForbiddenException` |
| Academic year locked | `403` | `ForbiddenException` |

---

## 8. Events

| Event | When | Payload |
| :--- | :--- | :--- |
| `student.created` | `admit()` or migration | `studentId`, `studentCode`, `personId` |
| `student.status_changed` | Graduate, withdraw, expel | `studentId`, from, to |
| `student.branch_transferred` | §6.5 | `studentId`, from, to branch |
| `admission.created` | New spell of study | `admissionId`, `admissionNo`, type |
| `admission.closed` | Exit | `admissionId`, `exitReason` |
| `enrollment.created` | Any of the five origins | `enrollmentId`, `originType`, `previousEnrollmentId` |
| `enrollment.superseded` | Correction or transfer | old and new ids, `changeReason` |
| `enrollment.status_changed` | Promotion, dropout, completion | from, to |

`student.created` is the one every future module subscribes to. `enrollment.superseded`
matters most to attendance and marks, which hold rows against the old enrollment
id — see §10 Q2.

---

## 9. Dependencies

**Requires:** F1, I1 (Person), F3 (numbering — `STUDENT_CODE` organization-scoped,
`ADMISSION_NO` branch-scoped, both gapless), Program, AcademicUnit, AcademicYear,
Branch, and the Quota / AdmissionSource masters (already built).

**Depended on by:** attendance, examination, finance, certificates, transport,
hostel, library, government reporting.

**The foreign key contract** — this is the rule that must survive into every
later module:

| The fact is about… | Reference | Examples |
| :--- | :--- | :--- |
| the human | `personId` | guardian links, siblings, consent |
| the permanent learner | `studentId` | documents, health, discipline, login, alumni |
| one spell of study | `admissionId` | transfer certificate, admission register |
| **one academic year** | **`enrollmentId` + `studentId`** | **attendance, marks, fees, transport, hostel, library** |

Most modules attach to **Enrollment**, not Student. That is what makes
year-scoping automatic and stops Std 9 attendance leaking into Std 10.

**Schema changes to existing tables:** `Enrollment` is rewritten (dropping
`applicantId @unique` and its `onDelete: Cascade`); `Applicant` gains `personId`
and `programId` and three statuses (I2); `WorkflowHistory` becomes polymorphic;
`NumberSequenceConfig` gains two purposes and an organization scope.

---

## 10. Open questions

| # | Question | Blocks | Options |
| :--- | :--- | :--- | :--- |
| **Q1** | **What triggers "new Admission" when a student moves school→junior college inside one branch?** | `admit()` vs `promote()` at the boundary | The earlier design said "when `Program.level` changes" — but `ProgramLevel` is **nullable** and has only three values (`SCHOOL`, `COLLEGE`, `DEGREE`), so it cannot carry that rule reliably. Options: (a) branch change is the *only* trigger, and a Std 10→11 progression stays one Admission; (b) add an explicit `Program.requiresNewAdmission` flag set per institution; (c) make it an operator choice at promotion time. **Recommendation: (b)** — institutions genuinely differ, and a flag is honest about that where a derived rule is not. |
| **Q2** | **What happens to attendance and marks already recorded against a superseded Enrollment?** | `correctPlacement`, `transferPlacement` | (a) history stays with the old enrollment, only future records attach to the new one — auditable, and the only option that does not rewrite the past; (b) migrate records to the new enrollment; (c) forbid corrections after a configurable cut-off date. **Recommendation: (a) plus (c)** — keep history where it happened, and stop late corrections entirely once results are frozen. Needs your decision before Attendance (O1) is planned. |
| **Q3** | **Who assigns roll numbers, and when?** | `rollNumber` on Enrollment | Manual entry, sequential on admission, or alphabetical regeneration once the class list settles (the common Indian practice). Alphabetical regeneration means roll numbers **change** after admission, which conflicts with treating them as stable. **Recommendation: configurable per branch, defaulting to alphabetical-on-lock**, with roll numbers explicitly mutable until the class list is locked and immutable after. |

---

## 11. Acceptance scenarios

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | Riya: Nursery 2026 → Std 10 in 2037 | 1 Person, 1 Student, 1 Admission, **12 Enrollments**. `studentCode` and `admissionNo` never change. **Zero demographic fields duplicated across the 12 rows.** |
| 2 | **Admitted Primary 1, corrected to Primary 2** | A `SUPERSEDED` with `supersededById` + `changeReason`; B `ACTIVE`, `originType: CORRECTION`, `previousEnrollmentId: A`. A still readable. **Partial index 5 not violated.** |
| 3 | Arjun fails Std 9 and repeats | Same Admission, 2 Enrollments on Std 9, second `isRepeat: true`, `originType: REPEAT` |
| 4 | Sara transfers Mumbai → Pune | Same Person, Student and `studentCode`. Admission #1 `TRANSFERRED_OUT`; Admission #2 with a **Pune** `admissionNo`; `Student.branchId` moved. **Rejected for a `BRANCH_ADMIN`.** |
| 5 | Vikram drops out, returns after 2 years | Person match finds the existing Student. **No second Student.** Admission #2 `READMISSION` with `previousAdmissionId`. |
| 6 | Same child confirmed at two branches | Second `admit()` fails on invariant 1 — a conflict naming the existing `studentCode`, not a crash, not a duplicate. |
| 7 | Applicant approved, never pays, never joins | **Zero** Students, zero Admissions. Student count unaffected. |
| 8 | Priya switches Science → Commerce in Std 11, same branch | **Same Admission.** Enrollment superseded, `originType: TRANSFER`, new `programId`. Admission count unchanged. |
| 9 | Admission cancelled after joining | Admission `CANCELLED`, active Enrollment voided, Student remains with **zero active enrollments**. Verify no module assumes a Student always has one. |
| 10 | Academic break — gap year | Admission `ON_HOLD`, **no Enrollment row** for that year. No phantom enrollment. |
| 11 | 50 concurrent `admit()` calls | 50 distinct `studentCode`s and `admissionNo`s, **no gaps, no collisions, no deadlock** |
| 12 | **Raw SQL**: Enrollment whose `studentId` ≠ its Admission's | **Rejected by Postgres** (invariant 7) |
| 13 | **Raw SQL**: Enrollment whose `branchId` ≠ its Admission's | **Rejected by Postgres** (invariant 8) |
| 14 | Two students given roll 12 in the same class and year | Second rejected (invariant 6) |
| 15 | Student created with `createdVia: ADMISSION` and null `sourceApplicantId` | Rejected (invariant 10) |

Scenarios 12–15 prove the design rather than the implementation and **must run
as raw SQL** — through Prisma they prove only that the service layer is careful
today. Scenario 11 is the concurrency case that justifies moving number
generation inside the transaction.
