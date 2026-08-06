# CampusFlow — Identity Core Implementation Plan

`Person → Applicant → Student → Admission → Enrollment`

## Context

`studentId` becomes a permanent foreign key in every module ever written —
attendance, fees, exams, library, transport, certificates. It cannot be
refactored later without touching everything. This plan freezes the identity
core before any dependent module is built.

Three requirements drive the design, all stated by you:

1. **No data repetition.** Promoting a student must not copy demographic data.
2. **Nothing just appears.** Every row must record why it exists and what it
   came from. Your Primary‑1 → Primary‑2 correction case is the test: the
   correction must be visible as a correction, with a reason, forever.
3. **Modern standard, broadly applicable.** Playgroup → Postgraduate, school and
   college, single and multi-branch, without per-institution code paths.

Current state: `D:\ERP\backend`, development data only. No `Student` model
exists; `Enrollment` hangs off `applicantId @unique` with `onDelete: Cascade`
(schema.prisma:271, 279). Background: [docs/domain/](D:\ERP\backend\docs\domain).

---

## Part 1 — The three discussions you asked for

### 1.1 The Person layer — in depth

**What it is:** a deduplication index, not an entity with behaviour. Roughly
eight columns, no status, no lifecycle, no business rules.

**The honest case against it first.** Much of what Person provides could be had
by simply making the existing duplicate-check org-scoped and cross-entity —
search Applicant *and* Student *and* Guardian by Aadhaar. That is cheaper. So
Person has to earn its place on the cases that workaround cannot cover:

| Scenario | Without Person | With Person |
| :--- | :--- | :--- |
| Rejected in 2026, applies again 2027 | Works — duplicate engine finds the old Applicant | Works |
| Sibling admission | Works — matched via Guardian mobile | Works |
| **Dropped out, returns 3 years later** | **Fails.** The duplicate engine searches Applicants; this person is a *Student*. No match. A second Student is created for the same human. | Found immediately |
| **Approved at two branches simultaneously** | **Fails.** Check is branch-scoped. Two Students, one child. | Blocked by `@@unique([organizationId, personId])` |
| **Teacher whose child studies here** | Unlinkable. Two unrelated rows. | One Person, two roles — which §14 needs for one login, many identities |
| **DPDP erasure request** | Aadhaar lives in Applicant, Student *and* Guardian. Erase in three places and prove it. | One row, one key, one erasure |

The last three are the ones that matter, and none is solvable by better queries —
they are structural.

**The real risk is sprawl.** The moment Person exists, there is pressure to move
name, address, and photo onto it. That would be wrong: those change, and they
change *differently* for a student versus a guardian. Guard against it with a
one-line rule in the code and the docs:

> **Person holds only what is used to decide "is this the same human?"**
> Hashed government ID, date of birth, normalised name, hashed phone. Nothing
> else. Ever.

**Verdict: build it, ruthlessly thin, organization-scoped.** §4 Q6 forbids a
global registry, so Person never spans organizations. Store the government ID as
an HMAC blind index, not plaintext — this is what makes matching work *after*
encryption (§1.3).

### 1.2 Student Code scope — final verdict

Your §3 Q13/Q15 froze *globally unique across the entire ERP*. **My verdict:
change it to unique per organization.** Reasoning, strongest first:

1. **It contradicts §4 Q6.** You committed to complete tenant isolation. A
   shared sequence leaks volume between tenants: if a customer's codes jump from
   `STU0000455` to `STU0000892`, they have learned that other tenants issued
   ~437 students that week. That is a side-channel, and it is not fixable while
   the counter is shared.
2. **APAAR already does this job.** §1 Q6 makes APAAR first-class. APAAR *is* the
   national cross-institution student identifier. Your internal code does not
   need to compete with it — and never will, since yours is only unique across
   your customers, not across India.
3. **One counter row serialises student creation platform-wide.** Your own
   `numbering-review.md` §2C flags lock contention on a *per-branch* counter.
   Global is that, multiplied by customer count.
4. **UUID v7 is already globally unique** for any technical need.
5. **Every business case §3 listed** — transfers, central reporting, parent
   portal, certificates, alumni — is intra-organization.

**Format: `STU` + 10 digits** (`STU0000012345`), sequence per organization, no
year, no branch, no org code embedded — because §3 Q23 forbids the code changing
and §5 establishes that branch and year both change. Human-readable contextual
identity is `admissionNo`, which is branch+year scoped and *supposed* to vary.

### 1.3 Soft delete and encryption — how they combine

You said you lean toward soft delete, and that encrypting sensitive data would
be best. Those are not in tension; they solve different problems.

| Mechanism | Purpose | Applies to |
| :--- | :--- | :--- |
| **Soft delete** (`deletedAt`) | Operational. Reversible. Preserves foreign keys. | Everything. The default. |
| **Never delete** | Legal/academic record integrity (§3 Q7) | Student, Admission, Enrollment — no hard delete path exists at all |
| **Crypto-erasure** | Compliance. DPDP right to erasure. | Personal data only — the key is destroyed, the academic record survives intact and still reports |

So: soft delete is how staff work day to day; crypto-erasure is the rare legal
mechanism. Neither requires the other to change.

**Design consequence — a separate table.** Sensitive fields go in
`PersonSensitive`, 1:1 with Person, not as columns on Student. Four reasons:
one place to erase and prove it; encryptable as a unit; stricter row-level
access control; and it keeps the hot `Student` row narrow for the queries every
module will run.

**The blind-index pattern makes search survive encryption.** You must find
duplicates by Aadhaar, but Aadhaar is encrypted and therefore not searchable.
Store both:

- `Person.govtIdHash` = `HMAC(aadhaar, per-org pepper)` — searchable, exact
  match, not reversible.
- `PersonSensitive.aadhaarEnc` — the ciphertext, decrypted only on an authorised
  read.

Duplicate detection queries the hash and never touches the ciphertext. This is
the standard approach and it is why encryption does not have to wait.

---

## Part 2 — Where every fact lives (the no-repetition rule)

The discipline is one question per field: **what does this fact vary with?**

| Home | Holds facts that vary with… | Examples |
| :--- | :--- | :--- |
| `Person` | nothing — the human, forever | hashed govt ID, DOB, normalised name |
| `Applicant` | **one application, frozen at submission** | everything declared on the form, as declared |
| `Student` | the person's current official truth | current name, photo, category, status |
| `Admission` | one continuous spell of study | admissionNo, joining date, quota, type, exit |
| `Enrollment` | one academic year | program, class, section, roll number, result |

### Why Applicant keeps its own copy — and it is not duplication

`Applicant` already stores name, DOB, address, and demographics inline
(schema.prisma:155–198). **Keep every one of them exactly as they are.**

An applicant record is a *legal snapshot of what was declared on a date*. A
student record is *current truth*. They start equal and then diverge — a name
correction by affidavit, a category change after a certificate is obtained, a
house move. If Student referenced Applicant instead of copying, correcting a
name in 2029 would silently rewrite the 2026 application form. Those are two
different facts that happen to start with the same value, not one fact stored
twice.

### The promotion test

Promoting Riya from Std 9 to Std 10 writes **exactly one new row**:

```
Enrollment { admissionId, academicYearId, programId, academicUnitId,
             rollNumber, originType: PROMOTION, previousEnrollmentId }
```

Zero demographic fields copied. Zero identity fields copied. Her name, DOB,
Aadhaar, guardians, photo and address are untouched and unduplicated — twelve
years of schooling produce one Person, one Student, one Admission, and twelve
thin Enrollment rows. **If a future change ever requires copying a demographic
field into Enrollment, the design has broken — treat it as a red flag.**

---

## Part 3 — Provenance: "nothing should just appear"

Every structural row carries four provenance fields, and structural changes are
**never** in-place updates:

| Field | Purpose |
| :--- | :--- |
| `originType` | Why this row exists — `ADMISSION`, `PROMOTION`, `REPEAT`, `CORRECTION`, `TRANSFER`, `READMISSION`, `MIGRATION` |
| `previousEnrollmentId` / `previousAdmissionId` | What it came from |
| `supersededById` | What replaced it (set on the old row) |
| `changeReason` | Mandatory free text on every correction and transfer |

**Your Primary‑1 → Primary‑2 case, exactly:**

```
Enrollment A   Primary 1   status: SUPERSEDED
                           supersededById: B
                           changeReason: "wrong class selected at admission"
      │
      ▼
Enrollment B   Primary 2   status: ACTIVE
                           originType: CORRECTION
                           previousEnrollmentId: A
```

Row A is never edited and never deleted. A report can always answer *"was this
student moved, when, by whom, and why?"* — and a correction is distinguishable
from a genuine mid-year transfer, because `originType` differs.

The same shape covers promotion (`PROMOTED` → new row), repeat (`isRepeat`),
branch transfer (closes the Admission too), and readmission.

**Plus** a `WorkflowHistory` row for every transition, which requires
generalising that table from `applicantId` to polymorphic `(entityType,
entityId)` so Applicant, Admission and Enrollment share one audit engine.

---

## Part 4 — Invariants enforced by the database, not by services

"Flawless" means the database refuses to hold a wrong row, rather than every
service remembering to check. Two techniques carry most of the weight.

### 4.1 Composite foreign keys for consistency

A plain `studentId` column on Enrollment can drift from its Admission's student.
Making the parent's key composite removes the possibility:

```prisma
model Admission {
  id        String @id @default(uuid(7))
  studentId String
  branchId  String
  @@unique([id, studentId])   // enables the child reference below
  @@unique([id, branchId])
}

model Enrollment {
  admissionId String
  studentId   String          // denormalized for query speed…
  branchId    String
  admission   Admission @relation(fields: [admissionId, studentId], references: [id, studentId])
  @@unique([id, studentId])   // …and propagated to Attendance, Fees, Marks
}
```

An Enrollment whose `studentId` disagrees with its Admission is now
**unrepresentable**. The same pattern on `(id, branchId)` makes cross-branch
contamination structurally impossible — tenant isolation enforced by Postgres,
not by remembering a `WHERE` clause.

Downstream modules inherit this free: `Attendance` references
`(enrollmentId, studentId)`, so an attendance row can never name a student who
isn't in that enrollment.

### 4.2 Partial unique indexes

Prisma cannot express `WHERE` on a unique index, so these are appended as raw
SQL to the generated migration:

```sql
-- One ACTIVE admission per student
CREATE UNIQUE INDEX admission_one_active_per_student
  ON "Admission" ("studentId") WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

-- One PRIMARY enrollment per admission per academic year
CREATE UNIQUE INDEX enrollment_one_primary_per_year
  ON "Enrollment" ("admissionId", "academicYearId")
  WHERE "enrollmentKind" = 'PRIMARY' AND "deletedAt" IS NULL
    AND "enrollmentStatus" NOT IN ('SUPERSEDED','CANCELLED');

-- Roll number unique within a class/section for a year
CREATE UNIQUE INDEX enrollment_rollno_unique
  ON "Enrollment" ("academicUnitId", "academicYearId", "rollNumber")
  WHERE "rollNumber" IS NOT NULL AND "deletedAt" IS NULL;
```

Note the `SUPERSEDED` exclusion — without it, the Primary‑1 → Primary‑2
correction would violate the uniqueness rule.

### 4.3 Full invariant list

1. One `Student` per `Person` per organization — `@@unique([organizationId, personId])`
2. `studentCode` unique per organization — `@@unique([organizationId, studentCode])`
3. One `ACTIVE` Admission per Student (partial index)
4. One `PRIMARY` Enrollment per Admission per year (partial index)
5. Enrollment's student always equals its Admission's student (composite FK)
6. Enrollment's branch always equals its Admission's branch (composite FK)
7. `admissionNo` unique per branch — `@@unique([branchId, admissionNo])`
8. Roll number unique per class per year (partial index)
9. No Enrollment without an Admission; no Admission without a Student (required FKs)
10. No hard delete on Student, Admission, or Enrollment — no service method, no endpoint

---

## Part 5 — The downstream contract

The rule every future module follows. Getting this wrong is the expensive
mistake, so it goes in the docs and in code review:

| The fact is about… | Foreign key | Modules |
| :--- | :--- | :--- |
| the human | `personId` | guardian links, sibling discovery, DPDP consent |
| the permanent learner | `studentId` | documents, health, discipline, login, alumni |
| one spell of study | `admissionId` | transfer certificate, admission register |
| **one academic year** | **`enrollmentId` (+ `studentId`)** | **attendance, marks, fees, transport, hostel, library** |

Most modules attach to **Enrollment**, not Student — that is what makes
year-scoping automatic and stops a student's Std 9 attendance leaking into
Std 10. They carry `studentId` alongside for query speed, kept honest by the
composite FK from §4.1.

---

## Part 6 — Schema

Follow the modular convention (`docs/prisma-guide.md`): edit
`prisma/modules/**/*.prisma`, **never** `prisma/schema.prisma`, then
`npm run prisma:generate`.

**New files**

| File | Models |
| :--- | :--- |
| `prisma/modules/identity/person.prisma` | `Person`, `PersonSensitive` |
| `prisma/modules/identity/student.prisma` | `Student`, `StudentStatus` |
| `prisma/modules/admissions/admission.prisma` | `Admission`, `AdmissionType`, `AdmissionStatus`, `ExitReason` |
| `prisma/modules/academic/enrollment.prisma` | `Enrollment` + enums (replaces the admissions one) |
| `prisma/modules/admissions/applicant-preference.prisma` | `ApplicantProgramPreference` |

**`Person`** — organization-scoped. `id`, `organizationId`, `govtIdHash?`,
`phoneHash?`, `dob`, `nameNormalized`, timestamps.
`@@unique([organizationId, govtIdHash])`, indexed on `(organizationId, dob)` and
`(organizationId, nameNormalized)`.

**`PersonSensitive`** — `personId` PK, `aadhaarEnc`/`apaarIdEnc`/`penNoEnc` as
`Bytes?`, `keyVersion`, `erasedAt?`.

**`Student`** — `id`, `organizationId`, `branchId` (mutable pointer),
`personId`, `studentCode`, current demographic fields (mirroring Applicant's
shape), `status`, `sourceApplicantId?`, `createdVia`, `deletedAt?`.
Uniques: `[organizationId, studentCode]`, `[organizationId, personId]`,
plus `[id, branchId]` and `[id, organizationId]` to enable composite FKs.

**`Admission`** — as in §4.1, plus `admissionType`, `admissionDate`,
`entryProgramId`, `entryAcademicUnitId`, `quotaId?`, `admissionSourceId?`,
`sourceApplicantId?`, `previousAdmissionId?`, `exitDate?`, `exitReason?`,
`exitRemarks?`.

**`Enrollment`** — full rewrite of schema.prisma:264–291. Drops
`applicantId @unique` and its **`onDelete: Cascade`**. Adds `admissionId`,
`studentId`, `enrollmentKind`, `enrollmentStatus` (enum, replacing the free
`String`), `isRepeat`, `resultOutcome?`, and the four provenance fields from
Part 3. `applicantId` survives only as a nullable provenance column with no
cascade.

**Modified**

- `Applicant`: add `personId` (nullable during draft, required at submit),
  `programId` (required — your Q2 answer), and the statuses `WITHDRAWN`,
  `DEFERRED`, `SEAT_CONFIRMED`. Convert `admissionStatus` from `String` to a
  Prisma enum. **Demographic fields stay untouched** (Part 2).
- `WorkflowHistory`: `applicantId` → polymorphic `(entityType, entityId)`.
- `NumberSequenceConfig`: add `STUDENT_CODE` and `ADMISSION_NO` purposes, and
  an organization scope alongside the existing branch scope.

---

## Part 7 — Service layer

New module `src/modules/identity/` (`person/`, `student/`), and
`src/modules/admissions/admission/`. **Move** `src/modules/admissions/enrollment/`
→ `src/modules/academic/enrollment/` — after this change Enrollment is owned by
academics; Admissions only creates the first one.

**`PersonService.resolve(orgId, identifiers)`** — the find-or-create used by
both applicant creation and migration import. Returns the Person plus match
confidence, reusing the scoring approach already in
`ApplicantService.checkDuplicates`.

**`AdmissionService.admit(applicantId, dto)`** — the critical path. One Prisma
transaction, in order:

1. Assert applicant status is `SEAT_CONFIRMED`
2. Resolve or create `Person`
3. Assert no existing Student for that Person in the org (invariant 1)
4. Generate `studentCode` (org sequence) → create `Student`
5. Generate `admissionNo` (branch sequence) → create `Admission`
6. Create first `Enrollment`, `originType: ADMISSION`
7. Transition Applicant → `APPROVED` (terminal) via the workflow engine
8. Write `WorkflowHistory` rows
9. Publish `student.created`, `admission.created`, `enrollment.created`

Steps 4 and 5 must generate numbers **inside** the transaction to close the
gapless gap in `numbering-review.md` §2B — currently the counter increments
before the insert, so a failure leaves a hole. A permanent `studentCode` cannot
have holes or collisions.

**`EnrollmentService`** — `promote`, `correctPlacement`, `transferSection`,
`repeatYear`, all sharing one supersede-and-link helper so provenance can never
be forgotten. `correctPlacement` is your Primary‑1 → Primary‑2 path and requires
a non-empty `changeReason`.

**Events** — extend the existing `EventBus` (`docs/core/events.md`); a
`StudentCreatedEvent` example already exists at
`src/common/events/examples/student-created.event.ts`.

---

## Part 8 — Build order

Each step is independently testable.

1. `Person` + `PersonSensitive` + `PersonService.resolve` + blind-index helper
2. `Student` + org-scoped `studentCode` generation (transaction-safe)
3. `Admission` + branch-scoped `admissionNo`
4. `Enrollment` rewrite + partial indexes + composite FKs
5. `Applicant` changes: `personId`, `programId`, status enum, new statuses
6. `ApplicantProgramPreference`
7. Polymorphic `WorkflowHistory`
8. `AdmissionService.admit` transaction
9. `promote` / `correctPlacement` / `transferSection` / `repeatYear`
10. Branch transfer (`ORG_ADMIN`/`SUPER_ADMIN` only, mandatory reason)

Dev data only, so this is one clean migration per step rather than the
additive multi-step dance in `prisma-guide.md` §4 — that pattern applies once
you have customers.

---

## Verification

Nine scenarios. Each is an integration test; the model is correct only if all
nine pass.

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | Riya: Nursery 2026 → Std 10 in 2037 | 1 Person, 1 Student, 1 Admission, 12 Enrollments. `admissionNo` and `studentCode` never change. **Zero demographic fields duplicated across the 12 rows.** |
| 2 | **Admitted Primary 1, corrected to Primary 2** | Enrollment A `SUPERSEDED` with `supersededById` and `changeReason`; Enrollment B `ACTIVE`, `originType: CORRECTION`, `previousEnrollmentId: A`. A still readable. Partial index not violated. |
| 3 | Arjun fails Std 9, repeats | Same Admission, 2 Enrollments on Std 9, second `isRepeat: true`, `originType: REPEAT` |
| 4 | Sara transfers Mumbai → Pune | Same Person, Student and `studentCode`; Admission 1 closed `BRANCH_TRANSFER`; Admission 2 with a Pune `admissionNo`; `Student.branchId` moved. Rejected for a `BRANCH_ADMIN`. |
| 5 | Vikram drops out, returns after 2 years | **Person match finds the existing Student.** No second Student. Admission 2 `READMISSION` with `previousAdmissionId`. |
| 6 | Same child approved at two branches | Second `admit` fails on invariant 1. Not a crash — a resolvable conflict naming the existing student. |
| 7 | Approved applicant never pays, never joins | **Zero** Student rows, zero Admissions. Student count unaffected. |
| 8 | 50 concurrent `admit` calls | 50 distinct `studentCode`s, no gaps, no collisions, no deadlock. |
| 9 | Attempt to write an Enrollment whose `studentId` ≠ its Admission's | Rejected by Postgres, not by service code. Verify by attempting the raw SQL insert directly. |

Scenario 9 is the one that proves the composite-FK design actually works. Run it
as raw SQL, bypassing Prisma, or it proves nothing.

Then: `npm run prisma:validate`, `npx tsc --noEmit`, `npm run test:unit`.