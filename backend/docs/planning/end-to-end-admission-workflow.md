# End-to-End Admission Workflow — Applicant to Active Student

> **Purpose of this document:** answer, precisely and against the actual backend implementation, "A real person wants admission. What exactly happens in CampusFlow from the first application until they become a Student, and what happens if something goes wrong?"
>
> This is a **trace**, not a design proposal. Every claim below is either backed by a file:line citation into the current codebase, or explicitly marked as a discrepancy between documentation and implementation. Where the implementation and the planning docs disagree, both are shown, and the actual code is treated as the source of truth for "what CampusFlow does today."

---

## 1. Purpose

CampusFlow's admissions module takes a person from first contact (an application form) to an active academic record (Student + Admission + Enrollment) through a governed, auditable, transactional pipeline. This document traces that pipeline end-to-end using one realistic applicant, cites the exact services/models/transactions involved, and separates **what is implemented** from **what is documented-but-not-built** and **what is genuinely undecided**.

It is written for backend developers, frontend developers, QA engineers, admin/product users, and developers of future downstream modules (Fees, Attendance, Examination, Transport, Library, Parent Portal) who need to know what identifiers and entities they can rely on.

## 2. Scope

In scope: `Applicant`, `Person`, `Guardian`/`Guardianship`, `Address`/`PersonAddress`, `Document`/`DocumentVersion`, the admissions `Workflow` state machine, `Student`, `Admission`, `Enrollment`, and the events/audit/outbox infrastructure that instruments them.

Out of scope: Fees, Attendance, Examination, Transport, Library, Parent Portal (mentioned only as downstream consumers in §28), and any module not touched by the admission→student conversion.

No source code, Prisma schema, or API was modified to produce this document. No new models are proposed. Where a gap is found, it is reported, not designed around.

## 3. Source of Truth

Code is authoritative. The following were read directly to produce this report:

- **Backend**: `src/modules/admissions/{applicant,workflow,admission,guardians,masters}`, `src/modules/identity/{person,student,address}`, `src/modules/enrollment`, `src/modules/documents`, `src/infrastructure/{crypto,events,audit,outbox,numbering,database}`
- **Prisma**: `prisma/modules/{admissions,identity,enrollment,documents,numbering}`, plus the migrations that add raw-SQL constraints Prisma cannot express
- **Tests**: `test/unit/{admissions,workflow,admission-conversion,student,guardians,guardianship,address,document,enrollment,identity-crypto}.service*.spec.ts` and `test/integration/{admission-workflow,admit,person,student,guardian,guardianship,address,document,enrollment}.integration-spec.ts`
- **Planning docs**: `docs/planning/core-admission-lifecycle-specification.md`, `docs/planning/student-admission-enrollment-architecture.md`, `docs/planning/document-management-specification.md`, `docs/planning/core-domain-freeze-v1-audit.md`, `docs/planning/01-identity-core/`, `docs/planning/02-guardian-family/`, `docs/planning/03-address/`

**A note on the planning doc set requested for this trace**: `docs/planning/core-admission-student-enrollment-specification.md` does **not exist** in this repository (confirmed by directory listing). The two documents that cover that ground are `student-admission-enrollment-architecture.md` (the original pre-implementation blueprint, status `planned`) and `core-admission-lifecycle-specification.md` (a later post-implementation reconciliation). This report treats the reconciliation doc and the code itself as closer to current truth, and the blueprint as "documented intent," flagging divergences explicitly.

**A note on internal doc staleness**: `core-admission-lifecycle-specification.md` contains a patch section (§8.7, dated 2026-08-16) recording that four guardian defects were fixed, but the document's own executive summary and final verdict section (dated against commit `9ad2acb`, 2026-08-12) still say `NOT READY TO FREEZE` and list those same defects as blocking. `README.md` (the most current index) and `core-domain-freeze-v1-audit.md` both treat the guardian work as shipped 2026-08-16. This report follows the more current state.

## 4. Example Applicant

Used consistently through this trace. All identifying values are fictional.

| Field | Value |
|---|---|
| Name | Amaan Sayyed |
| DOB | 2008-06-14 |
| Applying for | B.Sc IT |
| Branch | Mumbai |
| Academic Year | 2026–27 |
| Program | B.Sc IT |
| Academic Unit | B.Sc IT — First Year, Division A (illustrative) |
| Guardian | Rizwan Sayyed (father, primary + financial guardian) |
| Aadhaar (fictional) | `234123412346` |
| Primary mobile (fictional) | `9876543210` |
| Email (fictional) | `amaan.sayyed.example@example.com` |
| Documents | Photo, Birth Certificate, Previous Marksheet, Aadhaar copy |

---

## 5. Entity Relationships

The actual model layout differs in a few names from generic ERP vocabulary — noted here because it matters for anyone reading the schema directly.

```
Person (identity/person.prisma)
 ├── Applicant  (admissions/applicant.prisma)   — one per application attempt, branch+year scoped
 ├── Guardian   (admissions/guardian.prisma)    — personId is NULLABLE (not always Person-backed)
 └── Student    (identity/student.prisma)       — personId UNIQUE — at most one Student per Person, ever

Applicant
 ├── ApplicantGuardianMapping → Guardian        — per-application link, works even pre-Person
 ├── (inline snapshot fields)                   — name/dob/address/contact frozen on the row itself
 └── Document (ownerType=APPLICANT)

Person
 ├── PersonAddress → Address (immutable)        — address types: PERMANENT/CURRENT/COMMUNICATION/BILLING
 ├── Guardianship (guardianPersonId ↔ wardPersonId) — Person-to-Person, DB-enforced 1 primary/1 financial
 ├── PersonSensitive (Aadhaar ciphertext)
 └── Document (ownerType=PERSON)

Student (1:1 Person)
 └── Admission (branch-scoped "spell of study", 1 ACTIVE at a time)
       └── Enrollment (branch+year-scoped placement; many per Admission, one PRIMARY per year)
             ├── Program
             └── AcademicUnit
```

Key naming notes:
- There is no separate "guardian module" — guardians live under `src/modules/admissions/guardians/`.
- There is no top-level "student module" or "person module" — both live under `src/modules/identity/`.
- Enrollment's placement field is literally `academicUnitId`, not "term"/"class"/"batch".
- `Admission` deliberately carries **no** `academicYearId` — it spans years; `Applicant` and `Enrollment` are branch+year scoped, `Admission` is branch scoped only (`admission.prisma:16-24`).

---

## 6. Identity Resolution

### Person vs. Applicant

```
Applicant (DRAFT, personId = NULL)
   │  SUBMIT transition
   ▼
WorkflowService.resolvePersonForSubmission()
   │  reads Applicant's own inline name/dob/phone/aadhaarNo fields
   ▼
PersonService.resolve(organizationId, identifiers, tx)
   │
   ├── governmentId supplied? → deterministic lookup on Person.govtIdHash (HMAC-SHA256 blind index)
   │       match found → reuse that Person.id
   │       no match     → insert new Person (SAVEPOINT-protected against races)
   │
   └── no governmentId → insert new Person unconditionally (demographic-only never blocks/merges)
   │
   ▼
Applicant.personId = person.id   (written by the SUBMIT transition itself)
```

`PersonService.resolve()` — `src/modules/identity/person/person.service.ts:81-160`.

- **Person is never created via a direct API.** It is only created as a side effect of Applicant submission, Guardian creation, or (in `admit()`) a defensive re-resolve for legacy rows.
- **Deterministic match**: if a government ID is present, `Person.govtIdHash` (`@@unique([organizationId, govtIdHash])`, `person.prisma:75`) is looked up exactly. A hit returns the existing `Person.id` (`created:false, matchedByGovernmentId:true`) — no new Person is created (`person.service.ts:115-132`).
- **Fuzzy match** (`findCandidates`, `person.service.ts:270-348`) is advisory only: `phoneHash+dob` (MEDIUM) or `nameNormalized+dob` (LOW) matches are returned as **warnings**, never block creation, and never auto-merge. Reviewed non-matches are recorded in `PersonMatchDecision` so the same pair doesn't warn again.
- **Concurrency**: no application-level mutex — races are resolved by the `@@unique([organizationId, govtIdHash])` constraint. `insertPerson()` wraps the insert in a Postgres `SAVEPOINT` when running inside a caller transaction; a `P2002` collision rolls back to the savepoint and re-reads the winner's row (`person.service.ts:182-261`). Proven by `test/integration/person.integration-spec.ts:104-163` — 20 concurrent resolves of the same identity → exactly 1 Person row created, 19 reuse it.

### Government identifier handling

- `Person.govtIdHash` / `phoneHash`: deterministic **HMAC-SHA256 blind index** keyed by an env pepper (`identity-hash.service.ts`), domain-separated so a phone number can never collide with a government ID hash.
- `PersonSensitive.aadhaarEnc`: **AES-256-GCM** ciphertext under a per-organization envelope-encrypted DEK (`identity-crypto.service.ts`), plus `aadhaarLast4` in plaintext for display and `keyVersion` for key rotation.
- **Crypto-erasure** (`cryptoEraseSubject`) nulls `aadhaarEnc`/`aadhaarLast4` but deliberately **keeps `govtIdHash`** — "dropping it would let an erased subject re-enrol as a stranger" (`identity-crypto.service.ts:220-235`).
- Masking for display: `maskAadhaar(last4)` → `"XXXX XXXX 2346"` (`masking.util.ts`).

**⚠️ Known gap (VERIFIED in code):** `Applicant.aadhaarNo` and `Guardian.aadhaarNo` still store Aadhaar as **plaintext columns** (`applicant.prisma:30`, indexed at `:155`; `guardian.prisma:30`, indexed at `:52`), even though `docs/planning/01-identity-core/02-applicant.md:37` (decision D4) says this column should have been removed once `Person`/`PersonSensitive` existed. Both `WorkflowService.resolveIdentity()` and `AdmissionConversionService` read `applicant.aadhaarNo` directly as the source of truth passed into `PersonService.resolve()`. This is a real, load-bearing plaintext copy of Aadhaar living outside the encrypted system — documented in `core-domain-freeze-v1-audit.md` as a known carry-forward item requiring a business decision, not silently missed.

### Duplicate prevention across two Applicant records

If the same Aadhaar is submitted on two different `Applicant` rows (e.g. applying at two branches), both resolve to the **same** `Person.id` at their respective `SUBMIT` transitions. If both later reach `admit()`, the second is blocked — `Student.personId` is `@unique` (`student.prisma:62`), so `assertNoExistingStudent()` throws `409 STUDENT_ALREADY_EXISTS` rather than creating a second Student (see §17).

### The identifier chain

| Identifier | Type | Generator | First exists | Scope |
|---|---|---|---|---|
| **Person.id** | UUID v7 | `PersonService.resolve()` | At Applicant `SUBMIT`, or Guardian creation, whichever happens first | Organization |
| **Applicant.applicationNo / admissionFormNo** | Sequence-generated string | `NumberingService` (branch+year, yearly reset) | At Applicant creation (DRAFT) | Branch + Academic Year |
| **Student.id** | UUID v7 | `StudentService.createControlled()` | Inside the `admit()` transaction | Organization (global relational key) |
| **Student.studentCode** | Sequence-generated string (e.g. `STU0000000123`) | `NumberingService` — org-scoped, `MONOTONIC`, never resets | Inside `admit()`, allocated *before* the Student row insert | Organization — permanent, survives branch transfer |
| **Admission.admissionNo** | Sequence-generated string | `NumberingService` — branch-scoped, `MONOTONIC`, yearly reset | Inside `admit()`, after Student creation | Branch (a branch transfer allocates a second one) |
| **Enrollment.id** | UUID v7 | `EnrollmentService.createInitialEnrollment()` | Inside `admit()`, last write before the Applicant status flips | Branch + Academic Year — **no human-facing enrollment code exists at all** |

**Person ID ≠ Student UUID ≠ Student Code ≠ Admission Number ≠ Enrollment ID** — all five are genuinely distinct values, generated at four different moments, with four different scoping rules. `Student.studentCode` is explicitly documented as never a valid foreign-key target — only `Student.id` is (`student-admission-enrollment-architecture.md` §14).

---

## 7. Guardian Flow

```
POST /admissions/guardians                (explicit, separate call — NOT automatic at applicant creation)
   │  Guardian.dob supplied?
   │     yes → PersonService.resolve() → Guardian.personId set
   │     no  → Guardian.personId stays NULL (Guardian can be a standalone, lightweight record)
   ▼
Guardian row created  (guardian.prisma:1-54)

POST /admissions/guardians/:applicantId/map   (or equivalent mapping call)
   ▼
ApplicantGuardianMapping created
   { applicantId, guardianId, relationTypeId, isPrimary, isEmergencyContact,
     isFinancialGuardian, pickupAllowed, priority }
   @@unique([applicantId, guardianId])
   │
   └── if BOTH applicant.personId and guardian.personId already resolved:
         GuardianshipService.syncOne() runs inline, in the same transaction
         → Guardianship (Person-to-Person) row created/updated immediately

   [If not both resolved yet, no Guardianship exists — only the mapping does]

admit()  step 5.5
   ▼
GuardianshipService.syncFromApplicantMappings(tx, applicantId, orgId, personId)
   → iterates every ApplicantGuardianMapping for this applicant
   → for each guardian that now has a personId, syncs/creates the corresponding Guardianship
   → this is the catch-all that guarantees Guardianship exists by the time Admit completes,
     even if mapping happened before either side had a Person
```

- **`ApplicantGuardianMapping` still exists** — it was not replaced by `Guardianship`, despite `docs/planning/02-guardian-family/01-guardian.md` framing `Guardianship` as a replacement. The code comment in `guardianship.service.ts:19-30` states plainly: "Neither model is redundant." Mapping is applicant-scoped and can exist before either side has a Person; Guardianship is Person-to-Person and is the durable record that survives the applicant's own lifecycle.
- **Primary / financial guardian**: real boolean flags at *both* levels. On `ApplicantGuardianMapping`, `isPrimary` exclusivity is enforced only in service code (clear-then-set inside a transaction); `isFinancialGuardian` has **no exclusivity enforcement at all** at this level (a documented, known defect). On `Guardianship`, both flags are backed by real **partial unique indexes** (`Guardianship_one_primary_per_ward_key`, `Guardianship_one_financial_per_ward_key`) — DB-guaranteed, not just service-level.
- **Sibling relationships**: derived, never stored. `GuardianshipService.findSiblings()` runs a raw SQL self-join on `Guardianship` for two wards sharing an active `guardianPersonId`. No sibling/household table exists — a deliberate design decision documented in `02-guardian-family/01-guardian.md`.
- **What admit() touches**: only the Guardianship projection described above (step 5.5). `AdmissionConversionService`/`AdmissionService` never write to `Guardian` or `ApplicantGuardianMapping` directly.
- **Guardian update**: `PATCH /admissions/guardians/:id` mutates in place — no versioning, no dedicated audit-trail model, just `updatedAt` + an emitted `GuardianUpdatedEvent`. `Guardianship`, by contrast, is designed to be append-only history, but the actual `syncOne()` implementation **updates the existing row in place** for the *same* (guardian, ward) pair rather than closing the old row and opening a new one — a documented gap between the intended "handover has a date" design and what's built.
- **Guardian's own legacy address/Aadhaar fields**: `Guardian` still carries its own inline `addressLine1/2, city, state, country, pincode` and plaintext `aadhaarNo`, distinct from the Person/PersonAddress system. Planning docs call for dropping these once migrated to S2 (Address module); this has **not** been done.

**IMPLEMENTED**: Guardian creation, Person resolution/reuse for guardians, `ApplicantGuardianMapping`, primary/financial flags (DB-enforced at Guardianship level), sibling derivation, Guardianship sync both at map-time and at admit-time.
**DEFERRED**: Guardian org-scoping (still branch-scoped), Guardian.personId required (still nullable), Guardian's legacy address/Aadhaar columns dropped, append-only history semantics for Guardianship primary/financial handovers (currently in-place update for same-pair changes), financial-guardian exclusivity at the `ApplicantGuardianMapping` level.

---

## 8. Address Flow

```
Person
 │
 ▼
PersonAddress.attach(personId, addressType, addressFields)
 │
 ├── find-or-create Address by (organizationId, normalizedHash)   — Address itself is IMMUTABLE
 │     (no update path exists anywhere in address.service.ts; no updatedAt column)
 │
 └── close any existing OPEN PersonAddress link of the same type (validTo = now)
       then open a new PersonAddress link (validFrom = now, validTo = null)
       — enforced by a partial unique index: at most one OPEN link per (personId, addressType)
```

- **Four address types**: `PERMANENT`, `CURRENT`, `COMMUNICATION`, `BILLING`. `COMMUNICATION` and `BILLING` fall back to `CURRENT` when not explicitly set; `PERMANENT`/`CURRENT` have no fallback.
- **Historical resolution**: `resolve(personId, type, asOf)` finds whichever `PersonAddress` link was open at a given instant — "what was the address on date X" is a real, tested query.
- **Applicant's address is a frozen inline snapshot, permanently.** `Applicant.currentAddressLine1/2, city, district, state, country, pincode` are columns on `Applicant` itself (`applicant.prisma:39-46`) — **not** resolved via `Person`/`PersonAddress`. This is deliberate and permanent design (`docs/planning/03-address/01-address.md`): "a legal snapshot of what was declared on a date," never migrated even after a family moves.
- **Guardian's inline address** (`guardian.prisma:32-38`) is a separate, non-deduped legacy field — planning docs call for backfilling `PersonAddress` from it and dropping the columns; **not done**.
- **On "address changed"**: always a new `PersonAddress` row (append-only), never an in-place edit of an existing link or of the underlying `Address` row.

**IMPLEMENTED**: Address immutability, 4 address types, historical/as-of resolution, one-open-link-per-type enforcement, Applicant's inline snapshot never migrating (by design).
**DEFERRED**: Guardian's legacy address columns not yet dropped/backfilled into PersonAddress; BILLING-via-financial-guardian resolution not reachable in practice because `Guardian.personId` is nullable rather than the documented "required."

---

## 9. Document Flow

```
DocumentRequirement (configured per org/branch, by programId × quotaId × categoryId × requiredByStage)
   │
   ▼
Applicant/Person uploads → DocumentService.upload()
   │
   ├── SHA-256 checksum computed; identical re-upload to current version refused (409 DOCUMENT_UNCHANGED)
   ├── AES-256-GCM encryption (same per-org DEK machinery as PersonSensitive) BEFORE storage write
   ├── ScanPort.scan() — mandatory, blocking; only CLEAN can ever become the current version
   ├── LocalFilesystemStorageAdapter.upload(key, ciphertext)  — key = {orgId}/{docTypeCode}/{uuid}
   ▼
DocumentVersion row created (versionNumber, checksumSha256, scanStatus, verificationStatus=PENDING)
   │  (if scan CLEAN) → Document.currentVersionId repointed to this version
   ▼
Staff verify/reject → DocumentVersion.verificationStatus = VERIFIED | REJECTED(+reason)
   │
   └── rejected → applicant can re-upload (replace()) → new version, old one kept (supersededAt set)
                  new version ALWAYS starts PENDING again — never inherits VERIFIED
```

- **Versioning is real**, not a mutable single row: `Document` = business identity, `DocumentVersion` = append-only artefact history.
- **Checklist satisfaction is actually wired into two workflow transitions** — not a no-op. `ChecklistService.isSatisfied()` is called from `WorkflowService.evaluateGuard()` (`workflow.service.ts:431-459`) for the guard `DOCUMENT_CHECKLIST_SATISFIED`, declared on exactly two transitions:

| Transition | Document check enforced? |
|---|---|
| `SUBMIT` (DRAFT→SUBMITTED) | **NOT checked** |
| `START_REVIEW` (SUBMITTED→UNDER_REVIEW) | **NOT checked** |
| `DOCUMENTS_RECEIVED` (DOCUMENT_PENDING→UNDER_REVIEW) | **CHECKED** |
| `APPROVE` (→APPROVED, the offer) | **CHECKED** |
| `CONFIRM_SEAT` (APPROVED→SEAT_CONFIRMED) | **NOT checked** — no document guard on this transition |
| `ADMIT` (SEAT_CONFIRMED→ADMITTED) | **NOT checked** — `AdmissionConversionService` never calls `ChecklistService`; its own comment states "the guardians, the documents and the preference list are not read" |

So a document set is only guaranteed complete-and-verified **at the moment the offer is issued** — it is never re-checked at seat confirmation or at admission itself. A document could theoretically be un-verified/replaced between offer and admit without blocking admission.

- **Storage**: `StoragePort` interface, only a local-filesystem adapter implemented; cloud providers (S3/R2/GCS) throw a named boot error rather than silently degrading — **DEFERRED**.
- **Scanning**: `ScanPort` interface, mandatory and blocking; in production with no real scanner configured, uploads are **refused** (`SCAN_NOT_CONFIGURED`) rather than fake-passed — **DEFERRED** (no real scanner wired), but fails safe.
- **Archive**: one-way `ACTIVE → ARCHIVED` on the `Document` row, never deletes data.

**IMPLEMENTED**: Requirement configuration, polymorphic ownership, real versioning, encryption at rest, checksum, verification/rejection with mandatory reason, replacement flow, archive, checklist computation, checklist gate on `DOCUMENTS_RECEIVED` and `APPROVE`.
**DEFERRED**: real virus scanner, cloud storage, retention/archival sweep, `admissionType` axis on requirements, direct guardian/parent upload.
**NOT SUPPORTED**: checklist gate on `CONFIRM_SEAT` or `ADMIT` — does not exist, by current design, not by oversight.

---

## 10. Applicant Lifecycle

### 10.1 Full state machine

13 states (`AdmissionApplicationStatus` enum, `admission-application.enums.prisma:12-26`): `DRAFT, SUBMITTED, UNDER_REVIEW, DOCUMENT_PENDING, FEE_PENDING, WAITLISTED, APPROVED, SEAT_CONFIRMED, DEFERRED, ADMITTED, REJECTED, WITHDRAWN, CANCELLED`.

Single engine: `WorkflowService.transition()` (`workflow.service.ts:91-269`), driven by a declarative table in `workflow.transitions.ts:121-304`. Every transition, regardless of which one, does the same six things in the same order, inside one transaction:

1. **Lock** — raw `SELECT ... FOR UPDATE`, scoped by organization+branch (`RowLockService`, since Prisma has no native row-lock API)
2. **Re-read & validate** the current status against the rule's allowed `from` states
3. **Guards** — `OFFER_NOT_EXPIRED`, `OFFER_EXPIRED`, `DEFERMENT_ENABLED` (hardcoded `false` — no config UI exists yet), `DOCUMENT_CHECKLIST_SATISFIED`
4. **Mutate** — status + relevant timestamp(s) + actor column
5. **History** — one `WorkflowHistory` row
6. **Outbox** — one domain event, transactional

| Action | From | To | Permission | Remarks | Guard | Notes |
|---|---|---|---|---|---|---|
| `submit` | DRAFT | SUBMITTED | Admissions.Update | optional | — | Person bound here |
| `startReview` | SUBMITTED | UNDER_REVIEW | Admissions.Update | optional | — | |
| `requestDocuments` | UNDER_REVIEW | DOCUMENT_PENDING | Admissions.Update | **required** | — | |
| `documentsReceived` | DOCUMENT_PENDING | UNDER_REVIEW | Admissions.Update | optional | DOCUMENT_CHECKLIST_SATISFIED | |
| `requestFee` | UNDER_REVIEW | FEE_PENDING | Admissions.Update | optional | — | |
| `waitlist` | UNDER_REVIEW | WAITLISTED | Admissions.Approve | **required** | — | |
| `approve` | UNDER_REVIEW, DOCUMENT_PENDING, FEE_PENDING, WAITLISTED | APPROVED | Admissions.Approve | optional | DOCUMENT_CHECKLIST_SATISFIED | stamps approvedAt/offerIssuedAt/offerExpiresAt |
| `confirmSeat` | APPROVED | SEAT_CONFIRMED | Admissions.Update | optional | OFFER_NOT_EXPIRED | |
| `defer` | APPROVED | DEFERRED | Admissions.Approve | **required** | DEFERMENT_ENABLED (off by default) | |
| `expireOffer` | APPROVED | CANCELLED | Admissions.Approve | optional | OFFER_EXPIRED | system-only |
| `reject` | SUBMITTED, UNDER_REVIEW, DOCUMENT_PENDING, FEE_PENDING, WAITLISTED | REJECTED | Admissions.Reject | **required** | — | terminal |
| `withdraw` | DRAFT…SEAT_CONFIRMED (8 states) | WITHDRAWN | Admissions.Update | **required** | — | terminal |
| `cancel` | DRAFT…SEAT_CONFIRMED (8 states) | CANCELLED | Admissions.Approve | **required** | — | reopenable |
| `admit` | SEAT_CONFIRMED | ADMITTED | Admissions.Approve **+** Student.Create | optional | — | **orchestrated-only**, unreachable via the generic transition endpoint |
| `forceReopen` | CANCELLED | UNDER_REVIEW | Admissions.Approve | **required** | — | break-glass, `severity: WARN` on audit |

`TERMINAL_STATES = [ADMITTED, REJECTED, WITHDRAWN]`. `DEFERRED` and `CANCELLED` are practically dead-ends too (`CANCELLED` has the one `forceReopen` exit; `DEFERRED` has none), but are deliberately excluded from the formal terminal list.

### 10.2 Per-state meaning

| State | Editable? | Terminal? | Who can act next | Meaning |
|---|---|---|---|---|
| DRAFT | Yes | No | Applicant/staff | Form in progress; no Person bound yet |
| SUBMITTED | Yes | No | Staff | Person resolved/bound |
| UNDER_REVIEW | Yes | No | Staff | Being evaluated |
| DOCUMENT_PENDING | Yes | No | Staff/applicant | Waiting on documents |
| FEE_PENDING | Yes | No | Staff/applicant | Waiting on a fee action |
| WAITLISTED | Yes | No | Staff | Queued, no seat yet |
| APPROVED | **No** (frozen) | No | Staff/applicant/system | Offer issued, seat provisionally held, has an expiry |
| SEAT_CONFIRMED | **No** (frozen) | No | Staff (Approve permission) | The only state `admit()` accepts |
| DEFERRED | **No** (frozen) | Practically yes | — | No outbound transition exists |
| ADMITTED | **No** (frozen) | **Yes** | — | Student+Admission+Enrollment exist |
| REJECTED | **No** (frozen) | **Yes** | — | Applicant may submit a **new** application |
| WITHDRAWN | **No** (frozen) | **Yes** | — | Applicant-initiated exit |
| CANCELLED | **No** (frozen) | No | Staff (Approve, break-glass) | Institution-initiated exit or lapsed offer; reopenable |

`FROZEN_STATUSES` for edit purposes = `{APPROVED, SEAT_CONFIRMED, ADMITTED, DEFERRED, REJECTED, WITHDRAWN, CANCELLED}` (`applicant.service.ts:30-38`) — DRAFT through WAITLISTED remain editable.

---

## 11. Happy Path

Numbered sequence for Amaan Sayyed's application, corrected against the actual implementation (not the generic template):

1. **`POST /admissions/applicants`** — `Applicant` created, `admissionStatus: DRAFT`, `personId: NULL`. `admissionFormNo`/`applicationNo` allocated via `NumberingService` (branch+year scoped). All identity/contact/address/previous-education fields captured **inline on the Applicant row** — no `Person` exists yet. `ApplicantCreatedEvent` enqueued.
2. Applicant data entered/edited (`PATCH /admissions/applicants/:id`) any number of times while in DRAFT.
3. **`POST /admissions/guardians`** — Guardian record for Rizwan Sayyed created (personId set only if `dob` supplied).
4. **Guardian mapped to Applicant** — `ApplicantGuardianMapping` created (`isPrimary: true, isFinancialGuardian: true`). If both sides already have a `personId` at this point, `Guardianship` syncs inline; here Amaan has no `personId` yet, so it doesn't — deferred to admit-time.
5. Documents uploaded for the applicant (Photo, Birth Certificate, Previous Marksheet, Aadhaar copy) via `DocumentService.upload()` — encrypted, scanned, versioned. Each starts `verificationStatus: PENDING`.
6. **`transition({action:'submit'})`** — DRAFT → SUBMITTED. `WorkflowService.resolvePersonForSubmission()` runs; Amaan's Aadhaar (fictional `234123412346`) is hashed and looked up; no match found → new `Person` inserted; `Applicant.personId` set. `ApplicantWorkflowEvent('applicant.submitted')` enqueued.
7. **`transition({action:'startReview'})`** — SUBMITTED → UNDER_REVIEW.
8. Staff verifies uploaded documents — `DocumentService.verify()` on each, `verificationStatus: VERIFIED`.
9. **`transition({action:'approve'})`** — UNDER_REVIEW → APPROVED. Guard `DOCUMENT_CHECKLIST_SATISFIED` runs — all mandatory documents for this program/quota/category at this stage must be VERIFIED, or the transition is refused (`409 DOCUMENTS_INCOMPLETE`). Stamps `approvedAt`, `offerIssuedAt`, `offerExpiresAt`. `applicant.offer_issued` event.
10. **`transition({action:'confirmSeat'})`** — APPROVED → SEAT_CONFIRMED, guarded by `OFFER_NOT_EXPIRED`. `applicant.seat_confirmed` event.
11. **`POST /admissions/applicants/:id/admit`** — the orchestrated conversion begins (see §19 for full detail):
    - Applicant row locked `FOR UPDATE`; status re-verified as SEAT_CONFIRMED
    - `Person` re-confirmed (already resolved at step 6, reused as-is)
    - No existing `Student` found for this Person → proceed
    - `Student` created; `studentCode` allocated first
    - `Guardianship` synced from the `ApplicantGuardianMapping` created at step 4 — now that both Amaan and Rizwan have `personId`s, the Person-to-Person Guardianship record is created
    - `Admission` created; `admissionNo` allocated
    - `Enrollment` created, `enrollmentStatus: ACTIVE`, linked to B.Sc IT / First Year / AY 2026–27
    - Applicant transitioned SEAT_CONFIRMED → **ADMITTED** (last write in the transaction)
12. Transaction commits. All five events (Student created, Student code assigned, Admission created, Enrollment created, Applicant admitted) are written to the outbox **in the same transaction**.
13. `OutboxRelay` (polling every 2s) picks up the committed outbox rows and republishes them to `AuditListener`, producing audit log rows — asynchronously, after the HTTP response has already returned.
14. Amaan Sayyed is now an **ACTIVE Student** with a `studentCode`, one `ACTIVE` `Admission`, and one `ACTIVE` `Enrollment` in B.Sc IT / First Year for AY 2026–27.

---

## 12. Rejection Path

`reject` is reachable from SUBMITTED, UNDER_REVIEW, DOCUMENT_PENDING, FEE_PENDING, WAITLISTED → `REJECTED`. Requires non-blank remarks. Stamps `rejectedAt`, `rejectedBy`. `REJECTED` is terminal — no outbound transition.

- **Applicant**: row stays as-is, permanently `REJECTED`. Not reset, not deleted.
- **Person**: unaffected — remains resolvable for any future application.
- **Guardian / mappings**: unaffected.
- **Documents**: unaffected, remain attached to the rejected Applicant/Person.
- **Address**: unaffected (Applicant's inline snapshot is frozen regardless).
- **Can the person apply again?** **Yes — IMPLEMENTED and tested.** The partial unique index `applicant_one_active` (on `personId, branchId, academicYearId`) explicitly **excludes** `REJECTED` from its blocking `WHERE` clause, so a brand-new `Applicant.create()` for the same person/branch/year succeeds. Verified at `test/integration/admission-workflow.integration-spec.ts:638-658`.
- **What's reused?** The `Person` record (via the same Aadhaar/demographic resolution at the new application's SUBMIT step). A fresh `Applicant` row, fresh `applicationNo`, fresh document uploads.

---

## 13. Cancellation Path

`cancel` (institution-initiated) reachable from any of DRAFT…SEAT_CONFIRMED (8 states) → `CANCELLED`. Requires remarks, `Admissions.Approve` permission. Stamps `cancelledAt`.

- **Not terminal.** `CANCELLED` is the one break-glass-reopenable state: `forceReopen` → UNDER_REVIEW, requiring `Admissions.Approve` + remarks, and the emitted event carries `severity: WARN` for elevated audit visibility.
- `CANCELLED` is also the landing state for the automated offer-expiry sweep (see §15) — same status, different action/event name (`expireOffer` vs `cancel`), which is how "offer lapsed" is distinguished from "institution actively cancelled" in reporting.
- No new records created or deleted; purely a status change + history + event.

---

## 14. Deferment Path

`defer`: APPROVED → DEFERRED. Requires `Admissions.Approve` + remarks + the `DEFERMENT_ENABLED` guard, which is **hardcoded `false`** in `AdmissionConfigProvider` (`admission-config.provider.ts:43-45`) — there is no tenant-configurable override yet ("Configuration Engine" not built). So in practice, `defer` is refused by default unless overridden in tests.

- `DEFERRED` has no outbound transition — it is a practical dead-end for *this* Applicant row.
- **Does it create a new Applicant or modify the old one?** The schema has a field for exactly this — `Applicant.deferredFromApplicantId` (self-relation `ApplicantDeferral`) — documented as: "deferring to the next cycle produces a **new** Applicant carrying `deferredFromApplicantId`, not a reopening of this one."
- **⚠️ NOT SUPPORTED — confirmed gap.** `deferredFromApplicantId` has **zero references anywhere in `src/`** beyond the Prisma model and migration. No code sets it; `CreateApplicantDto` has no field for it. A caller can defer an applicant, but the "new attempt linked back to the deferred one" flow described in `student-admission-enrollment-architecture.md` is **unreachable through the API today**. This is the single clearest DEFERRED item in the entire applicant lifecycle.
- Seat-hold-during-deferment policy is also undecided — flagged `PROPOSED` in the lifecycle spec, no config exists.

---

## 15. Offer Expired

Not applicant-initiated. `OfferExpiryJob` (`offer-expiry.job.ts`) runs hourly via `OnApplicationBootstrap` + `setInterval` (not a true cron; same shape as `OutboxRelay`), disableable via `OFFER_EXPIRY_JOB_DISABLED=true`.

- Queries: `admissionStatus: APPROVED, offerExpiresAt: {lt: now}, deletedAt: null`, batch size 200.
- For each candidate, calls `WorkflowService.transition(..., {action:'expireOffer'}, ..., {system:true})` — **each candidate gets its own transaction**; a failure on one does not roll back others.
- Transition: APPROVED → **CANCELLED** (not REJECTED, not WITHDRAWN — "the institution didn't refuse, the candidate didn't walk away, the offer simply lapsed").
- `actor.system = true` bypasses the permission check but goes through the **full** state-machine machinery (lock, guard, history, outbox) — same rigor as a human action.
- Losing a race (someone confirmed the seat moments before the sweep ran) is treated as an expected non-error outcome, not a failure.

---

## 16. Document Failure

### Document rejected
`DocumentService.reject()` requires a non-blank reason. The version's `verificationStatus` becomes `REJECTED`. The applicant can call `replace()` to upload a new version — old version kept (`supersededAt` set, never deleted), new version always starts `PENDING` again (never inherits any prior status). This does not, by itself, change the Applicant's workflow status — it only affects whether `DOCUMENT_CHECKLIST_SATISFIED` will pass on the next `documentsReceived`/`approve` attempt.

### Missing required document
Blocks exactly two transitions — `documentsReceived` (DOCUMENT_PENDING→UNDER_REVIEW) and `approve` (→APPROVED) — via `409 DOCUMENTS_INCOMPLETE`, naming the missing document types. Does **not** block `confirmSeat` or `admit()` (see §9). A document that becomes un-verified *after* the offer is issued does not retroactively block seat confirmation or admission — **NOT SUPPORTED**, by current design.

---

## 17. Duplicate Applicant

Two scenarios:

1. **Same person, same branch, same year, still-live application** — blocked at the database level by the partial unique index `applicant_one_active` on `(personId, branchId, academicYearId)`, excluding `REJECTED/WITHDRAWN/CANCELLED/DEFERRED`. A race that slips past the row lock is caught here and translated into a clean `409 DUPLICATE_ACTIVE_APPLICATION`.
2. **Same person (same Aadhaar), two different branches** — both `Applicant` rows resolve to the same `Person.id` at SUBMIT. Both can independently progress to SEAT_CONFIRMED. Whichever reaches `admit()` **first** wins: `Student.personId` is `@unique`, so the second `admit()` call fails with `409 STUDENT_ALREADY_EXISTS`, naming the winning `studentId`/`studentCode`. **This is a hard refusal, not a reuse/merge.** Verified end-to-end by `test/integration/admit.integration-spec.ts:631-683` ("twin applicants, same Aadhaar, two branches").

---

## 18. Concurrent Admission

Layered protection, all confirmed by a 20-concurrent-request integration test (`admit.integration-spec.ts:562-602`, exactly 1 success / 19 informative conflicts):

1. `SELECT ... FOR UPDATE` on the `Applicant` row — first statement inside the transaction. Under `READ COMMITTED`, the loser blocks until the winner commits, then re-reads the **already-updated** row.
2. Status re-check under lock: a loser that sees `ADMITTED` gets `409 APPLICANT_ALREADY_ADMITTED`, naming the winning Student.
3. DB unique constraints as a last line of defense: `Student.personId` unique, and a partial unique index on `Student.sourceApplicantId` — a race that somehow bypasses the lock still cannot produce two Students, only a translated `P2002` → clean error.

No optimistic/version-column locking is used for the Applicant write path — it's pessimistic locking plus unique constraints throughout.

---

## 19. ADMIT Transaction

This is the most heavily governed operation in the module. Entry point: **`POST /admissions/applicants/:applicantId/admit`** (`admission-conversion.controller.ts:53`), guarded by `@Roles(SUPER_ADMIN, ORG_ADMIN, BRANCH_ADMIN)` + `@RequirePermission(Admissions.Approve)` at the route, **and** a second service-level check requiring **both** `Admissions.Approve` **and** `Student.Create` (`assertPermitted`, `admission-conversion.service.ts:557-584`).

### Pre-transaction (no locks held)

1. `assertPermitted(actor)` — 403 if either permission missing
2. Validate `admissionType` is a first-entry type (`REGULAR|LATERAL_ENTRY|RTE`) — READMISSION/TRANSFER/MIGRATION types are rejected here (they're not built yet — see §30)
3. Load the Applicant, scoped to org+branch — 404 if absent
4. `assertSeatConfirmed()` — 409 `APPLICANT_NOT_SEAT_CONFIRMED` unless status is exactly SEAT_CONFIRMED
5. `resolvePlacement()` — validates the target `AcademicUnit` belongs to the branch/program/year and is active; validates the `AcademicYear` isn't locked (403 `ACADEMIC_YEAR_LOCKED`)
6. `assertNumberingProvisioned()` — 400 `NUMBERING_NOT_PROVISIONED` if no `NumberSequenceConfig` exists for `STUDENT_CODE`/`ADMISSION_NO`

### The transaction

```ts
await this.prisma.$transaction(
  async (tx) => this.convert(tx, applicant, placement, admissionType, request, actor),
  { timeout: 15_000 },
);
```
Interactive-callback style, **no explicit `isolationLevel`** (defaults to Postgres `READ COMMITTED`), 15-second timeout.

### Inside `convert(tx, ...)`, in order

```
BEGIN TRANSACTION
  │
  ├─ 1. SELECT ... FOR UPDATE on Applicant (scoped org+branch)      → 404 if gone/soft-deleted
  ├─ 2. Re-check admissionStatus under lock                          → 409 if not SEAT_CONFIRMED
  │       (ADMITTED → 409 APPLICANT_ALREADY_ADMITTED, names existing Student)
  ├─ 3. Person resolution — trusts locked.personId; only re-resolves
  │       if null (legacy rows predating the identity index)
  ├─ 4. assertNoExistingStudent(personId)                            → 409 STUDENT_ALREADY_EXISTS
  │       (NO reuse/readmission path — hard refusal; deliberate divergence from the original blueprint)
  ├─ 5. StudentService.createControlled()
  │       → allocate studentCode (NumberingService, MONOTONIC, own connection)
  │       → INSERT Student  (status defaults ACTIVE)
  │       → enqueue StudentCreatedEvent + StudentCodeAssignedEvent (outbox, on tx)
  ├─ 5.5. GuardianshipService.syncFromApplicantMappings()
  │       → projects ApplicantGuardianMapping rows onto Guardianship
  ├─ 6. AdmissionService.createControlled()
  │       → allocate admissionNo (NumberingService, MONOTONIC, own connection)
  │       → INSERT Admission (status defaults ACTIVE)
  │       → enqueue AdmissionCreatedEvent (outbox, on tx)
  ├─ 7. EnrollmentService.createInitialEnrollment()
  │       → INSERT Enrollment (enrollmentStatus: ACTIVE, originType: ADMISSION, rollNumber: null)
  │       → enqueue EnrollmentCreatedEvent (outbox, on tx)
  ├─ 8. WorkflowService.transition(ADMIT, orchestrated:true)
  │       → re-locks Applicant (safe — same tx/connection)
  │       → UPDATE Applicant SET admissionStatus = ADMITTED
  │       → INSERT WorkflowHistory (one row, entityType=APPLICANT)
  │       → enqueue ApplicantWorkflowEvent('applicant.admitted') (outbox, on tx)
  ▼
COMMIT
```

### Rollback

Any thrown error at any step rolls back **everything** in the transaction — Student, Guardianship sync, Admission, Enrollment, Applicant status change, WorkflowHistory row, and all 5 outbox rows. Proven by an integration test that injects a failure into every single step (`admit.integration-spec.ts:740-768`) and asserts zero footprint remains.

**The one documented exception: numbering.** `STUDENT_CODE` and `ADMISSION_NO` are `MONOTONIC` sequences, allocated on a **separate connection** (`this.prisma`, not `tx`) — the increment commits immediately regardless of what happens to the surrounding transaction. If the transaction later rolls back, the allocated number is **burned** (a permanent gap), never reused. This is explicitly accepted by design: "a MONOTONIC number may be burned — a gap, which is acceptable by definition."

### Concurrency

See §18. Summary: row lock first, status re-check second, unique constraints (`Student.personId`, `Student.sourceApplicantId` partial index) as the backstop.

### Unique constraints in play

- `Admission`: `@@unique([branchId, admissionNo])`; raw-SQL partial unique index `admission_one_active` on `studentId` WHERE `status='ACTIVE'` (one active admission per student)
- `Student`: `personId String @unique`; `@@unique([organizationId, studentCode])`; raw-SQL partial unique index `student_one_per_applicant` on `sourceApplicantId`
- `Enrollment`: raw-SQL partial unique index `enrollment_one_primary_per_year` on `(admissionId, academicYearId)` WHERE `enrollmentKind='PRIMARY'` and not SUPERSEDED/CANCELLED

### What survives a failure / what doesn't

| Outcome | Applicant | Student/Admission/Enrollment | Numbering | Audit |
|---|---|---|---|---|
| Success | ADMITTED | all 3 created | consumed, correctly attached | eventually written (async, post-commit) |
| Failure at any step | stays SEAT_CONFIRMED | none created (full rollback) | may be burned (gap) | **none written** — no outbox row survives a rolled-back transaction |

### Known code-vs-doc disagreements in this section

1. **Readmission reuse**: the original blueprint (`student-admission-enrollment-architecture.md` §31.1) describes reusing an existing Student for readmission. The actual code hard-refuses with `STUDENT_ALREADY_EXISTS` instead — an explicit, documented deviation, deferred to a later phase.
2. **WorkflowHistory row count**: blueprint says 3 rows (Applicant, Admission, Enrollment); code writes only 1 (Applicant). Already flagged as a known discrepancy in `core-admission-lifecycle-specification.md` with a recommendation to add the other two.
3. **Guardian handling at admit**: both planning docs, read literally, claim "admit() does nothing about guardians." The code does something — the Guardianship sync at step 5.5 — that postdates both documents. Neither doc reflects this.
4. **`NUMBERING_NOT_PROVISIONED` status code**: documented as 500 (provisioning failure); the pre-transaction check actually throws 400, while a defense-in-depth path deeper in `NumberingService` still throws 500 for the same error code if ever reached without a config.
5. **Address copying at admit**: the blueprint says `admit()` copies the applicant's declared address into a CURRENT `PersonAddress`. No such call was found in `convert()`'s 9 documented steps — **possible gap, not confirmed**, since it might live inside a sub-call not read in full. Flagged for follow-up.

---

## 20. Student Creation

`StudentService.createControlled()` (`student.service.ts:87-180`), called only from `admit()` — there is **no** `POST /students` route.

- `studentCode` allocated first, inside the same transaction's connection topology (numbering caveat above).
- Fields written: `personId`, `studentCode`, `displayName`, demographic snapshot (own current-truth copy, independent of Applicant's frozen snapshot), `branchId` (mutable — current location, distinct from `Admission.branchId` which is immutable), `status` (defaults `ACTIVE`), `createdVia: 'ADMISSION'`, `sourceApplicantId`.
- **`Student.personId` is globally unique** — one Student per Person per organization, forever. A cross-org move mints a new Student in the target org; there is no cross-branch multiplicity.
- Events: `StudentCreatedEvent`, `StudentCodeAssignedEvent`, both transactional via outbox.

---

## 21. Admission Creation

`AdmissionService.createControlled()` (`admission.service.ts:63-140`), called from `admit()` (also reachable from future branch-transfer/readmission/migration flows per the model's doc comment, none of which are built yet).

- Validates student-belongs-to-branch, academic structure, masters-in-scope, all scoped to the same transaction.
- `admissionNo` allocated (branch+year-scoped, MONOTONIC).
- Fields: `studentId`, `admissionNo`, `admissionType`, `admissionDate` (defaults now), `entryProgramId`, `entryAcademicUnitId`, `quotaId`, `admissionSourceId`, `status` (defaults `ACTIVE`), `sourceApplicantId`.
- **Deliberately no `academicYearId`** — an Admission is a branch-scoped "spell of study" that can span multiple academic years across multiple Enrollments; putting a year on it would be "semantically wrong."
- One `ACTIVE` Admission per Student, DB-enforced (`admission_one_active` partial unique index).
- Event: `AdmissionCreatedEvent`, transactional via outbox.

---

## 22. Enrollment Creation

`EnrollmentService.createInitialEnrollment()` (`enrollment.service.ts:132-217`) — **the only creation path**; there is no `POST /enrollments` route by design ("Enrolments are born from `admit()`, promotion, repeat, correction, transfer, readmission and the migration importer — each of which knows a *reason*").

- Fields written: `admissionId`, `studentId`, `programId`, `academicUnitId`, `enrollmentKind: PRIMARY` (default), `enrollmentStatus: ACTIVE` (application-layer default — the Prisma column default is actually `PENDING`, overridden at the service layer for this call), `originType: 'ADMISSION'`, `applicantId` (provenance), `rollNumber: null` (deliberately left for a later manual step — "inventing one at admission would produce a number nobody can explain").
- Cross-reference validated via **composite foreign keys** at the DB level (`Enrollment(admissionId,studentId,branchId)→Admission`, `Enrollment(academicUnitId,branchId,programId,academicYearId)→AcademicUnit`), not primarily in application code.
- **Gap**: the architecture doc requires checking `AcademicUnit.isActive && !isDeleted`; the actual service only checks `AcademicYear` lock/deletion, never `AcademicUnit.isActive`/`isDeleted` directly — a real, current gap, not just a stale doc note.
- One `PRIMARY` Enrollment per (Admission, AcademicYear) at a time, DB-enforced; a Student/Admission can hold many Enrollments across years.
- No enrollment code/number exists — only the UUID.
- Event: `EnrollmentCreatedEvent`, transactional via outbox.

---

## 23. Events

Mechanism: `EventBus` (in-process `EventEmitter`, synchronous fan-out, errors caught per-listener) plus `OutboxPublisher`/`OutboxRelay` (transactional persistence + reliable at-least-once async redelivery, polling every 2s). Almost every write in the admit chain uses `outbox.enqueue(event, tx)`; a small number of non-transactional paths (masters CRUD, document downloads, document-type CRUD) call `eventBus.publish()` directly and are explicitly documented as non-transactional.

| Step | Event | Producer | Transactional? | Outbox? | Audited? | Sensitive data excluded? |
|---|---|---|---|---|---|---|
| Person created (at SUBMIT or admit fallback) | `person.created` | `PersonService.insertPerson` | Yes | Yes | Yes | Yes — payload is `{personId, organizationId, hasGovernmentId:boolean}` only |
| Applicant DRAFT→SUBMITTED | `applicant.submitted` | `WorkflowService` | Yes | Yes | Yes | Yes |
| →UNDER_REVIEW | `applicant.review_started` | `WorkflowService` | Yes | Yes | Yes | Yes |
| Documents requested/received, fee requested, waitlisted | `applicant.documents_requested` / `.documents_received` / `.fee_requested` / `.waitlisted` | `WorkflowService` | Yes | Yes | Yes | Yes |
| →APPROVED (offer) | `applicant.offer_issued` | `WorkflowService` | Yes | Yes | Yes | Yes |
| →SEAT_CONFIRMED | `applicant.seat_confirmed` | `WorkflowService` | Yes | Yes | Yes | Yes |
| Applicant lock/re-validate (admit step 1-2) | — none — | — | — | — | — | (a guard, not a write; no event expected) |
| Person re-resolve (admit step 3, only if needed) | `person.created` (conditional) | `PersonService` | Yes | Yes | Yes | Yes |
| Student created (admit step 5) | `student.created`, `student.code_assigned` | `StudentService` | Yes | Yes | Yes | Yes — no DOB/address/govt ID in payload |
| Guardianship sync (admit step 5.5) | `guardianship.created` | `GuardianshipService` | Yes | Yes | **NO — confirmed audit gap** | payload is ids-only, but irrelevant since not audited at all |
| Admission created (admit step 6) | `admission.created` | `AdmissionService` | Yes | Yes | Yes | Yes |
| Enrollment created (admit step 7) | `enrollment.created` | `EnrollmentService` | Yes | Yes | Yes | Yes |
| Applicant →ADMITTED (admit step 8) | `applicant.admitted` | `WorkflowService` (orchestrated) | Yes | Yes | Yes | Yes |
| (post-commit) outbox relay | replays all of the above onto `EventBus` | `OutboxRelay` | N/A (post-commit) | — | Audit rows written **asynchronously**, not synchronously with the HTTP response | — |

No event name in this table was invented — all are read directly from `src/common/events/*.ts` and confirmed to have live emission call sites.

---

## 24. Audit

Mechanism: **event-driven, not decorator/interceptor-based.** `AuditListener` subscribes to a **hardcoded allowlist** of event names (`audit.listener.ts:10-101`) via `EventBus.subscribe()`. There is no `@Audit()` decorator anywhere in the codebase (confirmed by grep — zero matches).

- Audit record contents: actor (userId/email/role), action (inferred from event name pattern, e.g. "created"→CREATE), aggregate type/id, org/branch/academic-year scope, request/trace/correlation IDs, HTTP method/route, severity, and `metadata.payload` (a verbatim copy of the event's own payload).
- **No independent masking layer inside the audit pipeline** — `AuditEventMapper` copies the event payload as-is. Safety depends entirely on every event class upstream already excluding sensitive fields (which, per §23, they do — by convention and code review, not by an audit-side filter).
- **Confirmed audit gaps**: `document.*` events (uploaded, verified, rejected, archived, downloaded, scan-failed) are **never** registered for audit — none produce an audit row. `guardianship.created` and `guardian.person_linked` are also unregistered. This includes the Guardianship sync that happens **inside the admit() transaction itself** (step 5.5) — it fires an event, but that event leaves no audit trail.
- Historical note: `applicant.rejected`/`applicant.withdrawn` were once missing from the allowlist too ("bypassed audit silently") — since fixed, per a comment in `audit.listener.ts` itself, useful context for why this allowlist pattern is worth watching.

---

## 25. Outbox

`OutboxPublisher.enqueue(event, tx)` writes an `OutboxEvent` row on the **caller's own transaction client** — guaranteeing the event row exists if and only if the business write committed. `OutboxRelay` polls every 2 seconds, claims `PENDING` rows with `SELECT ... FOR UPDATE SKIP LOCKED`, republishes them onto `EventBus`, and marks them `PUBLISHED` on success or backs off exponentially (up to 10 attempts) on failure.

- **Delivery is at-least-once.** `AuditRepository` is built to tolerate redelivery via a unique `eventId` + `createMany({skipDuplicates})`.
- This is the **primary, actively-used mechanism** across the entire admit chain — every service touched during admission (`applicant`, `workflow`, `person`, `address`, `student`, `admission`, `enrollment`, `guardian`, `guardianship`, `document`) uses it. It is not generic unused infrastructure.
- Practical consequence: there is a real (usually sub-few-second) window between "the HTTP response for `admit()` returns" and "the corresponding audit rows exist" — confirmed by an integration test that explicitly asserts no audit row exists for a transaction that rolled back, and that the system survives the relay failing after a commit.

---

## 26. Security

At every boundary in this trace:

- **Scope discipline**: every read is `findFirst` scoped by `organizationId` (+ `branchId` where relevant) + `deletedAt: null` — `findUnique({where:{id}})` alone is documented as a forbidden pattern precisely because it would be an enumeration oracle.
- **404 vs 403**: a scope miss (wrong org/branch, or soft-deleted) is **404**, never 403 — a 403 would leak the existence of a record outside the caller's scope. The one deliberate exception is a locked academic year, which is 403 by design (the record's existence isn't secret, the lock is the point).
- **Permission model**: route-level guard (coarse) + service-level `assertPermitted`/`evaluateGuard` (fine) at every workflow transition and at `admit()` specifically (which requires **two** permissions simultaneously: `Admissions.Approve` and `Student.Create`). No HTTP route exists that can create Student/Admission/Enrollment directly, set `admissionStatus` by hand, or reach `ADMITTED` without going through `admit()`.
- **Sensitive-data masking**: government IDs are never stored in plaintext in the identity system (HMAC blind index for lookup, AES-256-GCM for the recoverable value); event payloads and audit records carry only booleans/ids/kinds for anything identity-adjacent (`hasGovernmentId`, `idType`, never the value itself); documents are encrypted before ever touching the storage adapter, and non-CLEAN scan results are unconditionally refused for download regardless of role.
- **Aadhaar handling**: hashed for matching, encrypted for recovery, masked for display, crypto-erasable on request while preserving the blind index (to prevent an erased subject from silently re-enrolling as a "new" person) — **except** the two known plaintext leaks (`Applicant.aadhaarNo`, `Guardian.aadhaarNo`) documented in §6 and §7, which are real, acknowledged gaps outside the Person/PersonSensitive system.
- **Document authorization**: ownership resolved server-side within the caller's verified scope (`OwnerResolverService`) before any Document row is created — a cross-tenant `ownerId` produces 404, never 403. Verify/reject/archive require branch-admin tier or above; sensitive document types additionally refuse plain staff.

---

## 27. Final Database State (after successful admission)

Conceptual only — no actual values shown.

**Person**: one row, org-scoped, government-ID blind index set, `PersonSensitive` holds the encrypted Aadhaar ciphertext + last-4 for display.

**Applicant**: status `ADMITTED` (terminal, frozen), `personId` set, all inline snapshot fields intact as originally submitted, `applicationNo`/`admissionFormNo` unchanged.

**Guardian**: one row for Rizwan Sayyed, `personId` set (resolved during the admit-time or map-time sync). One `ApplicantGuardianMapping` (isPrimary/isFinancialGuardian true) plus one `Guardianship` (Person-to-Person, DB-enforced unique as primary+financial for this ward).

**Address**: none created automatically for the applicant's declared address (per §19's open question #5) — the Applicant's inline address snapshot remains the only address record tied to this application unless a `PersonAddress` was separately attached.

**Documents**: 4 `Document` rows (Photo, Birth Certificate, Marksheet, Aadhaar copy), each with at least one `VERIFIED` `DocumentVersion`, `ownerType: APPLICANT` (or `PERSON` if uploaded there).

**Student**: one row — `personId` (unique), `studentCode` (permanent, org-unique), `status: ACTIVE`, `branchId: Mumbai`, `sourceApplicantId` pointing back at the Applicant, own current-truth demographic snapshot.

**Admission**: one row — `admissionNo` (branch-unique), `admissionType: REGULAR`, `entryProgramId: B.Sc IT`, `entryAcademicUnitId: First Year`, `status: ACTIVE`, `sourceApplicantId` set, no `academicYearId` (by design).

**Enrollment**: one row — `admissionId`, `studentId`, `programId: B.Sc IT`, `academicUnitId: First Year AY2026-27`, `enrollmentKind: PRIMARY`, `enrollmentStatus: ACTIVE`, `originType: ADMISSION`, `rollNumber: null` (assigned later, manually).

---

## 28. Downstream Handoff

What becomes available after `admit()` commits, and what each future module should bind to:

| Module | Primary identifier | Secondary identifier | Should reference | Status |
|---|---|---|---|---|
| Fees | `studentId` (person-scoped charges) or `enrollmentId` (year-scoped charges) | `admissionId` (spell-scoped, e.g. one-time admission fee) | Enrollment for recurring/term fees; Admission for one-time admission fees | Future — not implemented in this codebase slice |
| Attendance | `enrollmentId` | `academicUnitId` | Enrollment (attendance is inherently year+placement scoped) | Future |
| Examination | `enrollmentId` | `studentId` | Enrollment — `Enrollment.resultOutcome` field already exists in schema, reserved for Examination to write, never written by Enrollment code itself | Schema-ready, module not implemented |
| Transport | `studentId` | `branchId` | Student (transport is branch/person scoped, not year scoped) | Future |
| Library | `studentId` | — | Student | Future |
| Parent Portal | `guardianPersonId` via `Guardianship` → `wardPersonId` | — | Guardianship (already Person-to-Person, portal auth would resolve guardian's Person to their wards) | Future |

The identifier-scoping rule documented in the architecture blueprint (and consistent with what's built): **year-scoped facts attach to `enrollmentId`, person-scoped facts attach to `studentId`, spell-scoped facts attach to `admissionId`.** `studentCode` is human-facing display only — never a valid foreign-key target for any future module.

---

## 29. Complete Workflow Diagram

```
                         Person (org-scoped, HMAC blind-index + AES-256-GCM sensitive table)
                           ▲  resolved/reused, never overwritten
                           │
Applicant (DRAFT) ─────────┘
   │  editable while DRAFT..WAITLISTED
   │
   ├── Guardian ──personId?──► ApplicantGuardianMapping ──(both resolved)──► Guardianship
   │                                                                          (Person↔Person,
   │                                                                       DB-unique primary/financial)
   │
   ├── (inline address snapshot — frozen forever, never becomes a PersonAddress)
   │
   └── Documents ── DocumentRequirement (by program×quota×category×stage)
                     └── DocumentVersion (append-only; checksum, encryption, scan, verify/reject)
                            gate: DOCUMENT_CHECKLIST_SATISFIED
                            enforced ONLY on: documentsReceived, approve
                            NOT enforced on: confirmSeat, admit

   SUBMIT (Person bound) → UNDER_REVIEW ⇄ DOCUMENT_PENDING/FEE_PENDING/WAITLISTED
        → APPROVED (offer, frozen, has expiry)
        → SEAT_CONFIRMED (frozen)
        │
        ▼
   ┌─────────────────────────── ADMIT TRANSACTION (one $transaction, READ COMMITTED) ───────────────────────────┐
   │  1. Lock Applicant FOR UPDATE          5. Create Student (studentCode allocated first)                     │
   │  2. Re-verify SEAT_CONFIRMED           5.5. Sync Guardianship from mappings                                │
   │  3. Resolve/reuse Person               6. Create Admission (admissionNo allocated)                          │
   │  4. Refuse if Student already exists   7. Create Enrollment (status ACTIVE)                                 │
   │                                        8. Applicant → ADMITTED (orchestrated-only, last write)              │
   │  all 5 domain events written to outbox transactionally; rollback = full rollback (except burned numbers)    │
   └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
   ACTIVE STUDENT
   ├── Student.id (UUID, relational key)         ├── Admission (branch-scoped, 1 ACTIVE)
   ├── Student.studentCode (org-unique, human)    │     └── Enrollment (branch+year-scoped, 1 PRIMARY/year)
   └── Student.personId (unique, 1:1 Person)      │           ├── Program
                                                    │           └── AcademicUnit
        │
        ▼
   Future modules bind to: enrollmentId (year-scoped) | studentId (person-scoped) | admissionId (spell-scoped)
```

---

## 30. Known Gaps / Deferred Behavior

Consolidated from every section above.

| # | Gap | Status | Where documented in code/tests |
|---|---|---|---|
| 1 | Deferment does not create a linked new Applicant — `deferredFromApplicantId` is never set by any code path | **NOT SUPPORTED** | §14; `applicant.prisma` field exists, no DTO/service writes it |
| 2 | `DEFERMENT_ENABLED` is hardcoded `false`, no tenant config exists | **DEFERRED** | `admission-config.provider.ts:43-45` |
| 3 | Seat-hold policy during deferment | **REQUIRES BUSINESS DECISION** | flagged `PROPOSED` in lifecycle spec |
| 4 | `Applicant.aadhaarNo` / `Guardian.aadhaarNo` still plaintext, not migrated into Person/PersonSensitive | **DEFERRED** (business decision, load-bearing in live code) | §6, §7; `applicant.prisma:30`, `guardian.prisma:30` |
| 5 | Guardian is still branch-scoped, not org-scoped; `Guardian.personId` still nullable, not required | **DEFERRED** | §7; `docs/planning/02-guardian-family/01-guardian.md` |
| 6 | Guardian's legacy inline address columns not dropped/backfilled into PersonAddress | **DEFERRED** | §8 |
| 7 | Guardianship primary/financial handover is in-place update, not append-only new-row-per-handover as designed | **DEFERRED** (partial implementation) | §7 |
| 8 | `ApplicantGuardianMapping.isFinancialGuardian` has no exclusivity enforcement (unlike `Guardianship`, which is DB-enforced) | **DEFERRED** | §7 |
| 9 | Person merge (`merge()`, `PersonMergeLog`, `person.merged` event) fully designed, entirely unimplemented | **NOT SUPPORTED** | §6; `PersonMergeLog` comment: "Nothing writes to this table yet" |
| 10 | Real virus scanner (ClamAV/cloud) — production refuses uploads without one, by design (fails safe) | **DEFERRED** | §9 |
| 11 | Cloud document storage (S3/R2/GCS) — factory throws at boot if configured | **DEFERRED** | §9 |
| 12 | Document retention/archival sweep — `retentionYears` field exists, nothing reads it | **DEFERRED** | §9 |
| 13 | Document checklist gate not enforced on `confirmSeat` or `admit()` — only on `documentsReceived`/`approve` | **NOT SUPPORTED** (by current design) | §9, §19 |
| 14 | Readmission reuse of an existing Student — blueprint describes it, code hard-refuses with `STUDENT_ALREADY_EXISTS` | **DEFERRED**, explicit deviation | §19 |
| 15 | Only 1 of 3 documented `WorkflowHistory` rows written per admit (Applicant only, not Admission/Enrollment) | **DEFERRED**, already flagged as RECOMMENDED fix in lifecycle spec | §19 |
| 16 | Applicant's declared address never copied into a `PersonAddress` at admit time (blueprint claims it should be) | **UNCONFIRMED GAP** — flagged for follow-up, not verified either way | §19 |
| 17 | `guardianship.created` and `guardian.person_linked` events are never audited (not in `AuditListener`'s allowlist) — includes the admit-time Guardianship sync | **CONFIRMED GAP** | §24 |
| 18 | `document.*` events (upload/verify/reject/archive/download/scan-failed) never audited | **CONFIRMED GAP** | §24 |
| 19 | Promotion, repeat-year, cross-branch transfer, readmission, migration-import for Enrollment — enum values/fields exist, no orchestrating service/route built | **DEFERRED** (Phase 6, per code comments) | §22 |
| 20 | Enrollment creation doesn't check `AcademicUnit.isActive`/`isDeleted`, only `AcademicYear` lock/deletion | **CONFIRMED GAP** | §22 |
| 21 | Seat capacity checking — no capacity matrix exists anywhere in the admission workflow | **NOT SUPPORTED** | §19, cross-referenced in `core-domain-freeze-v1-audit.md` |
| 22 | `NUMBERING_NOT_PROVISIONED` — documented as 500, actual pre-check throws 400 (a deeper defense-in-depth path still throws 500) | **DOC/CODE MISMATCH** | §19 |
| 23 | `ApplicantDto` Swagger enum only lists 6 of 13 actual `admissionStatus` values; its own doc-comment incorrectly calls the field "free-text" when it's a real Postgres enum | **DOC/CODE MISMATCH** (DTO-level, cosmetic) | §10 |

---

# FLOW VERIFICATION STATUS

**Happy Path:** PASS
**Applicant Lifecycle:** PASS — full 13-state machine implemented and matches documented transition table, one confirmed doc/code cosmetic mismatch in the response DTO's Swagger enum
**Person Identity:** PASS — deterministic + fuzzy dedup both implemented and race-safe; GAP: Person merge entirely unimplemented; GAP: plaintext Aadhaar still present on Applicant/Guardian outside the encrypted system
**Guardian:** PASS with GAPS — Guardian/Guardianship/mapping all implemented and functionally correct for the happy path; several documented target-state items (org-scoping, required personId, address column removal, full append-only history) not yet built
**Address:** PASS — immutability, 4 types, historical resolution, Applicant's frozen-snapshot design all implemented as intended; GAP: Guardian's legacy address columns not yet migrated away
**Documents:** PASS with a scoped GAP — requirement/versioning/verification/encryption/scanning-interface/checklist-computation all implemented; checklist gate deliberately not enforced at `confirmSeat`/`admit`; real virus scanning and cloud storage deferred (fail-safe, not silently degraded)
**Admission:** PASS — Admission model, branch-scoping, one-ACTIVE-per-student constraint, numbering all implemented as designed
**Student:** PASS — one Student per Person enforced at the DB level; no reuse/readmission path (deliberate, documented divergence from the original blueprint)
**Enrollment:** PASS with GAPS — initial-enrollment creation is solid and transactional; promotion/repeat/transfer/readmission/migration all schema-ready but not orchestrated; `AcademicUnit.isActive` not checked
**Transaction (ADMIT):** PASS — single transaction, correct lock ordering, verified rollback-on-any-failure, verified 20-way concurrency safety; the numbering-gap-on-rollback behavior is intentional and documented, not a defect
**Security:** PASS — scope discipline (404-not-403), dual permission requirement on admit, sensitive-data masking in events/audit all verified; the plaintext-Aadhaar gap (item 4 above) is the one live exception worth flagging to a security reviewer explicitly
**Events/Audit/Outbox:** PASS with CONFIRMED GAPS — the outbox pattern is used consistently and correctly across the entire admit chain; two concrete audit blind spots exist today: `guardianship.created` (including the one that fires inside `admit()` itself) and all `document.*` events are never audited

**Blocking Issues:** None found that prevent the happy path from working correctly and safely. The audit blind spots (items 17–18) are the closest thing to a blocking concern, since they mean a real compliance/security review of "who linked which guardian to which ward" or "who uploaded/verified/downloaded which document" currently has no audit trail to consult — everything else is a functional gap in unbuilt future capability, not a defect in what's live.

**Deferred/Not Implemented (highest-impact, ranked):**
1. Deferment → new-Applicant linkage (fully absent, not just partial)
2. Person merge (fully absent)
3. Guardianship/document event audit coverage (confirmed, fixable gap)
4. Plaintext Aadhaar still reachable outside the encrypted Person system
5. Enrollment promotion/repeat/transfer/readmission/migration orchestration
6. Seat capacity enforcement (does not exist anywhere in the pipeline)
7. Real virus scanning / cloud document storage

**Final Recommendation:** The admission→student conversion pipeline is production-solid for the single-branch, first-entry, happy-path-plus-common-failure-modes case this document traces — the transaction boundaries, locking, and rollback behavior are rigorously tested and match their documented design closely. Before treating the module as fully frozen, prioritize closing the two confirmed audit blind spots (Guardianship, Documents) since they're small, well-scoped fixes with real compliance weight, and make an explicit business decision on the plaintext-Aadhaar carry-forward rather than letting it linger as an implicit gap. Deferment-linkage, Person-merge, and Enrollment's post-admission lifecycle (promotion/repeat/transfer) are real product gaps but are correctly scoped out of this admission-only trace and can be sequenced independently.
