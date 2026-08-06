# I2 — Applicant

> **Status:** `planned` — §10 has two open questions
> **Depends on:** F1 (data protection), I1 (Person), Program, AcademicYear, admissions masters
> **Depended on by:** I3+I4+I5 (`admit()` consumes a `SEAT_CONFIRMED` applicant)

**This is a delta document.** `Applicant` exists and has running code
(`schema.prisma:146–259`, `src/modules/admissions/applicant/`,
`src/modules/admissions/workflow/`). Everything not listed as changing stays
exactly as it is.

---

## 1. Purpose

Applicant owns **one admission attempt** — a single application, to one branch,
for one academic year. It is temporary by design and terminal once resolved.

It does **not** own identity (that is Person), and it does **not** become a
Student — `admit()` creates a Student *from* it (I4).

**Its demographic fields are a frozen legal snapshot** of what was declared on
the form on a date. This is why Student carries its own copy rather than
referencing back: a name corrected by affidavit in 2029 must not silently
rewrite the 2026 application form. Two different facts that happen to start
equal.

---

## 2. Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | **Applicant gains `personId`, nullable in `DRAFT`, required from `SUBMITTED` onward** | Resolving a Person for every abandoned draft would pollute the identity index with people who never applied. |
| D2 | **Applicant gains a required `programId`**, plus an optional `ApplicantProgramPreference` list | Schools apply to one class and need no counselling; colleges rank preferences. One model serves both, and schools simply never create preference rows. |
| D3 | **`admissionStatus` becomes a Prisma enum** | It is a free `String` today (`schema.prisma:203`). The workflow engine validates transitions, but nothing stops a direct write of `"aproved"`. |
| D4 | **`aadhaarNo` is REMOVED from Applicant** | F1 D10: sensitive identifiers live once, on `PersonSensitive`, so erasure has one place to act. Applicant reaches Aadhaar through `personId`. Unlike a name, an Aadhaar is never "corrected" — a wrong one was simply wrong — so the frozen-snapshot argument does not apply to it. |
| D5 | **Three new states: `SEAT_CONFIRMED`, `DEFERRED`, `WITHDRAWN`** | §4 Q17/Q18, plus the seat-confirmation step `admit()` depends on. |
| D6 | **`APPROVED` is no longer terminal** | See §3.3 — this **corrects** frozen answer §4 Q20 and a statement in the I3+I4+I5 document. |
| D7 | **A deferred applicant does not carry into the next year. A new Applicant is created, linked back** | Reconciles §4 Q3 (a new academic year always creates a new Applicant) with §4 Q18 (deferment must not force a restart). The new application is pre-filled and fast-tracked; the old one stays a closed historical record. |
| D8 | **Withdrawal is available from every non-terminal state** | It is the applicant's decision and can happen at any point. Distinct from `CANCELLED`, which is the institution's decision (§4 Q17). |

---

## 3. Changes to the data model

### 3.1 `Applicant` — field changes only

| Change | Field | Detail |
| :--- | :--- | :--- |
| **add** | `personId` | `String?` — required from `SUBMITTED` (D1). Indexed. |
| **add** | `programId` | `String` — required, FK to Program (D2) |
| **add** | `offerIssuedAt`, `offerExpiresAt` | `DateTime?` — drives automatic offer expiry (§6.4) |
| **add** | `seatConfirmedAt` | `DateTime?` |
| **add** | `withdrawnAt`, `deferredAt` | `DateTime?` — matching the existing `submittedAt` / `approvedAt` pattern |
| **add** | `deferredFromApplicantId` | `String?` — links a re-application back to the deferred original (D7) |
| **change** | `admissionStatus` | `String` → `AdmissionApplicationStatus` enum (D3) |
| **remove** | `aadhaarNo` | Moves to `PersonSensitive` (D4). Existing index dropped. |

Everything else — names, DOB, address, previous education, demographics,
`admissionFormNo`, `applicationNo`, `apaarId`, `penNo`, custom fields — is
**unchanged**. Those are the frozen snapshot.

### 3.2 `ApplicantProgramPreference` — new

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID v7` | |
| `applicantId` | `String` | |
| `programId` | `String` | |
| `preferenceOrder` | `Int` | 1 = first choice |
| `status` | `PreferenceStatus` | `PENDING`, `OFFERED`, `DECLINED`, `ALLOTTED` |
| `remarks` | `String?` | |

`@@unique([applicantId, programId])` and `@@unique([applicantId, preferenceOrder])`.

At most one preference may reach `ALLOTTED` — enforced by a partial index — and
when one does, `Applicant.programId` is set to it. Only that program becomes an
Enrollment (§4 Q5).

### 3.3 The state machine

**Current** (`workflow.service.ts:18`): nine states, `APPROVED` terminal.
**New:** twelve states, with the offer→confirm→admit path made explicit.

```
[DRAFT] ──> [SUBMITTED] ──> [UNDER_REVIEW] ──┬──> [DOCUMENT_PENDING] ──┐
                                             ├──> [FEE_PENDING] ───────┤
                                             ├──> [WAITLISTED] ────────┤
                                             └─────────────────────────┴──> [APPROVED]
                                                                                │
                             [DEFERRED] <────────────────────────────────────────┤
                                                                                ▼
                                                                     [SEAT_CONFIRMED]
                                                                                │
                                                                                ▼
                                                                        [ADMITTED] ✦
```

`WITHDRAWN` is reachable from every non-terminal state (D8). `REJECTED` and
`CANCELLED` as today.

| Terminal | Notes |
| :--- | :--- |
| `ADMITTED` | Student, Admission and Enrollment now exist |
| `REJECTED` | |
| `WITHDRAWN` | Applicant's decision |
| `CANCELLED` | Conditionally terminal — reopenable only by an audited `SUPER_ADMIN` force transition (§4 Q20) |
| `DEFERRED` | Terminal **for this cycle**; continues via a new Applicant (D7) |

> ### ⚠️ This corrects two earlier statements
>
> Frozen answer **§4 Q20** lists `APPROVED` as terminal, and
> `03-05-admission-student-enrollment.md` §6.1 step 7 says `admit()` transitions
> the applicant to *"`APPROVED` (terminal)"*. Both are wrong once
> `SEAT_CONFIRMED` exists, because `APPROVED` must be able to move forward.
>
> `APPROVED` now means **"offer made, seat provisionally held"**.
> `ADMITTED` is the terminal state, set by `admit()`. The I3+I4+I5 document has
> been corrected to match.

---

## 4. Invariants

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | One active application per person per branch per year | `CREATE UNIQUE INDEX applicant_one_active ON "Applicant" ("personId","branchId","academicYearId") WHERE "personId" IS NOT NULL AND "deletedAt" IS NULL AND "admissionStatus" NOT IN ('REJECTED','WITHDRAWN','CANCELLED','DEFERRED')` — this is §4 Q2 ("one active application per academic year") made enforceable, which it was not before, because there was no `personId` to key it on |
| 2 | `personId` is present from `SUBMITTED` onward | `CHECK ("admissionStatus" = 'DRAFT' OR "personId" IS NOT NULL)` |
| 3 | Existing form/application number uniqueness | unchanged: `@@unique([branchId, academicYearId, admissionFormNo])`, likewise `applicationNo` |
| 4 | At most one `ALLOTTED` preference | `CREATE UNIQUE INDEX pref_one_allotted ON "ApplicantProgramPreference" ("applicantId") WHERE "status" = 'ALLOTTED'` |
| 5 | Soft delete only from `DRAFT` or `CANCELLED` | Already enforced in `ApplicantService.remove` — extend to the new statuses |
| 6 | Status changes only through the workflow engine | No direct write path, including for administrators (§4 Q19) |

Invariant 1 is the significant addition: today "one application per year" is a
convention nothing enforces.

---

## 5. Provenance

Applicant rows are **never superseded** — unlike Enrollment, each application is
its own historical record and a new attempt is a new row.

| Link | Meaning |
| :--- | :--- |
| `deferredFromApplicantId` | This application continues a deferred one from an earlier year (D7) |
| `Student.sourceApplicantId` | Which application produced the student |
| `Enrollment.applicantId` | Provenance only — **nullable, no cascade** |

`WorkflowHistory` already records every transition with `oldStatus`, `newStatus`,
`actionType`, `remarks` and `actionBy` (`schema.prisma:629`). It becomes
polymorphic in I3+I4+I5 so Admission and Enrollment share it; **Applicant's
existing rows must migrate to the new shape**, not be left behind on the old
column.

---

## 6. Lifecycle notes

### 6.1 Person resolution at submit

`DRAFT → SUBMITTED` calls `PersonService.resolve()` (I1) and stores `personId`.
Duplicate candidates come back as **non-blocking warnings** (§4 Q14). If a Person
already has an active application at this branch for this year, invariant 1
rejects the submission with a conflict naming the existing application — which
is §4 Q2's *"An application already exists for this Academic Year"* message,
now actually enforced.

### 6.2 Approval and offer

`UNDER_REVIEW → APPROVED` sets `offerIssuedAt` and computes `offerExpiresAt`
from branch configuration (F2).

### 6.3 Seat confirmation

`APPROVED → SEAT_CONFIRMED`, normally triggered by admission-fee payment.
This is the only state `admit()` accepts.

### 6.4 Offer expiry

A scheduled job moves expired `APPROVED` applications to `CANCELLED` with
`cancellationReason: OFFER_EXPIRED` — **through the workflow engine**, never a
direct database write (§4 Q19). Each expiry writes a `WorkflowHistory` row like
any other transition.

### 6.5 Deferment

`APPROVED → DEFERRED` holds a seat reservation with an expiry. In the next
academic year a **new** Applicant is created with `deferredFromApplicantId` set,
pre-filled from the original and fast-tracked past re-verification if branch
configuration allows (D7).

---

## 7. API surface

Existing endpoints under `/v1/admissions/applicants` keep their shapes. Changes:

| Method | Path | Change |
| :--- | :--- | :--- |
| `POST` | `/applicants` | `programId` now required; `aadhaarNo` no longer accepted here |
| `POST` | `/applicants/:id/workflow` | Accepts the three new target states |
| `GET` | `/applicants/:id` | Returns `personId` and preferences; **never** a full Aadhaar — that is F1's separately-permissioned endpoint |
| `POST` | `/applicants/:id/preferences` | **New** — manage program preferences |
| `POST` | `/applicants/:id/defer` | **New** — deferment with a reason |
| `POST` | `/applicants/:id/withdraw` | **New** — applicant-initiated withdrawal |

`check-duplicates` (`applicant.service.ts:62`) is **replaced** by
`PersonService.findCandidates()`. Its current logic is branch-scoped and
searches only Applicants, so it cannot see a returning dropout who is already a
Student — the defect that motivated Person.

| Rule broken | Status | `error.code` |
| :--- | :--- | :--- |
| Active application already exists (invariant 1) | `409` | `ConflictException` |
| Submitting without a resolvable Person | `400` | `BadRequestException` |
| Invalid transition | `400` | `BadRequestException` (unchanged) |
| Editing a terminal applicant | `403` | `ForbiddenException` (unchanged) |

---

## 8. Events

Existing: `applicant.created`, `applicant.updated`, `applicant.deleted`,
`admission.transitioned`.

| New event | When |
| :--- | :--- |
| `applicant.person_resolved` | `personId` bound at submit |
| `applicant.offer_issued` | Entering `APPROVED` |
| `applicant.offer_expired` | Expiry job cancels an offer |
| `applicant.seat_confirmed` | Entering `SEAT_CONFIRMED` |
| `applicant.deferred` | Entering `DEFERRED` |
| `applicant.withdrawn` | Entering `WITHDRAWN` |

`applicant.seat_confirmed` is what a seat-allocation module would consume;
`applicant.offer_expired` is what releases the held seat back to the waitlist.

---

## 9. Dependencies

**Requires:** F1, I1, Program, AcademicYear, and the existing masters.

**Depended on by:** `admit()` (I3+I4+I5) consumes a `SEAT_CONFIRMED` applicant
and writes back `ADMITTED`.

### Migration work

Development data only, so this is one clean migration — but it is not trivial:

1. Add `personId`, `programId` and the new timestamp columns as nullable
2. Backfill `personId` by running existing applicants through
   `PersonService.resolve()`, hashing `aadhaarNo` into `Person.govtIdHash` and
   encrypting the value into `PersonSensitive` (F1)
3. Backfill `programId` — **needs a source.** Today program only appears on
   `Enrollment`, so applicants without an enrollment have no program to copy.
   See §10 Q1.
4. Drop `Applicant.aadhaarNo` and its index
5. Convert `admissionStatus` to the enum; existing values map one-to-one
6. Migrate `WorkflowHistory` to the polymorphic shape

> **The same migration must move `Guardian.aadhaarNo`** (`schema.prisma:296`),
> which is also plaintext today. Leaving it behind would defeat F1 — one
> plaintext copy is as bad as three.

---

## 10. Open questions

| # | Question | Blocks | Options |
| :--- | :--- | :--- | :--- |
| **Q1** | **How is `programId` backfilled for existing applicants?** | Making the column required | Program lives only on Enrollment today, so an applicant who never enrolled has no program. Options: (a) leave `programId` nullable for pre-migration rows and required for new ones — honest, but the constraint is then not a real invariant; (b) require an operator to assign programs before migrating; (c) since this is development data, **delete existing applicants and start clean**. **Recommendation: (c)** — it is dev data, and a nullable-for-legacy column is a permanent scar for a temporary problem. |
| **Q2** | **Is a deferred applicant's seat held against the seat matrix?** | Deferment and waitlist interaction | If the seat is held, the branch runs one place short for a year and the waitlist cannot draw on it. If it is released, the deferred applicant may return to no seat — which makes the deferment worthless. **Recommendation: configurable per branch, defaulting to held with an expiry**, matching §4 Q18's "Seat Reservation Enabled / Seat Reservation Expiry" settings. Needs confirmation this is the intended reading. |

---

## 11. Acceptance scenarios

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | Same person applies twice to one branch in one year | Second submission `409` naming the first application (invariant 1) |
| 2 | Same person applies to two different branches | **Both allowed** — separate Applicants, one Person (§4 Q4) |
| 3 | Rejected in 2026, applies again in 2027 | New Applicant; the 2026 record stays readable; Person matched, so history is visible to the reviewer |
| 4 | Draft abandoned, never submitted | **No Person created** (D1) |
| 5 | College applicant ranks three programs, one allotted | One `ALLOTTED` preference; `Applicant.programId` set to it; a second `ALLOTTED` is rejected (invariant 4) |
| 6 | School applicant | `programId` set directly, **zero** preference rows |
| 7 | Offer expires unclaimed | Status `CANCELLED`, reason `OFFER_EXPIRED`, `WorkflowHistory` row written, `applicant.offer_expired` published |
| 8 | Applicant withdraws while `DOCUMENT_PENDING` | `WITHDRAWN`, distinct from `CANCELLED` in reporting |
| 9 | Approved 2026, deferred, returns 2027 | 2026 applicant stays `DEFERRED`; a **new** 2027 Applicant carries `deferredFromApplicantId`; same Person; same eventual `studentCode` |
| 10 | `SEAT_CONFIRMED` applicant is admitted | Status `ADMITTED` — **not `APPROVED`** (D6) |
| 11 | `admit()` on an applicant still in `APPROVED` | Rejected — only `SEAT_CONFIRMED` is admissible |
| 12 | **Raw SQL**: set `admissionStatus` to `'aproved'` | Rejected by the enum (D3) |
| 13 | **Raw SQL**: insert a `SUBMITTED` applicant with null `personId` | Rejected (invariant 2) |
| 14 | Read an applicant record | No Aadhaar in the response under any role — only via F1's permissioned endpoint |

Scenarios 12–14 prove the design. 12 and 13 must run as raw SQL; through the
service layer they prove only that today's code is careful.
