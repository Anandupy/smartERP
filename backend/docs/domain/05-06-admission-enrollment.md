# CampusFlow ERP — Sections 5 & 6 Design Guidance (Admission + Enrollment)

## Context

Your Q&A document (`ERP QUESTIONS AND ANSWERS.docx`) has frozen Sections 1–4:
Vision, Organization Structure, Student Identity, and Applicant. Sections 5
(Admission, 20 Q) and 6 (Enrollment, 25 Q) are unanswered — this document
answers them.

This is **not** a greenfield exercise. `D:\ERP\backend` already implements
Admissions Phase 1, and the current schema **contradicts decisions you already
froze in Section 3**. Sections 5 and 6 therefore decide a schema rewrite, not
just documentation. The gaps as of today:

| Frozen decision | Reality in `prisma/schema.prisma` |
| :--- | :--- |
| §3: Student is the permanent identity | **No `Student` model exists at all** |
| §3: Enrollment carries academic placement, Student carries identity | `Enrollment.applicantId` is `@unique` with `onDelete: Cascade` — one enrollment per *applicant*, forever; deleting an applicant destroys the academic record (schema.prisma:271, :279) |
| §3: centralized Numbering & Identity Engine | Exists but only for admissions purposes; not gapless (see `docs/admissions/numbering-review.md` §2B) |
| §4 Q5: `ApplicantProgramPreference` with preference order | `Applicant` has **no `programId` at all**; program first appears on `Enrollment` |
| §4 Q17/Q18: `WITHDRAWN` and `DEFERRED` statuses | Not in the workflow matrix (`docs/modules/admissions.md` §5) |
| §4 Q19: all transitions via Workflow Engine | `admissionStatus` is a free `String`, not a Prisma enum (schema.prisma:203) |
| §4 Q13: Applicant merge | Not implemented |

`Enrollment.futureStudentId String?` (schema.prisma:272) is a placeholder that
confirms this bridge was always intended.

---

## Decisions taken (from your answers)

1. **4-layer model.** `Applicant → Student → Admission → Enrollment`.
2. **Student is branch-scoped** — `Student.branchId` is present, and reads/guards
   are branch-isolated like every other entity.
3. **Branch and organization transfer is rare and privileged** — `ORG_ADMIN` and
   `SUPER_ADMIN` only.
4. **Enrollment = one per academic year.** A student is in one grade for the
   whole year; terms and exams sit *inside* that year and belong to the
   Examination module, not to Enrollment. Promotion next year creates the next
   Enrollment.

### Assumption requiring your confirmation

Branch-scoped Student and §3 Q21/Q23 ("identity and Student Code must never
change on branch transfer") can only both hold if:

> `Student.branchId` is a **mutable pointer**, not part of the student's
> identity. A branch transfer is a privileged `UPDATE` of that pointer plus a
> new Admission. The Student row is **never** recreated, and the Student Code
> **never** changes.

Everything below assumes this. If you actually meant *"transfer creates a new
Student row linked to the old one"*, say so — it invalidates §3 Q21/Q23 and
changes roughly a third of this design.

---

## The model

```
Applicant                one admission attempt: one branch, one academic year
    │                    temporary; terminal on APPROVED (§4)
    │  approval (single atomic transaction, §3 Q3)
    ▼
Student                  permanent identity. studentCode, UUID v7.
    │                    branchId is a mutable pointer, not identity.
    │                    Never deleted; lifecycle statuses only (§3 Q7/Q8).
    ▼
Admission                ONE CONTINUOUS SPELL OF STUDY in one branch.
    │                    admissionNo, joiningDate, admissionType, quota,
    │                    entry level, exit date + exit reason (TC).
    │                    A student may have several over a lifetime.
    ▼
Enrollment               ONE PER ACADEMIC YEAR under an Admission.
                         programId, academicUnitId (class/section), rollNumber,
                         enrollmentStatus, result outcome.
```

**Why Admission must exist as its own layer:** Applicant is per-cycle and dies
at approval. Enrollment is per-year and dies at promotion. Neither can hold
*"this person joined this branch on this date, under this quota, via this
source, at this entry level, and left on that date for that reason."* That is
precisely the record a Transfer Certificate is issued against, and it is what
`admissionNo` identifies. Nursery→10th is **one Admission with twelve
Enrollments**; the admission number is stable while the roll number changes
every year.

---

## SECTION 5 — Admission (20 answers)

| # | Question | Decision |
| :--- | :--- | :--- |
| 1 | One admission per student? | **No.** One *active* admission per student at a time. Enforce with a partial unique index on `(studentId)` where `status = ACTIVE`. |
| 2 | Multiple admissions? | **Yes**, sequentially over a lifetime: readmission, branch transfer, school→junior college inside the same org. |
| 3 | Nursery → 10th = one admission? | **One Admission, twelve Enrollments.** This is the central test of the model. |
| 4 | College after school = new admission? | **Yes** — a new Admission when `Program.level` changes (the `ProgramLevel` enum already exists, schema.prisma:108). Same Student, same Student Code, `previousAdmissionId` links them. |
| 5 | Branch transfer? | **New Admission.** Closes the old one with `exitReason = BRANCH_TRANSFER`, opens a new one under the new branch, and moves `Student.branchId`. Required because `admissionNo` is branch-scoped numbering (§2 Q11) and fee structures are branch-scoped (§2 Q3). **Restricted to `ORG_ADMIN` / `SUPER_ADMIN`**, mandatory reason, fully audited. |
| 6 | Readmission? | **New Admission**, `admissionType = READMISSION`, `previousAdmissionId` set. Student Code unchanged. Resolves §3 Q6, which was left as R&D. |
| 7 | Lateral entry? | **No special modelling.** `admissionType = LATERAL_ENTRY` plus `entryAcademicUnitId` = the level actually joined. |
| 8 | Migration? | `admissionType = MIGRATION` (from another board/university). Migration certificate becomes a required document-checklist item for this type. |
| 9 | Internal transfer (program/stream change, same branch)? | **Same Admission.** Only the next Enrollment's `programId` changes. Science→Commerce in 11th must not inflate admission counts. |
| 10 | External transfer (from another institution)? | **New Admission**, `admissionType = TRANSFER`. Prior institution is already captured in the Applicant's previous-education block (schema.prisma:194–198). |
| 11 | Admission Source mandatory? | **Configurable per branch.** Default: optional at `DRAFT`, required at `SUBMITTED`. `AdmissionSource` master already exists. |
| 12 | Admission Type mandatory? | **Yes, always**, defaulting to `REGULAR`. Make it a **Prisma enum**, not a master table — workflow, document checklists, and fee rules branch on it, so it must not be user-editable free text. |
| 13 | Quota mandatory? | **Configurable per branch** (`quotaRequired: bool`). `Quota` master exists. Pair it with a per-quota seat matrix (see #15). |
| 14 | Scholarship during admission? | **Capture intent only.** Record eligibility/concession category on the Applicant. The actual award, sanction, and disbursal belong to the Finance module. Do not build scholarship logic inside Admissions. |
| 15 | Seat reservation? | **Yes** — required to make the `DEFERRED` status you froze in §4 Q18 work. Model `SeatAllocation` (program + academicUnit + quota + capacity) with `reservedUntil` expiry. |
| 16 | Waiting list? | `WAITLISTED` status already exists. Add `waitlistRank` and auto-promotion when a confirmed seat is released. |
| 17 | Offer expiry? | **Yes.** `offerIssuedAt`, `offerExpiresAt`, branch config `offerValidityDays`. A scheduled job moves expired offers to `CANCELLED` with `cancellationReason = OFFER_EXPIRED` — **through the Workflow Engine**, never a direct DB write (§4 Q19). |
| 18 | Seat confirmation? | **Yes, an explicit step** between approval and Enrollment, normally triggered by admission-fee payment. Recommend a `SEAT_CONFIRMED` status so "approved but not yet paid" and "paid, seat locked" are distinguishable in reports. |
| 19 | Admission cancellation? | **Two genuinely different things — do not merge them.** (a) Cancelling the *application* → `Applicant.CANCELLED`, no Student created. (b) Cancelling the *admission after joining* → `Admission.status = CANCELLED`, active Enrollment voided, triggers fee refund and TC issuance. Only (a) exists today. |
| 20 | Admission audit trail? | **Yes.** Generalize the existing `WorkflowHistory` from `applicantId`-bound (schema.prisma:629) to **polymorphic** `(entityType, entityId)` so Applicant, Admission, and Enrollment all share one workflow/audit engine. |

---

## SECTION 6 — Enrollment (25 answers)

| # | Question | Decision |
| :--- | :--- | :--- |
| 1 | One enrollment per academic year? | **Yes.** Partial unique index on `(admissionId, academicYearId)` where `deletedAt IS NULL` and `kind = PRIMARY`. |
| 2 | Multiple enrollments? | Only sequentially across years — plus optional `SECONDARY` enrollments (see #15). |
| 3 | Program changes? | **New Enrollment row supersedes the old**, via `supersededById`. Old row → `TRANSFERRED`. Never an in-place edit — attendance and marks already point at the old row. |
| 4 | Section changes? | **In-place edit of `academicUnitId` is allowed**, but must write an audit row. This is common and non-structural. ⚠️ See open question Q3 below — attendance/marks already recorded against the old section need a stated policy. |
| 5 | Roll number changes? | Editable until the year's roll list is **locked**; immutable after. Branch config `rollNumberStrategy: MANUAL \| SEQUENTIAL \| ALPHABETICAL_ON_LOCK`. |
| 6 | Enrollment immutable? | **No** — mutable while `ACTIVE`. Frozen when the academic year is locked (`AcademicYear.isLocked` already exists) or the enrollment reaches a terminal status. |
| 7 | Can a completed enrollment be edited? | **No.** `SUPER_ADMIN` force-correction only, mandatory reason, full audit — same pattern as §4 Q19. |
| 8 | Promotion creates new enrollment? | **Yes, always.** Old → `PROMOTED`; new row for the next academic year under the **same Admission**. |
| 9 | Transfer creates new enrollment? | **Yes** — and also a new Admission when the branch changes (§5 #5). |
| 10 | Readmission creates new enrollment? | **Yes**, under a new Admission (§5 #6). |
| 11 | Semester-based? | Enrollment stays **yearly**. Semesters are exam/assessment periods handled by the Examination module against the year's Enrollment. |
| 12 | Year-based? | **Yes — this is the canonical unit.** Your decision. |
| 13 | Trimester? | Same as #11 — a term count, not an enrollment shape. |
| 14 | Open learning / distance? | Same Enrollment shape. `Program.structureMode` (the `StructureMode` enum already exists, schema.prisma:1252) carries the mode; §1 Q14 requires regular and distance to coexist in one branch. |
| 15 | Multiple enrollments simultaneously? | **One `PRIMARY` per admission per year — hard rule.** Add `enrollmentKind: PRIMARY \| SECONDARY` so NEP add-on / certificate / elective courses can attach without breaking the uniqueness rule. Phase 2. |
| 16 | Cross-program enrollment? | Handled by `SECONDARY` above. Required by NEP 2020 multidisciplinary credits (§1 Q7). Phase 2. |
| 17 | Enrollment status? | Enum: `PENDING`, `ACTIVE`, `ON_BREAK`, `PROMOTED`, `DETAINED`, `COMPLETED`, `TRANSFERRED`, `DROPPED_OUT`, `CANCELLED`. Replaces today's free `String` (schema.prisma:274). |
| 18 | Suspension? | **Should NOT be an enrollment status.** A suspended student is still enrolled and still owes fees. Model a separate `DisciplinaryAction` with a date range. ⚠️ See open question Q2 below. |
| 19 | Completion? | Terminal status + `resultOutcome` (`PASS` / `FAIL` / `PROMOTED` / `DETAINED`), written by the Examination module at year end. |
| 20 | Dropout? | `DROPPED_OUT` + `exitDate` + `exitReason`. Also closes the parent Admission. |
| 21 | Repeat year? | New Enrollment for the new academic year pointing at the **same** `academicUnitId`, with `isRepeat = true`. Same Admission. |
| 22 | Academic break? | **Do not create a phantom Enrollment.** A gap year = simply no Enrollment row for that year, with `Admission.status = ON_HOLD`. Cleaner than an empty enrollment that attendance and fees would have to special-case. |
| 23 | Exchange program? | Phase 3. `enrollmentKind = EXCHANGE` plus an external-institution reference. |
| 24 | Enrollment history? | **The row set *is* the history.** Rows are append-only and never deleted. No separate history table needed. |
| 25 | Enrollment versioning? | **No per-row versioning.** Append-only plus `supersededById` gives full lineage. Row versioning here is over-engineering. |

---

## Schema changes this implies

Grouped by risk. Items 1–3 are breaking and must land together in one migration.

**1. New models**
- `Student` — `id` (UUID v7), `organizationId`, `branchId` (mutable pointer),
  `studentCode` (globally unique, immutable), demographic fields promoted from
  `Applicant`, `status` (`ACTIVE`/`GRADUATED`/`WITHDRAWN`/`EXPELLED`/`ARCHIVED`),
  `sourceApplicantId` (nullable — §3 Q4 permits Migration Mode without an
  applicant).
- `Admission` — `studentId`, `branchId`, `admissionNo`, `admissionType` (enum),
  `admissionDate`, `entryProgramId`, `entryAcademicUnitId`, `quotaId`,
  `admissionSourceId`, `status`, `exitDate`, `exitReason`, `previousAdmissionId`.
- `ApplicantProgramPreference` — closes the §4 Q5 gap. `applicantId`,
  `programId`, `preferenceOrder`, `status`.
- `SeatAllocation`, `DisciplinaryAction` — per §5 #15 and §6 #18.

**2. Rewrite `Enrollment`** (schema.prisma:264–291)
- Drop `applicantId @unique` and its `onDelete: Cascade`. **The cascade is the
  most dangerous line in the current schema** — it lets an applicant deletion
  destroy an academic record.
- Add `admissionId` (required), `studentId` (denormalized for query
  performance), `enrollmentKind`, `isRepeat`, `resultOutcome`, `supersededById`,
  `exitDate`, `exitReason`.
- Keep `applicantId` as a **nullable provenance field only**, no cascade.
- Partial unique index on `(admissionId, academicYearId)`.

**3. Generalize `WorkflowHistory`** (schema.prisma:629) from `applicantId` to
polymorphic `(entityType, entityId)`, so one workflow engine serves Applicant,
Admission, and Enrollment.

**4. Non-breaking hardening** (can follow separately)
- `Applicant.admissionStatus` → Prisma enum; add `WITHDRAWN`, `DEFERRED`,
  `SEAT_CONFIRMED` to the enum and to `VALID_TRANSITIONS`.
- Fix the gapless-numbering and rollback gaps in
  `docs/admissions/numbering-review.md` §2B **before** `studentCode` generation
  is built on the same engine — a gap in a form number is cosmetic, a gap or
  collision in a permanent Student Code is not.
- Fix the untransacted `isPrimary` guardian toggle flagged in
  `docs/admissions/admissions-production-audit.md` §4.

**5. Module relocation**
`Enrollment` currently lives in `src/modules/admissions/enrollment/`. After this
change it is owned by Student Management, not Admissions — Admissions only
*creates* the first one. Plan the move; leaving it under `admissions/` will
push every future promotion, transfer, and result feature into the wrong module.

---

## Student Code — closing the §3 R&D items

§3 left Q16–Q20 open (year? branch? organization? numeric? alphanumeric?). The
decisions above settle them, because Admission now carries everything volatile:

> **`STU` + 10-digit zero-padded global sequence** — e.g. `STU0000012345`.
> No year, no branch, no organization.

Branch and organization are excluded because they change (§5 #5) and §3 Q23
forbids the code changing. Year is excluded because §3 Q16 correctly notes it
looks stale decades later — and the joining year is already on `Admission`, which
is where it belongs. Alphanumeric prefix is chosen over pure numeric for
readability at help desks and on ID cards (§3 Q20). Human-readable *contextual*
identifiers (`MUM-2026-0042`) remain available as `admissionNo`, which is
branch- and year-scoped by design and is allowed to vary.

---

## Open questions — my remaining doubts

These do **not** block starting; they block finalizing specific rules.

**Q1 — The two-branch approval collision.** §4 Q4 says applying to a different
branch creates a new Applicant. If the same person is approved at both Mumbai
and Pune, you get two Students for one human being, which breaks §3 Q5 ("one
applicant → one student, one permanent identity"). Approval must therefore run
an identity-resolution check first. Which do you want?
  - (a) Block the second approval and force an admin merge, or
  - (b) Allow both, then reconcile via the Applicant-merge tool from §4 Q13.

**Q2 — Suspension.** I've recommended it be a `DisciplinaryAction`, not an
enrollment status, because a suspended student still occupies a seat and still
owes fees. Your Section 3 status list includes `SUSPENDED` at the *Student*
level. Confirm: disciplinary action with a date range (my recommendation), or a
genuine Student status?

**Q3 — Mid-year section change.** When a student moves Div A → Div B in
February, what happens to the attendance and marks already recorded against Div
A? Options: (a) history stays with Div A and only future records go to Div B
(my recommendation, and the only auditable one), (b) recompute everything under
Div B, (c) forbid section changes after a configurable cut-off date.

**Q4 — Organization transfer.** §3 Q22 left this as R&D and I have deliberately
not designed it. It is genuinely rare, and it collides with §4 Q6's absolute
tenant isolation ("no global applicant registry"). My recommendation: **declare
it out of scope for v1** and handle the rare real case as an export/import
between tenants. Confirm, or tell me to design it.

**Q5 — Where should this document live?** It currently sits in the plan file.
It belongs in `D:\ERP\backend\docs\` alongside the other module docs — say
where, and whether you also want the `.docx` Sections 5 & 6 filled in to match
the format of Sections 1–4.

---

## Verification

There is no code to run — this phase is design. Validate the model against
these six scenarios before writing any migration. If all six read cleanly, the
model holds:

1. **Riya joins Nursery 2026, reaches Std 10 in 2037.** → 1 Student, 1 Admission,
   12 Enrollments. `admissionNo` never changes; `rollNumber` changes yearly.
2. **Arjun fails Std 9 and repeats it.** → Same Admission, 2 Enrollments both
   pointing at Std 9, second with `isRepeat = true`.
3. **Sara moves Mumbai → Pune (ORG_ADMIN action).** → Same Student, same Student
   Code; Admission #1 closed with `exitReason = BRANCH_TRANSFER`; Admission #2
   opened with a Pune-scoped `admissionNo`; `Student.branchId` updated.
4. **Vikram drops out in Std 11, returns two years later.** → Same Student;
   Admission #1 `CANCELLED`; Admission #2 `admissionType = READMISSION` with
   `previousAdmissionId` set.
5. **Priya switches Science → Commerce in Std 11, same school.** → Same
   Admission; Enrollment superseded, old row `TRANSFERRED`, new row with the
   new `programId`.
6. **Applicant approved, then the admission is cancelled before joining.** →
   Student exists, Admission `CANCELLED`, **zero** Enrollments, refund workflow
   fires. Verify no module assumes a Student always has at least one Enrollment.

Scenario 6 is the one most likely to break downstream modules — check it
explicitly against Fees and Attendance assumptions.
