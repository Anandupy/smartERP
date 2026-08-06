# Identity Core — Implementation Plan

`Person → Applicant → Student → Admission → Enrollment`

**Status: PLAN ONLY. Not approved for implementation.**

Companion to:
- [01-04-review-of-frozen-decisions.md](01-04-review-of-frozen-decisions.md)
- [05-06-admission-enrollment.md](05-06-admission-enrollment.md)
- [07-15-remaining-sections.md](07-15-remaining-sections.md)
- [16-27-missing-sections.md](16-27-missing-sections.md)

---

## Context

`studentId` becomes a permanent foreign key in every module ever written —
attendance, fees, examination, library, transport, certificates. It cannot be
refactored later without touching all of them. This plan freezes the identity
core before any dependent module is built.

Three requirements drive the design:

1. **No data repetition.** Promoting a student must not copy demographic data.
2. **Nothing just appears.** Every row records why it exists and what it came
   from. The Primary‑1 → Primary‑2 correction is the test case: a correction
   must remain visible *as* a correction, with a reason, forever.
3. **Broadly applicable.** Playgroup → Postgraduate, school and college, single
   and multi-branch, with no per-institution code paths.

Current state of `D:\ERP\backend`: development data only. There is no `Student`
model. `Enrollment` hangs off `applicantId @unique` with `onDelete: Cascade`
(`schema.prisma:271, 279`), meaning an applicant deletion can destroy an
academic record.

---

## Decisions locked

| Decision | Source |
| :--- | :--- |
| 4-layer model, Admission as its own entity | confirmed |
| `Student.branchId` is a **mutable pointer**, never part of identity | confirmed |
| Branch/organization transfer is rare, `ORG_ADMIN`/`SUPER_ADMIN` only | confirmed |
| **Enrollment = one per academic year.** Terms and exams sit inside the year and belong to the Examination module | confirmed |
| Student + Admission created at **seat confirmation / joining**, not at APPROVED | confirmed |
| Applicant carries a required `programId` **plus** an optional preference list | confirmed |
| Soft delete as the operational default; encryption for the sensitive subset | confirmed |

---

## Part 1 — Three design arguments

### 1.1 The Person layer

**What it is:** a deduplication index, not an entity with behaviour. Around
eight columns, no status, no lifecycle, no business rules.

**The case against it, first.** Most of what Person provides could be had by
making the existing duplicate check organization-scoped and cross-entity —
search Applicant *and* Student *and* Guardian. That is cheaper. So Person must
earn its place on the cases that workaround cannot cover:

| Scenario | Without Person | With Person |
| :--- | :--- | :--- |
| Rejected 2026, applies 2027 | Works — duplicate engine finds the old Applicant | Works |
| Sibling admission | Works — matched via guardian mobile | Works |
| **Dropped out, returns 3 years later** | **Fails.** The engine searches Applicants; this person is a *Student*. No match, second identity created. | Found |
| **Approved at two branches at once** | **Fails.** Check is branch-scoped. | Blocked by `@@unique([organizationId, personId])` |
| **Teacher whose child studies here** | Unlinkable | One Person, two roles — needed by §14 |
| **DPDP erasure** | Aadhaar in three tables; erase in three places and prove it | One row, one key |

The last three are structural and no query improvement fixes them.

**The real risk is sprawl.** Once Person exists there is pressure to move name,
address and photo onto it. That would be wrong — those change, and they change
*differently* for a student than for a guardian. The guard rule:

> **Person holds only what decides "is this the same human?"** — hashed
> government id, date of birth, normalised name, hashed phone. Nothing else.

Organization-scoped: §4 Q6 forbids a global registry.

### 1.2 Student Code scope

§3 Q13/Q15 froze *globally unique across the entire ERP*. **Recommendation:
narrow to unique per organization.**

1. **It contradicts §4 Q6.** A shared sequence leaks volume between tenants — a
   customer whose codes jump `STU0000455` → `STU0000892` has learned that other
   tenants issued ~437 students that week. Unfixable while the counter is shared.
2. **APAAR already fills this role.** §1 Q6 makes APAAR first-class, and APAAR
   *is* the national cross-institution identifier. An internal code was never
   going to be unique beyond your own customers.
3. **One counter row serialises student creation platform-wide.**
   `numbering-review.md` §2C already flags contention on a *per-branch* counter.
4. **UUID v7 remains globally unique** for any technical need.
5. **Every business case §3 listed is intra-organization.**

**Format: `STU` + 10 digits** (`STU0000012345`) — no year, no branch, no
organization, because §3 Q23 forbids the code changing while §5 establishes that
branch and year both do. The human-readable contextual identifier is
`admissionNo`, which is branch+year scoped and is *supposed* to vary.

### 1.3 Soft delete and encryption combined

| Mechanism | Purpose | Applies to |
| :--- | :--- | :--- |
| **Soft delete** (`deletedAt`) | Operational, reversible, preserves FKs | Everything — the default |
| **Never delete** | Academic/legal record integrity (§3 Q7) | Student, Admission, Enrollment — no hard-delete path exists |
| **Crypto-erasure** | DPDP right to erasure | Personal data only — destroy the key, the academic record survives |

Sensitive fields live in a separate `PersonSensitive` table rather than as
columns on Student, for four reasons: one row to erase and to produce as
evidence; encryptable as a unit; stricter access control; and it keeps the hot
`Student` row narrow.

**Blind index — how search survives encryption.** Duplicate detection must find
people by Aadhaar, but Aadhaar is encrypted and unsearchable. Store both:
`Person.govtIdHash` = `HMAC(pepper, organizationId + ":" + normalizedAadhaar)`
for exact-match lookup, and the ciphertext in `PersonSensitive` for authorised
reads. Mixing `organizationId` into the message means the same human at two
tenants produces unrelated digests.

Two properties are load-bearing: **normalization must never change** (`1234 5678
9012` and `123456789012` must always agree), and **the pepper must never change
once data exists** — altering it raises no error, it silently stops duplicate
detection from finding anyone.

---

## Part 2 — Where every fact lives

One question per field: **what does this fact vary with?**

| Home | Varies with… | Examples |
| :--- | :--- | :--- |
| `Person` | nothing — the human, forever | hashed govt id, DOB, normalised name |
| `Applicant` | one application, frozen at submission | everything declared on the form, as declared |
| `Student` | the person's current official truth | current name, photo, category, status |
| `Admission` | one continuous spell of study | admissionNo, joining date, quota, type, exit |
| `Enrollment` | one academic year | program, class/section, roll number, result |

### Why Applicant keeps its own copy — and why that is not duplication

`Applicant` stores name, DOB, address and demographics inline
(`schema.prisma:155–198`). **Keep all of them.**

An applicant record is a *legal snapshot of what was declared on a date*. A
student record is *current truth*. They begin equal and then diverge — a name
correction by affidavit, a category change once a certificate is obtained, a
house move. If Student merely referenced Applicant, correcting a name in 2029
would silently rewrite the 2026 application form. Two different facts that
happen to start with the same value.

### The promotion test

Promoting Riya from Std 9 to Std 10 writes **exactly one new row**:

```
Enrollment { admissionId, academicYearId, programId, academicUnitId,
             rollNumber, originType: PROMOTION, previousEnrollmentId }
```

Zero demographic fields copied. Twelve years of schooling produce one Person,
one Student, one Admission and twelve thin Enrollment rows.

> **If any future change requires copying a demographic field into Enrollment,
> the design has broken. Treat it as a red flag, not a convenience.**

---

## Part 3 — Provenance: "nothing should just appear"

Structural changes are **never** in-place updates. Every structural row carries:

| Field | Purpose |
| :--- | :--- |
| `originType` | Why the row exists — `ADMISSION`, `PROMOTION`, `REPEAT`, `CORRECTION`, `TRANSFER`, `READMISSION`, `MIGRATION` |
| `previousEnrollmentId` / `previousAdmissionId` | What it came from |
| `supersededById` | What replaced it (written on the old row) |
| `changeReason` | Mandatory on every correction and transfer |

**The Primary‑1 → Primary‑2 case:**

```
Enrollment A   Primary 1   status:        SUPERSEDED
                           supersededById: B
                           changeReason:  "wrong class selected at admission"
      │
      ▼
Enrollment B   Primary 2   status:              ACTIVE
                           originType:          CORRECTION
                           previousEnrollmentId: A
```

Row A is never edited and never deleted. Reports can always answer *"was this
student moved, when, by whom, and why?"* — and because `originType` differs, an
admin's **mistake** stays distinguishable from a genuine mid-year **transfer**.

The same mechanism covers promotion, repeat year, branch transfer and
readmission. Each transition additionally writes a `WorkflowHistory` row, which
requires generalising that table from `applicantId` to polymorphic
`(entityType, entityId)`.

---

## Part 4 — Invariants enforced by the database

"Flawless" means the database refuses to hold a wrong row, rather than every
service remembering to check.

### 4.1 Composite foreign keys

A plain `studentId` on Enrollment can drift from its Admission's student. A
composite parent key removes the possibility:

```prisma
model Admission {
  id        String @id @default(uuid(7))
  studentId String
  branchId  String
  @@unique([id, studentId])
  @@unique([id, branchId])
}

model Enrollment {
  admissionId String
  studentId   String   // denormalized for query speed…
  branchId    String
  admission   Admission @relation(fields: [admissionId, studentId], references: [id, studentId])
  @@unique([id, studentId])   // …and propagated to Attendance, Fees, Marks
}
```

An Enrollment whose `studentId` disagrees with its Admission becomes
**unrepresentable**. The same pattern on `(id, branchId)` makes cross-branch
contamination structurally impossible — tenant isolation enforced by Postgres
rather than by remembering a `WHERE` clause. Downstream modules inherit it:
`Attendance` references `(enrollmentId, studentId)`.

### 4.2 Partial unique indexes

Prisma cannot express `WHERE` on a unique index; these are appended as raw SQL
to the generated migration.

```sql
CREATE UNIQUE INDEX admission_one_active_per_student
  ON "Admission" ("studentId")
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX enrollment_one_primary_per_year
  ON "Enrollment" ("admissionId", "academicYearId")
  WHERE "enrollmentKind" = 'PRIMARY' AND "deletedAt" IS NULL
    AND "enrollmentStatus" NOT IN ('SUPERSEDED','CANCELLED');

CREATE UNIQUE INDEX enrollment_rollno_unique
  ON "Enrollment" ("academicUnitId", "academicYearId", "rollNumber")
  WHERE "rollNumber" IS NOT NULL AND "deletedAt" IS NULL;
```

The `SUPERSEDED` exclusion is essential — without it the Primary‑1 → Primary‑2
correction violates the uniqueness rule.

### 4.3 Full invariant list

1. One `Student` per `Person` per organization
2. `studentCode` unique per organization
3. One `ACTIVE` Admission per Student
4. One `PRIMARY` Enrollment per Admission per academic year
5. Enrollment's student always equals its Admission's student
6. Enrollment's branch always equals its Admission's branch
7. `admissionNo` unique per branch
8. Roll number unique per class per year
9. No Enrollment without an Admission; no Admission without a Student
10. No hard delete on Student, Admission or Enrollment — no method, no endpoint

---

## Part 5 — The downstream contract

The rule every future module follows. This belongs in code review.

| The fact is about… | Foreign key | Modules |
| :--- | :--- | :--- |
| the human | `personId` | guardian links, siblings, DPDP consent |
| the permanent learner | `studentId` | documents, health, discipline, login, alumni |
| one spell of study | `admissionId` | transfer certificate, admission register |
| **one academic year** | **`enrollmentId` (+ `studentId`)** | **attendance, marks, fees, transport, hostel, library** |

Most modules attach to **Enrollment**, not Student. That is what makes
year-scoping automatic and stops Std 9 attendance leaking into Std 10.

---

## Part 6 — Schema

Follow the modular convention (`docs/prisma-guide.md`): edit
`prisma/modules/**/*.prisma`, **never** `prisma/schema.prisma`.

**New files**

| File | Models |
| :--- | :--- |
| `prisma/modules/identity/person.prisma` | `Person`, `PersonSensitive` |
| `prisma/modules/identity/student.prisma` | `Student`, `StudentStatus` |
| `prisma/modules/admissions/admission.prisma` | `Admission` + enums |
| `prisma/modules/academic/enrollment.prisma` | `Enrollment` + enums (replaces the admissions one) |
| `prisma/modules/admissions/applicant-preference.prisma` | `ApplicantProgramPreference` |

**`Person`** — `id`, `organizationId`, `govtIdHash?`, `phoneHash?`, `dob`,
`nameNormalized`. `@@unique([organizationId, govtIdHash])`; indexed on
`(organizationId, dob)`, `(organizationId, nameNormalized)`,
`(organizationId, phoneHash)`.

**`PersonSensitive`** — `personId` PK, `aadhaarEnc` / `apaarIdEnc` / `penNoEnc`
as `Bytes?`, `keyVersion`, `erasedAt?`, `erasedBy?`.

**`Student`** — `id`, `organizationId`, `branchId` (mutable pointer),
`personId`, `studentCode`, current demographics, `status`, `sourceApplicantId?`,
`createdVia`, `deletedAt?`. Uniques: `[organizationId, studentCode]`,
`[organizationId, personId]`, plus `[id, branchId]` and `[id, organizationId]`
to enable composite FKs.

**`Admission`** — as §4.1, plus `admissionType`, `admissionDate`,
`entryProgramId`, `entryAcademicUnitId`, `quotaId?`, `admissionSourceId?`,
`sourceApplicantId?`, `previousAdmissionId?`, `exitDate?`, `exitReason?`,
`exitRemarks?`.

**`Enrollment`** — full rewrite of `schema.prisma:264–291`. Drops
`applicantId @unique` and its **`onDelete: Cascade`**. Adds `admissionId`,
`studentId`, `enrollmentKind`, `enrollmentStatus` (enum, replacing the free
`String`), `isRepeat`, `resultOutcome?`, and the four provenance fields.
`applicantId` survives only as a nullable provenance column with no cascade.

**Modified**

- `Applicant` — add `personId`, `programId`; add statuses `WITHDRAWN`,
  `DEFERRED`, `SEAT_CONFIRMED`; convert `admissionStatus` to a Prisma enum.
  **Demographic fields stay untouched** (Part 2).
- `WorkflowHistory` — `applicantId` → polymorphic `(entityType, entityId)`.
- `NumberSequenceConfig` — add `STUDENT_CODE` and `ADMISSION_NO`; add an
  organization scope alongside the branch scope.

**Environment** — field encryption and the blind index each need a secret.
`ENCRYPTION_KEY` already exists in `env.validation.ts` as optional and
"reserved, not consumed yet"; consuming it means promoting it to required and
adding a second, `IDENTITY_HASH_PEPPER`. Both services fail at DI time without
them, so leaving them optional only turns a clear startup message into an
obscure injection error. **This is a breaking environment change** — every
deployment and CI environment must set both before the app will boot.

---

## Part 7 — Service layer

New: `src/modules/identity/` (`person/`, `student/`) and
`src/modules/admissions/admission/`. **Move**
`src/modules/admissions/enrollment/` → `src/modules/academic/enrollment/` —
after this change Enrollment is owned by academics; Admissions only creates the
first one.

Crypto primitives belong in `src/common/crypto/`, mirroring the existing
`SecurityModule` pattern in `src/common/services/`: an `IdentityHashService`
(HMAC-SHA256 blind index plus name normalization) and a `FieldEncryptionService`
(AES-256-GCM, versioned wire format, HKDF key derivation).

**`PersonService.resolve(orgId, identifiers)`** — find-or-create, used by both
applicant creation and the future migration importer. Returns the Person plus a
match confidence, reusing the scoring already in
`ApplicantService.checkDuplicates`
(`src/modules/admissions/applicant/applicant.service.ts:62`).

**`AdmissionService.admit(applicantId, dto)`** — the critical path. One Prisma
transaction:

1. Assert applicant status is `SEAT_CONFIRMED`
2. Resolve or create `Person`
3. Assert no existing Student for that Person in the organization (invariant 1)
4. Generate `studentCode` (organization sequence) → create `Student`
5. Generate `admissionNo` (branch sequence) → create `Admission`
6. Create the first `Enrollment`, `originType: ADMISSION`
7. Transition the Applicant to `APPROVED` via the workflow engine
8. Write `WorkflowHistory` rows
9. Publish `student.created`, `admission.created`, `enrollment.created`

Steps 4–5 must generate numbers **inside** the transaction, closing the gap
documented in `numbering-review.md` §2B where the counter increments before the
insert. A permanent `studentCode` cannot have holes or collisions.

**`EnrollmentService`** — `promote`, `correctPlacement`, `transferSection`,
`repeatYear`, all sharing one supersede-and-link helper so provenance cannot be
forgotten. `correctPlacement` is the Primary‑1 → Primary‑2 path and requires a
non-empty `changeReason`.

**Events** — extend the existing `EventBus` (`docs/core/events.md`); a
`StudentCreatedEvent` example already exists under
`src/common/events/examples/`.

---

## Part 8 — Build order

Each step independently testable.

1. `Person` + `PersonSensitive` + crypto primitives + `PersonService.resolve`
2. `Student` + organization-scoped `studentCode` (transaction-safe)
3. `Admission` + branch-scoped `admissionNo`
4. `Enrollment` rewrite + partial indexes + composite FKs
5. `Applicant` changes: `personId`, `programId`, status enum, new statuses
6. `ApplicantProgramPreference`
7. Polymorphic `WorkflowHistory`
8. `AdmissionService.admit` transaction
9. `promote` / `correctPlacement` / `transferSection` / `repeatYear`
10. Branch transfer (`ORG_ADMIN`/`SUPER_ADMIN`, mandatory reason)

Development data only, so each step is one clean migration rather than the
additive multi-step sequence in `prisma-guide.md` §4 — that pattern applies once
there are customers.

---

## Verification

Nine scenarios as integration tests. The model is correct only if all nine pass.

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | Riya: Nursery 2026 → Std 10 in 2037 | 1 Person, 1 Student, 1 Admission, 12 Enrollments. `admissionNo` and `studentCode` never change. **Zero demographic fields duplicated across the 12 rows.** |
| 2 | **Admitted Primary 1, corrected to Primary 2** | A `SUPERSEDED` with `supersededById` + `changeReason`; B `ACTIVE`, `originType: CORRECTION`, `previousEnrollmentId: A`. A still readable. Partial index not violated. |
| 3 | Arjun fails Std 9, repeats | Same Admission, 2 Enrollments on Std 9, second `isRepeat: true` |
| 4 | Sara transfers Mumbai → Pune | Same Person, Student, `studentCode`. Admission 1 closed `BRANCH_TRANSFER`; Admission 2 with a Pune `admissionNo`; `Student.branchId` moved. Rejected for `BRANCH_ADMIN`. |
| 5 | Vikram drops out, returns after 2 years | **Person match finds the existing Student.** No second Student. Admission 2 `READMISSION` with `previousAdmissionId`. |
| 6 | Same child approved at two branches | Second `admit` fails on invariant 1 — a resolvable conflict naming the existing student, not a crash. |
| 7 | Approved applicant never pays, never joins | **Zero** Students, zero Admissions. Student count unaffected. |
| 8 | 50 concurrent `admit` calls | 50 distinct `studentCode`s, no gaps, no collisions, no deadlock. |
| 9 | Enrollment whose `studentId` ≠ its Admission's | Rejected by Postgres, not by service code. |

Scenario 9 proves the composite-FK design works, and **must be run as raw SQL
bypassing Prisma** — run through the ORM it proves nothing.

Also: `npm run prisma:validate`, `npx tsc --noEmit`, `npm run test:unit`.

Crypto needs its own unit tests before anything depends on it: encrypt/decrypt
round-trip, tamper detection, digest stability across `1234 5678 9012` vs
`123456789012`, and cross-organization digest divergence for one identifier.

---

## Appendix — working-tree state, 2026-08-06

A partial Step 1 was written before the decision to stay in planning. It is
**uncommitted and not migrated** — the database is untouched. Files:

- Added: `prisma/modules/identity/person.prisma`, `src/common/crypto/` (3 services)
- Modified: `organization.prisma`, `schema.prisma`, `app.module.ts`,
  `env.config.ts`, `env.validation.ts`, `.env.example`, and the gitignored
  `.env` / `.env.test`

`env.validation.ts` now requires `ENCRYPTION_KEY` and `IDENTITY_HASH_PEPPER`.
Local env files were populated, but **a fresh clone will not boot** until both
are set. Either revert these files or carry them forward deliberately when
implementation is approved.
