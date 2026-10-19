# Applicant Admission Lifecycle — Contract Analysis

**This is an analysis document, not an implementation.** It exists to give a
future `src/features/admissions` build (Applicant → Person → Guardian →
Documents → Workflow → Student → Admission → Enrollment) a verified backend
contract to build against, in the spirit of
[`docs/admission-masters-module.md`](./admission-masters-module.md) and
[`docs/backend-gaps.md`](./backend-gaps.md). No frontend code, routes or
feature folder are added by this document — see
[Backend Contract Gaps §M](./backend-gaps.md#m-applicant-admission-lifecycle)
for the gap ledger this analysis feeds.

Per [AGENTS.md §28](../AGENTS.md#28-contract-driven-modules), backend source
was never read directly. One partial exception is disclosed explicitly in
[§0](#0-sources-and-how-they-were-weighed) below: this module's own backend
docs include a reconciliation document that itself cites backend source files
line-by-line as evidence for each claim it makes — that document is treated
here as a verified proxy for source, not as source read directly.

---

## 0. Sources, and how they were weighed

Ten backend documents were read in full or by targeted section, plus the
"Admissions", "Document", "Document Requirement", "Document Type",
"Enrollment", "Person", "Student" and "Numbering" folders of
`backend/postman/erp.postman_collection.json` (61 non-master requests,
extracted programmatically — see §7 for how this differs from every other
module in this codebase).

| Source | What it is | Dated |
| :--- | :--- | :--- |
| `backend/docs/planning/core-admission-lifecycle-specification.md` | **The primary authority for this document.** A *reconciliation*, not a design: every material statement is tagged `IMPLEMENTED` / `VERIFIED` (with the exact source file named) / `DECIDED` / `RECOMMENDED` / `PROPOSED` / `DEFERRED` / `REQUIRES BUSINESS DECISION` / `REQUIRES R&D`. Baseline dated 2026-08-12, with two later dated addenda folded in (§8.7 "R4.5", 2026-08-16; §11.8 "R5", 2026-08-17). | 2026-08-12 → 2026-08-17 |
| `backend/docs/planning/document-management-specification.md` | The Documents module's own R5 spec, "implemented ✅ — foundation only" | 2026-08-17 |
| `backend/postman/erp.postman_collection.json` | Wire ground truth. **Unlike every other module in `backend-gaps.md`, this collection's Admissions/Document/Person/Student/Enrollment folders carry real, non-empty example response bodies on almost every request**, not the `body: ""` placeholder every other module uses | undated, but demonstrably later than 2026-08-12 (see §10 discovery) |
| `backend/docs/planning/01-identity-core/{01-person,02-applicant,03-05-admission-student-enrollment}.md`, `02-guardian-family/01-guardian.md`, `03-address/01-address.md`, `04-documents/01-document.md` | The original design-delta specs (`I1`–`I5`, `S1`–`S3`). Each is headed `Status: planned`. Cited for *rationale* only; superseded wherever the lifecycle spec documents a different as-shipped shape | pre-dates the reconciliation |
| `backend/docs/modules/admissions.md` | Architecture overview: folder structure, event catalogue, duplicate-warning engine, multi-tenancy | undated |
| `backend/docs/admissions/{admissions-production-audit,admissions-validation-matrix,numbering-review,security-review,logging-review,testing-checklist}.md` | Phase-1 audit trail. Several findings here are the *pre-fix* description of defects the lifecycle spec's later addenda confirm were subsequently closed — flagged explicitly wherever that applies | Phase 1, pre-dates R4.5/R5 |
| `backend/docs/domain/05-06-admission-enrollment.md` | Earlier design-guidance memo that originated the four-layer Applicant→Student→Admission→Enrollment model | earliest layer |

### The precedence rule this document follows

1. **The lifecycle spec's own internal dating wins.** Where two sections of
   `core-admission-lifecycle-specification.md` disagree, the later-dated one is
   current — e.g. §8.7 (R4.5, 2026-08-16) corrects §1 and §46 (2026-08-12) on
   guardians; §11.8 (R5, 2026-08-17) corrects §2.2 and §7.5 (2026-08-12) on
   documents and the checklist guard. **This document only ever states the
   latest-dated position**, and calls out the earlier one only where it adds
   context (a fixed defect, a corrected discrepancy).
2. **Postman's actual example bodies fill in exact field/endpoint shape** the
   lifecycle spec describes narratively — and, per §10, occasionally reveal a
   module shipped *after* the lifecycle spec's own last-dated addendum.
3. **The individual `I1`–`I5`/`S1`–`S3` planning docs are cited for rationale
   only**, and are explicitly marked wherever what they describe is not
   confirmed as shipped.
4. `admissions-production-audit.md` and `security-review.md` are cited for
   **historical defects**, each one cross-checked against the lifecycle spec
   for whether it was later closed.

---

## 1. The five-layer model, as it actually exists today

```
Person      is this the same human?           →  matching keys only, no lifecycle, org-scoped
Applicant   what was declared, this attempt?  →  frozen legal snapshot, branch + year scoped
Student     who is this learner, permanently? →  identity + current demographics, org-scoped
Admission   which spell of study?             →  branch-scoped, immutable, entry → exit
Enrollment  where are they placed this year?  →  year-scoped, superseded not edited
```

Two supporting modules sit beside this spine:

```
Guardian / Guardianship   the caring relationship — who is primary, who pays, who may collect
Documents                 what proves it — versioned, verified, checklist-gated
```

`docs/modules/admissions.md`'s own framing — "Applicant ≠ Student" because
Applicant is short-lived/volatile and Student is the permanent record;
"Enrollment ≠ Student Identity" because Enrollment is the academic-year
placement, Student is who they are — is the same distinction the lifecycle
spec formalizes with the table above. Nursery→Std 10 is **one Person, one
Student, one Admission, twelve Enrollments** — the model's own canonical test
(lifecycle spec §4.1, scenario table §11 of the I3+I4+I5 doc).

### 1.1 What actually exists, by layer (as of the lifecycle spec's own status table, §2.1)

| Layer | Model(s) | Routes | Status |
| :--- | :--- | :--- | :--- |
| Identity index | `Person`, `PersonSensitive`, `PersonMatchDecision`, `PersonMergeLog` | `/v1/persons/**` | `IMPLEMENTED` `VERIFIED` |
| Application | `Applicant`, `ApplicantProgramPreference` | `/admissions/applicants/**` | `IMPLEMENTED` `VERIFIED` |
| Workflow | `WorkflowHistory` (polymorphic) | `POST …/workflow/transition`, `GET …/history` | `IMPLEMENTED` `VERIFIED` |
| Guardian | `Guardian`, `ApplicantGuardianMapping`, `Guardianship` | `/admissions/guardians/**`, `/admissions/guardianships/**` | `IMPLEMENTED` — corrected substantially by R4.5, see §5 |
| Learner identity | `Student` | `GET /students`, `.../lookup`, `.../:id`, `PATCH .../:id` | `IMPLEMENTED` `VERIFIED` |
| Spell of study | `Admission` | **none** — controlled creation only, inside `admit()` | `IMPLEMENTED` `VERIFIED` |
| Placement | `Enrollment` | `GET /enrollments`, `.../:id`, `.../:id/history`, `POST .../correct`, `.../transfer`, `.../cancel`, `PATCH .../roll-number` | `IMPLEMENTED` `VERIFIED` |
| Conversion | — | `POST /admissions/applicants/:id/admit` | `IMPLEMENTED` `VERIFIED` |
| Documents | `Document`, `DocumentVersion`, `DocumentType`, `DocumentRequirement` | `/documents/**`, `/document-requirements/**`, `/document-types/**` | `IMPLEMENTED` (R5, "foundation only") — see §6 |
| Numbering | `NumberSequenceConfig`, `NumberSequenceCounter` | `/numbering/**` | `IMPLEMENTED` `VERIFIED` |

**Corrected against the lifecycle spec's own baseline table**: Address
(`Person`-scoped) is listed there as `DEFERRED (S2)` — but §10 below shows the
Postman collection contains real, working `/v1/persons/:id/addresses`
endpoints matching the S2 design almost field-for-field. Treat the baseline's
"Address: deferred" as **stale**, superseded by a later, undated release.

---

## 2. Person — identity resolution

Source: `01-identity-core/01-person.md` (rationale), lifecycle spec §5,
Postman `Person > *`.

### 2.1 What Person is, and is not

Person answers exactly one question — *"is this the same human?"* — and owns
**nothing else**: no display name, no address, no photo, no contact detail.
Those live on `Applicant` (frozen snapshot), `Student` (current official
truth) and `Guardian` (current truth), which are allowed to diverge from each
other. A pull request adding a display/contact attribute to Person is, by the
doc's own words, "rejected on sight."

### 2.2 Fields (confirmed via Postman `GET /v1/persons/:id`)

The complete, confirmed read shape — 8 fields, nothing more:

```
id, organizationId, dob, governmentIdMasked, governmentIdErased,
mergedIntoPersonId, createdAt, governmentIdType
```

No name, mobile or email — those belong to whichever role record (Applicant/
Guardian/Student) is asking. No `branchId` at all: **Person is
organization-scoped, never branch-scoped.** `mergedIntoPersonId` confirms a
merge/tombstone concept exists at the schema level; `governmentIdErased`
confirms a right-to-erasure flag exists specifically for the government
identifier.

Underlying schema fields (from the design doc, not directly exposed):
`govtIdHash` (blind index over Aadhaar), `phoneHash` (blind index over the
contact number), `nameNormalized` (never rendered to a user — low-confidence
fuzzy-match input only). `dob` is **required** — the one field that
meaningfully discriminates same-named people, and the only one a nullable
version would silently degrade every match on.

### 2.3 `resolve()` vs `findCandidates()` — deterministic reuse, never a block

Two distinct operations, by design, because "same person" and "might be the
same person" have different failure costs:

- **`resolve()` never blocks. It reuses.** A matching `govtIdHash` (i.e. same
  Aadhaar) returns the existing Person silently — no warning, no duplicate. No
  Aadhaar → a new Person is created from `dob` + `nameNormalized` +
  `phoneHash`.
- **`findCandidates()` warns, never blocks.** `MEDIUM` confidence = matching
  `phoneHash` + `dob` (a household number shared by siblings); `LOW` = matching
  `nameNormalized` + `dob` only. A pair a human has already reviewed and
  confirmed distinct is recorded in `PersonMatchDecision` and **excluded from
  future results** — so the same twin warning does not fire at every step of
  every year.

Both run together at `resolve()`-time: the caller always gets a usable
Person, and any candidate warnings ride alongside it as non-blocking
information.

### 2.4 Endpoints (Postman-confirmed)

| Method | Path | Notes |
| :--- | :--- | :--- |
| `POST` | `/v1/persons/match` | Fuzzy candidate search. **Does not accept a government identifier as a search term** — deterministic matching by identifier is `resolve()`'s job, and accepting it here would let a caller probe "does this org hold this identifier?" |
| `GET` | `/v1/persons/:id` | §2.2 shape. Requesting a merge tombstone returns `308` to the survivor, not `404` — a stale reference self-heals |
| `POST` | `/v1/persons/:id/government-id` | Bind a late-arriving Aadhaar. `409` if it already belongs to another Person — **a conflict for a human to resolve, never a silent overwrite** |
| `POST` | `/v1/persons/match-decisions` | Record a reviewed non-match (`{ personAId, personBId, reason }`) |

**No `POST /v1/persons`** (a Person is only ever created as a side effect of
creating an Applicant, Guardian or Student) and **no `DELETE`** (a Person is
never deleted — DPDP erasure nulls the *sensitive* data and leaves the row
standing, so it keeps deduplicating even after erasure).

### 2.5 Identity resolution at submission — the exact sequence

`SUBMIT` (`DRAFT → SUBMITTED`) is the **one** transition that also establishes
identity, inside the same transaction, after the row lock:

```
programId missing        → 400 PROGRAM_REQUIRED
personId already set     → reuse it
aadhaarNo present         → resolve WITH the government id (deterministic)
  …validation fails       → log a warning WITHOUT the value, degrade to demographics
aadhaarNo absent          → resolve on demographics (always creates)
candidate warnings        → logged, NEVER blocking
duplicate active app      → 409 DUPLICATE_ACTIVE_APPLICATION
```

`Applicant.personId` is nullable in `DRAFT` and **required from `SUBMITTED`
onward** (`CHECK ("admissionStatus" = 'DRAFT' OR "personId" IS NOT NULL)`),
enforced at the database level, not merely in application code.

### 2.6 The gap the master prompt's UX design assumes away

**No "existing Person found" vs "new Person created" indicator is documented
anywhere.** Neither the Applicant response shape nor any `Person` endpoint
returns a `matchedBy` / `isNewPerson` flag. Building the "Identity resolved →
✓ Existing Person found / ✓ New Person created" screen the design brief
describes therefore has **no field to bind to** — see gap AP1 in
[backend-gaps.md §M](./backend-gaps.md#m-applicant-admission-lifecycle).

### 2.7 Merge — designed, not executable

`PersonMergeLog` and `mergedIntoPersonId` exist at the schema level and the
*algorithm* is fully specified (resolve both sides to their final survivor,
reject self-merge, repoint every Applicant/Student/Guardian reference,
tombstone the loser, carry across a government id the loser held that the
survivor did not) — but **execution is `DEFERRED`**: nothing in the current
codebase calls it. A frontend must not build a "Merge Person" action; there is
nothing to call.

---

## 3. Applicant

Source: `01-identity-core/02-applicant.md` (rationale), lifecycle spec §6–§7,
Postman `Admissions > Applicant`.

### 3.1 What it owns

One admission attempt — one application, to one branch, for one academic
year. Its demographic fields are a **frozen legal snapshot of what was
declared on a date** — not a live record. This is deliberate: a name
corrected by affidavit in 2029 must not silently rewrite the 2026 application
form.

### 3.2 Confirmed request/response fields (Postman `POST /v1/admissions/applicants`)

Request body, 43 fields:

```
firstName, middleName, lastName, dob, genderId, birthPlace, photoFileId,
religionId, casteId, categoryId, motherTongueId, bloodGroupId,
disabilityStatus, disabilityTypeId, disabilityNotes, aadhaarNo, penNo,
apaarId, primaryMobile, alternateMobile, primaryEmail, currentAddressLine1,
currentAddressLine2, city, district, state, country, pincode,
previousSchoolName, previousBoard, previousClass, previousPercentage,
tcNumber, admissionSourceId, quotaId, programId, internalRemarks,
counsellorRemarks, assignedCounsellorId, transportRequired, hostelRequired,
customFieldData, checklistStatus, tags, formTemplateVersion
```

Response adds: `id, organizationId, branchId, academicYearId,
admissionFormNo, applicationNo, displayName, admissionStatus, submittedAt,
approvedAt, rejectedAt, cancelledAt, createdBy, updatedBy, approvedBy,
rejectedBy, createdAt, updatedAt, deletedAt`.

**`personId` is not present in any captured response example** (create, get,
update or workflow-transition), even though §2.5 confirms it is bound at
submit and required from `SUBMITTED` onward at the database level. Treat this
as a documented-but-unconfirmed-in-example field rather than evidence the
field is absent — the lifecycle spec's `VERIFIED` tag on `Applicant.personId`
existing outranks an example response simply not showing it.

`GET /v1/admissions/applicants/:id` additionally expands `gender, religion,
caste, category, motherTongue, bloodGroup, disabilityType, admissionSource,
quota, guardians` — FK ids resolved to nested objects. List/create/update do
**not** include these expansions.

**`aadhaarNo` remains a plain top-level field today.** The design intends to
remove it from Applicant entirely (moved to `PersonSensitive`), but that
migration (`R17`, lifecycle spec §47.4) is listed as **not yet done** — and
Postman's captured request body still includes it. `Applicant.aadhaarNo`
plaintext is an open, `VERIFIED` defect (`D14`) — see §8.

### 3.3 Server-side search/filter/pagination — real, unlike every other module

`GET /v1/admissions/applicants` documents real query parameters: `search`
(matches displayName, mobile, aadhaar, applicationNo, formNo), `status`,
`page`, `limit`, `sortBy`, `sortOrder`. **This module has genuine server-side
list querying** — unlike branch, academic-year, program, academic-unit and
admission-masters, all of which push search/filter/sort/paging to the client
per `backend-gaps.md`. The list envelope nests pagination as `data: { items,
meta }` — the same convention already pinned for Audit Logs
(`backend-gaps.md` D4).

### 3.4 The one-active-application invariant

```sql
CREATE UNIQUE INDEX applicant_one_active ON "Applicant"
  ("personId","branchId","academicYearId")
  WHERE "personId" IS NOT NULL AND "deletedAt" IS NULL
    AND "admissionStatus" NOT IN ('REJECTED','WITHDRAWN','CANCELLED','DEFERRED')
```

A real, database-enforced rule — not a convention. Violated at submit →
`409 DUPLICATE_ACTIVE_APPLICATION`. Applying to a **different branch** is
explicitly allowed (separate Applicant, one Person).

### 3.5 `ApplicantProgramPreference`

`id, applicantId, programId, preferenceOrder, status, remarks`. At most one
row may reach `ALLOTTED` (partial unique index) — but the index is currently
**inert**: no operation writes `ALLOTTED` yet (`D26`), so this is only
meaningful once a programme-allotment feature ships. The lifecycle spec's own
`N4` decision notes the shipped status enum diverges from the design doc's
`PENDING/OFFERED/DECLINED/ALLOTTED` in favour of one using
`REJECTED`/`WITHDRAWN`, judged "arguably better" — **the exact value set is
not independently confirmed by Postman** (`GET`/`POST
.../applicants/:id/preferences` have **no success example** in the
collection, error bodies only).

`admit()` does **not** read this list at all (confirmed §4.9) — a school
setting `programId` directly on the Applicant never creates preference rows;
only an institution running an allotment round would.

### 3.6 Endpoints (Postman-confirmed)

| Method | Path | Notes |
| :--- | :--- | :--- |
| `POST` | `/v1/admissions/applicants` | Runs a duplicate check but does not block on it — the handler returns the applicant alone, warnings are not part of the response |
| `GET` | `/v1/admissions/applicants` | Real search/filter/sort/paging, §3.3 |
| `GET` | `/v1/admissions/applicants/:id` | Expanded read, §3.2 |
| `PATCH` | `/v1/admissions/applicants/:id` | Full-body convention, no partial-update rule documented |
| `DELETE` | `/v1/admissions/applicants/:id` | Soft delete of a `DRAFT` only; anything else is `403 APPLICANT_NOT_DELETABLE` (§3.7) |
| `POST` | `/v1/admissions/applicants/:applicantId/admit` | §4 |
| `POST` | `/v1/admissions/applicants/check-duplicates` | Advisory only — `{ hasDuplicates, matches }`, matches on Aadhaar/mobile/name+DOB |
| `GET`/`POST` | `/v1/admissions/applicants/:id/preferences` | §3.5 |

### 3.7 Edit locking (audit-confirmed)

The applicant is **frozen once it leaves `DRAFT` or `SUBMITTED`**; once
`APPROVED`, direct edits are fully locked. `admissionStatus` is editable only
via the workflow transition endpoint — never a general `PATCH`. Soft delete is
how a **draft** is closed, and only a draft: a submitted application is
withdrawn or cancelled instead (backend BP-17). The hub offers "Delete draft"
when the actions read reports `deleteDraft.available`.

Once an applicant has an identity (from submission on), a `PATCH` supplying an
Aadhaar that differs from the one the Person records is refused with
`409 GOVERNMENT_ID_MISMATCH` (`details.field: aadhaarNo`), shown beside the
field. If the Person has no Aadhaar yet, the edit records it on the Person too
— only for a caller holding `person.attach_government_id`, otherwise
`403 GOVERNMENT_ID_ATTACH_FORBIDDEN`, also shown beside the field. Guardians
follow the same rules.

---

## 4. Applicant workflow — the thirteen-state machine

Source: lifecycle spec §7 (`IMPLEMENTED` `VERIFIED` throughout — cross-checked
independently against Postman `Admissions > Workflow` and found consistent).

### 4.1 The engine

**One method drives every transition, human or scheduled.** The caller names
a verb, never a destination — `{ action: 'approve' }`, never `{ newStatus:
'APPROVED' }` — so a client cannot invent a path. Every transition, in one
transaction, in this order:

```
lock (SELECT … FOR UPDATE, scoped)
  → re-read status under the lock
  → assert the edge is legal from the current state
  → evaluate named guards
  → update status + stamped timestamps + actor column
  → write WorkflowHistory
  → enqueue the named outbox event
```

### 4.2 The thirteen states

| State | Meaning | Terminal | Editable |
| :--- | :--- | :--- | :--- |
| `DRAFT` | A form somebody is part-way through | no | ✅ |
| `SUBMITTED` | Filed; **Person bound here** | no | ✅ |
| `UNDER_REVIEW` | Being assessed | no | ✅ |
| `DOCUMENT_PENDING` | Waiting on paperwork | no | ✅ |
| `FEE_PENDING` | Waiting on an application fee | no | ✅ |
| `WAITLISTED` | Held pending a seat | no | ✅ |
| `APPROVED` | **Offer made, seat provisionally held** — not terminal | no | ❌ frozen |
| `SEAT_CONFIRMED` | Offer accepted; the **only** state `admit()` accepts | no | ❌ frozen |
| `DEFERRED` | Terminal *for this cycle*; continues as a new Applicant | no outbound edge | ❌ frozen |
| `ADMITTED` | Student, Admission and Enrollment exist | ✅ | ❌ frozen |
| `REJECTED` | Institution refused | ✅ | ❌ frozen |
| `WITHDRAWN` | Applicant walked away | ✅ | ❌ frozen |
| `CANCELLED` | Institution ended it, or the offer lapsed | reopenable | ❌ frozen |

`APPROVED` is **not terminal** — this corrects an earlier design answer some
older backend docs still state. `DEFERRED` has no outbound edge; the
continuation is a *new* Applicant carrying `deferredFromApplicantId`, never a
mutation of the deferred row.

### 4.3 The complete transition table

| Action | From | To | Permission | Reason | Guard | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `submit` | DRAFT | SUBMITTED | `admissions.update` | optional | — | binds `personId` |
| `startReview` | SUBMITTED | UNDER_REVIEW | `admissions.update` | optional | — | |
| `requestDocuments` | UNDER_REVIEW | DOCUMENT_PENDING | `admissions.update` | **required** | — | |
| `documentsReceived` | DOCUMENT_PENDING | UNDER_REVIEW | `admissions.update` | optional | `DOCUMENT_CHECKLIST_SATISFIED` | now real, §4.4 |
| `requestFee` | UNDER_REVIEW | FEE_PENDING | `admissions.update` | optional | — | |
| `waitlist` | UNDER_REVIEW | WAITLISTED | `admissions.approve` | **required** | — | |
| `approve` | UNDER_REVIEW, DOCUMENT_PENDING, FEE_PENDING, WAITLISTED | APPROVED | `admissions.approve` | optional | `DOCUMENT_CHECKLIST_SATISFIED` | stamps offer window |
| `confirmSeat` | APPROVED | SEAT_CONFIRMED | `admissions.update` | optional | `OFFER_NOT_EXPIRED` | |
| `defer` | APPROVED | DEFERRED | `admissions.approve` | **required** | `DEFERMENT_ENABLED` | **off by default** |
| `expireOffer` | APPROVED | CANCELLED | `admissions.approve` | optional | `OFFER_EXPIRED` | **`systemOnly`** |
| `reject` | SUBMITTED…WAITLISTED | REJECTED | `admissions.reject` | **required** | — | |
| `withdraw` | any of 7 non-terminal states after `DRAFT` | WITHDRAWN | `admissions.update` | **required** | — | applicant-initiated |
| `cancel` | any of 7 non-terminal states after `DRAFT` | CANCELLED | `admissions.approve` | **required** | — | institution-initiated |
| `admit` | SEAT_CONFIRMED | ADMITTED | `admissions.approve` + `student.create` | optional | — | **`orchestratedOnly`** |
| `forceReopen` | CANCELLED | UNDER_REVIEW | `admissions.approve` | **required** | — | audit `severity: WARN` |

**Only two HTTP endpoints exist for the entire machine** — `POST
.../workflow/transition` (body: `{ action, remarks }`) and `GET
.../workflow/history`. There are no per-action routes (`/submit`, `/approve`,
`/reject`); every transition is the same endpoint with a different `action`
string. Design a frontend's workflow layer around "one mutation, many action
values," not "one endpoint per action."

### 4.4 The document checklist guard — now real (R5, 2026-08-17)

> **Superseded 2026-10-17** (§4.10): the guard now also runs at `submit`,
> `confirmSeat` and inside `admit`, and at `startReview` under
> `VERIFIED_ADMISSION`; requirements are branch-scoped. The frontend no longer
> reasons about guard placement at all — it renders the `blockedBy` the
> backend reports. The paragraph below is the R5 record.

The guard `DOCUMENT_CHECKLIST_SATISFIED` is attached to **exactly two
transitions**: `documentsReceived` and `approve`. It is **not** evaluated at
`submit`, `startReview`, `requestDocuments`, `confirmSeat`, or `admit`.

As of R5, the guard is real (an earlier, 2026-08-12-dated section of the same
document had described it as a bare `return` — that description is
superseded): it calls `ChecklistService.isSatisfied()` with the applicant's
`programId`/`quotaId`/`categoryId`/`personId`, and a failed check throws `409
DOCUMENTS_INCOMPLETE` naming the missing document types. The satisfaction rule
is `programId × quotaId × categoryId` (the design's fourth axis,
`admissionType`, is **not implemented** — `Applicant` has no `admissionType`
column at all).

**Never claim "cannot proceed — documents incomplete" unless the backend's
actions read says so** (`blockedBy` contains `DOCUMENTS_INCOMPLETE`).

### 4.5 The other three guards

| Guard | Rule |
| :--- | :--- |
| `OFFER_NOT_EXPIRED` | `expiresAt` read under the row lock, never from the request body. Inclusive of its own instant. |
| `OFFER_EXPIRED` | The complementary strict comparison — exactly one of the two wins a race |
| `DEFERMENT_ENABLED` | `AdmissionConfigProvider.defermentEnabled()` — **false by default**. A frontend must not assume `defer` is always available; check before offering the action, and expect `400 DEFERMENT_DISABLED` |

### 4.6 The offer window

15-day default validity (`AdmissionConfigProvider.offerValidityDays`),
stamped together at `approve` (`offerIssuedAt` / `offerExpiresAt`), enforced
by `confirmSeat`'s guard read under the lock. An hourly `OfferExpiryJob`
(batches of 200) sweeps expired offers to `CANCELLED` with
`cancellationReason: OFFER_EXPIRED` — **through the same workflow engine**,
`systemOnly`, never a direct write. The sweep is a tidiness pass, not the
enforcement mechanism: an offer is unusable the instant it lapses regardless
of when the sweep next runs.

### 4.7 `WorkflowHistory` — one row, not three

Polymorphic on `(entityType, entityId)` covering `APPLICANT`, `ADMISSION`,
`ENROLLMENT`, `STUDENT` — but `admit()` currently writes **only one** history
row, for the Applicant. Admission and Enrollment get no "birth" row (a
recommended fix, `R6`, not yet shipped). **`GET /enrollments/:id/history` on a
freshly admitted student returns an empty array** — do not build a UI that
assumes a placement always has at least one history entry.

### 4.8 Two flags a frontend action-menu must respect

| Flag | Meaning | If violated |
| :--- | :--- | :--- |
| `systemOnly` | Only `actor.system = true` may fire it | `403 SYSTEM_ACTION` — never offer `expireOffer` as a user action |
| `orchestratedOnly` | Only the owning operation may invoke it — there is no DTO field that lets a caller assert it | `400 ORCHESTRATED_TRANSITION` — `ADMITTED` cannot be reached through the generic transition endpoint at all; only `POST .../admit` reaches it |

### 4.9 What the checklist and the transition engine do **not** do

- ~~`DOCUMENT_CHECKLIST_SATISFIED` never runs at `submit`, `startReview`,
  `confirmSeat` or `admit` (§4.4).~~ Superseded — see §4.10.
- `admit()` never reads `ApplicantProgramPreference` (§3.5).
- No seat-capacity check exists anywhere, by design — see §9.

### 4.10 Configurable admission workflows — the frontend reads, never decides (2026-10-17)

Contract: `backend/docs/modules/admissions.md` §12.

| Concern | Backend source | Frontend |
| :--- | :--- | :--- |
| Which actions exist, whether the caller may take each, and what blocks it | `GET .../workflow/actions` | `useApplicantWorkflowActions` → `ApplicantWorkflowActions`. Not-permitted actions are not offered; blocked ones are disabled with `describeBlocker()` text. `utils/workflow.ts` holds **presentation only** (`ACTION_PRESENTATION`, `PROFILE_META`); the old client-side transition table, `actionsFor()` and `isAdmitEligible()` were removed. |
| Whether admission can be completed | the `admit` entry (`via: "ADMIT"`) in the same read | "Complete admission" shows only when `permitted`, disabled with the reason when blocked |
| Which documents bind the applicant | `GET .../checklist` | `useApplicantChecklist`, passed by the route composition into Documents' panel and the admit review (§6) |
| The branch's profile | `GET /admissions/workflow/policy` | `useAdmissionPolicy` |
| Changing policy | `PUT/DELETE /config/values/:key` | `AdmissionWorkflowSettingsScreen` at `/app/admissions/workflow` |

**Journeys.**

- **`SIMPLE_ADMISSION`** — New Admission says *Continue to admission*; on save
  the hub opens (`?next=admit`) straight onto the admit review in **direct**
  mode: choose the section, review, **Admit student** →
  `POST .../direct-admit`. The forward steps (`submit`, `startReview`,
  `approve`, `confirmSeat`) are not offered as separate buttons while direct
  admission is available; withdraw/cancel still are. The result card shows
  the identifiers the backend returned.
- **`STANDARD_ADMISSION`** — unchanged status-driven hub.
- **`VERIFIED_ADMISSION`** — same hub; the extra checks surface as
  `blockedBy` (`DOCUMENTS_INCOMPLETE` before review, `MAKER_CHECKER_VIOLATION`
  on approval).

If the policy cannot be read, New Admission behaves as the standard process
(saves a draft, opens the hub); the backend still decides whether direct
admission is allowed.

**Settings screen.** Bound to the **active** organization and branch, because
the configuration API writes to the request's own scope and never accepts an
id. Shows each value's source (branch, organization, platform, default).
Editable only with `config.admissions.write`; organization-wide scope only for
`ORG_ADMIN`/`SUPER_ADMIN`; a reason is required; "Use the organization
setting" clears a branch override. Without the permission the same values are
shown read-only — there is no local-state form.

Tests: `tests/integration/configurable-admission-workflow.test.tsx`,
`tests/integration/applicant-journey-hub.test.tsx`,
`tests/unit/document-checklist.test.ts`.

---

## 5. Guardian & Guardianship

Source: `02-guardian-family/01-guardian.md` (rationale — target model), lifecycle
spec §8 (**this is the section headed "the single blocking finding of the
reconciliation," now substantially superseded by its own §8.7 addendum**),
Postman `Admissions > Guardian`.

### 5.1 The architecture that was intended, and what actually shipped

The design's decisive claim was that **guardianship is Person↔Person**, so a
guardianship "survives the applicant→student transition with zero
re-mapping." As implemented at the lifecycle spec's 2026-08-12 baseline, this
was **false**: `Guardian` was a standalone, branch-scoped table linked only to
`Applicant` via `ApplicantGuardianMapping`, with `admit()` copying nothing —
meaning a newly admitted student had **no reachable guardian at all**. This
was rated the document's single blocking finding.

**§8.7, dated 2026-08-16 ("R4.5 — what actually shipped"), substantially
closes this.** Treat the baseline finding as historical context, not the
current state:

- `Guardian.personId` now exists (**nullable**, not required as originally
  designed — see §5.3).
- `Guardianship` (Person↔Person) now exists and is **projected continuously**:
  synced from the guardian-mapping call whenever both sides already have a
  resolved `personId`, and **caught up inside `admit()` itself** for the
  sibling case (a guardian linked before the applicant's own Person had
  resolved). `ApplicantGuardianMapping` remains the authoritative record for
  one application; `Guardianship` is the record that survives it — neither is
  redundant.
- Two partial unique indexes now enforce, at the database level, at most one
  primary and at most one financial guardian per ward on `Guardianship`
  (fixing the historic non-transactional toggle and the total absence of
  financial-guardian exclusivity — §5.5).

**What remains genuinely open**: the full backfill of every *pre-existing*
`Guardian` row to a `Person` is deferred (blocked on missing `dob` — see
§5.3); moving Guardian's address columns to the Person/Address model is
deferred with it; `BILLING` address resolution through the financial guardian
remains incomplete for guardians without a `personId`.

### 5.2 `Guardian` — confirmed fields (Postman `POST /v1/admissions/guardians`)

Request body (16 fields): `dob, firstName, middleName, lastName,
mobilePrimary, mobileSecondary, email, occupation, income, aadhaarNo,
addressLine1, addressLine2, city, state, country, pincode`.

Response adds `id, organizationId, branchId, personId, createdAt, updatedAt,
deletedAt`.

**Guardian is still branch-scoped today** (`branchId` present), not
organization-scoped as the target model intends — that migration step is
deferred alongside the address/Aadhaar column drop. **`aadhaarNo` is still a
plain top-level field** — the same open plaintext-Aadhaar defect (`D14`) as
Applicant.

Headers: only `x-branch-id` — **no `x-academic-year-id`**. Guardian is not
academic-year-scoped.

### 5.3 The `dob` reconciliation — why `personId` is nullable

`PersonService.resolve()` requires `dob`, which `Guardian` never collected.
Making `personId` required (the original design) would have meant either
inventing a birth date for the one pre-existing guardian row or widening
`Person.dob` to nullable platform-wide — both rejected. Instead,
`Create`/`UpdateGuardianDto` gained an **optional, transient** `dob` field,
used once to call `resolve()` and never stored on `Guardian` itself: a
guardian created with one gets a `personId` immediately; one created without
can gain one later via a subsequent `PATCH` once a DOB becomes available.
**A frontend guardian form should collect DOB even though the Guardian record
itself never stores it displayed back** — it is the only way the guardian
gets linked to Person-scoped features (siblings, addresses, the parent
portal) at all.

### 5.4 `ApplicantGuardianMapping` — confirmed field-for-field

`POST /v1/admissions/guardians/applicant/:applicantId/map` request body:

```
{ guardianId, relationTypeId, isPrimary, isEmergencyContact,
  isFinancialGuardian, pickupAllowed, priority }
```

**This directly confirms every field a design brief might assume**: primary
guardian, emergency contact, financial guardian, pickup permission and
priority are all real, documented fields — not invented. **Idempotent**:
mapping the same guardian again updates the existing link, never adds a
second one.

**Not present on the mapping today** (only on the newer `Guardianship`
target model): `startedAt`/`endedAt`, `isLegalGuardian`, `emergencyPriority`,
`pickupValidFrom`/`pickupValidTo`. A UI built against the mapping (i.e. while
an applicant is still an applicant) should not offer these four fields.

### 5.5 Fixed defects (all `VERIFIED` closed by R2/R4.5)

| Defect | Was | Now |
| :--- | :--- | :--- |
| Cross-tenant read/write | `GET /guardians/:id` returned a **full plaintext Aadhaar to any authenticated user of any tenant** — the single most serious finding in this whole reconciliation | Fixed by an earlier release (**"R2"**, predating R4.5): `@RequirePermission` and scoped `WHERE` clauses now cover every guardian route |
| Primary-guardian toggle | `updateMany` (clear) then `upsert` (set), **no transaction** — a failed upsert left a ward with **no primary guardian**, silently | `mapGuardianToApplicant` runs in one `$transaction`; a partial unique index (`Guardianship_one_primary_per_ward_key`) makes the invariant a database guarantee |
| Financial-guardian exclusivity | **None at all** — a ward could accumulate three financial guardians | Same partial-unique-index fix, on `Guardianship` |
| Aadhaar substring search | Any `STAFF` user could probe Aadhaar digits branch-wide via `contains` | Search now matches mobile and name only — Aadhaar dropped from search entirely |
| Silent flag reset on re-map | Omitting `isPrimary` on a re-map silently demoted the existing primary to `false` | Now reads the existing mapping first and falls back to its value when a flag is omitted |
| PII in unaudited events | Guardian events bypassed the outbox and carried name/mobile straight into `AuditLog.payload` | Routed through `OutboxPublisher.enqueue` inside the write's own transaction; payload now carries only `guardianId`/`organizationId`/`hasPersonLink` |

**A frontend should still treat "primary guardian" state as re-fetchable
rather than trusted-optimistic** after any mutation, as general good practice
— but the specific race that used to make this necessary is closed.

### 5.6 `Guardianship` endpoints (Postman-confirmed, organization-scoped)

| Method | Path | Scope | Notes |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/admissions/guardianships/guardian/:guardianPersonId` | org (no branch/year header) | Which children this Person actively guards |
| `GET` | `/v1/admissions/guardianships/ward/:wardPersonId` | org | Reachable **regardless of how the Student came to exist** — reads Person↔Person rows, not the applicant-scoped mapping |
| `GET` | `/v1/admissions/guardianships/ward/:wardPersonId/siblings` | org | **Derived at query time from shared Guardianship rows** — returns `array of string` (bare ids, the only endpoint in this whole surface that does). No sibling/household table exists |
| `GET` | `/v1/admissions/guardians/search` | branch | `q` required. **At most 10 matches; an empty query returns an empty array, never the whole branch** |

**No `POST /guardianships` exists.** Guardianship rows are read-only from this
API surface — they are a system-projected side effect of guardian-mapping
(§5.1), never authored directly.

### 5.7 The current guardian-onboarding flow — three round-trips, not one

Despite an S1-doc recommendation to accept guardians nested inside the
Applicant create payload (`guardians[]`, resolved and mapped transactionally
in one call), **the confirmed 43-field Applicant create request body does not
contain a `guardians[]` field.** Build against the flow actually confirmed by
Postman: (1) `POST /admissions/guardians` to create-or-reuse a guardian, (2)
optionally `GET /admissions/guardians/search` to find an existing one for
sibling reuse, (3) `POST
/admissions/guardians/applicant/:applicantId/map` to link it. Treat the
nested-payload flow as a documented aspiration, not a confirmed contract.

---

## 6. Documents

Source: `04-documents/01-document.md` (original design), `document-management-
specification.md` (R5, "foundation only", authoritative), lifecycle spec §11,
Postman `Document`, `Document Requirement`, `Document Type` (top-level
folders, **not nested under Admissions** — Documents is a generic,
owner-polymorphic module; an Applicant's documents are simply documents whose
`(ownerType, ownerId)` point at that Applicant).

### 6.1 Ownership — documents prove facts, not "belong to" an uploader

| Owns | `ownerType` | Why |
| :--- | :--- | :--- |
| Birth certificate, Aadhaar copy, caste/income certificate, photograph | `PERSON` | Facts about the human, follow across every role |
| Application-supporting evidence | `APPLICANT` | Evidence for one attempt |
| Transfer/character certificate | `ADMISSION` | Cover a spell of study |
| Marksheet, bonafide, migration certificate | `ENROLLMENT` | Belong to one academic year |
| Medical/health record | `STUDENT` | Student-role fact |
| Guardian's own ID proof | `PERSON` (the guardian's own resolved Person) | A fact about that human, once resolved |

Confirmed as-shipped `ownerType` enum (Postman `POST /v1/documents`):
`PERSON | APPLICANT | ADMISSION | ENROLLMENT | STUDENT | ORGANIZATION |
BRANCH` — no distinct `GUARDIAN` owner type (a guardian's documents are owned
by their resolved Person), no `EMPLOYEE` (not built).

Ownership is a **service-level invariant, not a database foreign key**
(polymorphic `(ownerType, ownerId)` cannot be a real FK): a cross-tenant
`ownerId` **404s, never 403** — the same rule the platform applies everywhere.

### 6.2 `Document` and `DocumentVersion`

Confirmed `Document` shape (Postman `POST /v1/documents` response): `id,
organizationId, ownerType, ownerId, documentTypeId, status, branchId,
currentVersionId, expiresAt, currentVersion`.

**Versioning is append-only.** A fresh upload for an owner+type that already
has an ACTIVE document becomes a **new version of it, not a second document**
— re-verification is always required on the new version (it cannot inherit
the previous version's `VERIFIED` status; it is a distinct row that defaults
to `PENDING`). Old versions are **never deleted** — no delete route exists for
Documents at all. A byte-identical re-upload is refused with `409
DOCUMENT_UNCHANGED` rather than silently creating a pointless new version
(checksum-based).

### 6.3 Status vocabularies — two, confirmed, neither has a "missing" value

```
Document.verificationStatus:      PENDING | VERIFIED | REJECTED
DocumentVersion.scanStatus:       PENDING | CLEAN | INFECTED | FAILED
```

There is **no `MISSING` value anywhere.** A missing/unsatisfied requirement is
expressed as the *absence* of a satisfying `VERIFIED` current version,
computed by `ChecklistService` — not a stored status. `ARCHIVED` is a
separate document-level lifecycle field (`archivedAt`, one-way, staff-only —
no delete route exists, `POST /documents/:id/archive` instead), not a
`verificationStatus` value.

- **Verify takes no request body.** **Reject requires `{ reason }`** — DB-
  enforced, 3–500 chars.
- Restricted to `BRANCH_ADMIN`+ for both.
- A `VERIFIED` version is never edited back to `PENDING`; the only path to a
  fresh `PENDING` state is uploading a new version.

### 6.4 `DocumentRequirement` — the checklist definition table

Confirmed fields: `documentTypeId, appliesToProgramId, appliesToQuotaId,
appliesToCategoryId, requiredByStage, isMandatory, isActive`. As documented in
§4.4, `requiredByStage` reuses `AdmissionApplicationStatus` directly — not a
parallel enum. **The `admissionType` axis from the original design is not
implemented** (`Applicant` has no `admissionType` column); the real formula is
`programId × quotaId × categoryId`, each nullable meaning "applies to all."

### 6.5 Upload — backend-mediated multipart, staff-only, no cloud storage

- **No presigned/direct-to-storage upload.** Every upload goes through the
  backend: `Client → DocumentController (multipart) → StoragePort → adapter`.
  Chosen because staff-only upload (below) removes any need for a
  browser-direct path, and a local filesystem adapter has no presigned-URL
  concept.
- **Staff-only in v1.** No route for a parent/guardian to upload directly —
  an explicit, documented product decision (`DQ3`), not an oversight.
- **Only local filesystem storage exists.** S3/R2/GCS/Supabase adapters are
  **not stubbed** — the app **refuses to boot** if a non-`local` provider is
  configured. Do not promise durability guarantees in copy for a
  local-adapter deployment.
- **No real virus scanner is bound.** In non-production, uploads are marked
  `CLEAN` unconditionally with a boot warning. **In production, every upload
  is refused** with `SCAN_NOT_CONFIGURED` until a real scanner is wired.
  Handle this as a distinct "uploads unavailable" infrastructure state, not a
  per-file validation error.

### 6.6 Download

**Never a presigned or public URL.** `GET /documents/:id/download` streams
decrypted bytes through the backend after: a scope check (404 not 403 on a
miss), a scan-status check (**anything other than `CLEAN` is refused with
`403 VERSION_NOT_CLEAN`**, unconditionally, no permission overrides it), and a
sensitivity check (`isSensitive` document types additionally require
`BRANCH_ADMIN`+, refusing plain `STAFF`). Every download publishes a
`document.downloaded` audit event.

### 6.7 Endpoints (Postman-confirmed)

| Method | Path | Notes |
| :--- | :--- | :--- |
| `POST` | `/v1/documents` | Multipart. Request field names not confirmed (multipart body, not raw JSON in the captured example) |
| `GET` | `/v1/documents/:id` | Whether this returns full version history or only the current version is **unconfirmed** by the captured example |
| `GET` | `/v1/documents?ownerType=&ownerId=` | Both required |
| `POST` | `/v1/documents/:id/verify` | No body |
| `POST` | `/v1/documents/:id/reject` | `{ reason }` required |
| `POST` | `/v1/documents/:id/replace` | Append-only new version, always re-verifies |
| `POST` | `/v1/documents/:id/archive` | `{ reason }` |
| `GET` | `/v1/documents/:id/download` | Streamed bytes; no success JSON example (expected) |
| `GET`/`POST`/`PATCH`/`DELETE`(?) | `/v1/document-requirements/**` | Checklist rules, §6.4 |
| `GET`/`POST`/`PATCH`/`DELETE`(?) | `/v1/document-types/**` | `code, name, description, isSensitive, hasExpiry, defaultValidityMonths, retentionYears, allowedMimeTypes, maxSizeBytes, displayOrder, isActive` |

No aggregate "N of M documents verified" field is documented on any list or
checklist response — compute any such count client-side from the array, and
degrade gracefully if it cannot be computed. No response shape for `409
DOCUMENTS_INCOMPLETE`'s "missing types" payload is confirmed field-by-field —
parse it defensively via the standard error envelope.

---

## 7. The Postman collection's unusual honesty for this module

Worth stating once, prominently, because it changes how much weight Postman
carries here relative to every other module in this codebase.

**`backend-gaps.md` §A records, for System Settings/Maintenance/Audit, that
"the Postman collection records a response status for every request … and a
response body for none of them."** The same is documented as true for
Organizations, Branches, Academic Years, Programs, Academic Units and
Admission Masters (`backend-gaps.md` E1/F1/G1/H2/I1/L "no response body
documented").

**This module's Postman folders break that pattern.** Admissions, Document,
Person, Student, Enrollment and Numbering example response bodies are real
and non-empty (roughly 210–7,600 characters), not the placeholder `""` every
other module uses — and every request additionally carries a hand-written
`description` stating a real business rule, not schema-faker filler text.
Only two requests in the whole set (`GET`/`POST
.../applicants/:id/preferences`) and the binary `download` endpoint lack a
success example, for reasons stated in §3.5 and §6.6 respectively.

Treat this module's Postman collection as considerably higher-confidence
ground truth than the collection is elsewhere in this codebase — but see §10
for the one place even this collection is now stale relative to the
lifecycle spec's own last-dated addendum, in the *other* direction (Postman
ahead of the spec, not behind it).

---

## 8. Student, Admission, Enrollment, and the `/admit` transaction

Source: `01-identity-core/03-05-admission-student-enrollment.md` (rationale),
lifecycle spec §13, §16, §19, §23, §29–§30, Postman `Student`, `Enrollment`.

### 8.1 Scope boundaries — confirmed exactly

| Layer | Scope | Confirmation |
| :--- | :--- | :--- |
| **Person** | Organization | §2.2 — no `branchId` field at all on the Person read shape |
| **Student** | Organization-level identity; `branchId` is a **mutable pointer**, not part of identity | A branch transfer moves the pointer; `studentCode` never changes |
| **Admission** | Branch-scoped, **immutable** `branchId` | A transfer *closes* one Admission and *opens* a new one at the new branch — it never edits the old row's branch |
| **Enrollment** | Branch **and** academic-year scoped | One row per academic year under an Admission |

### 8.2 Why the layers exist — the two things that die

Applicant dies at approval (well, at `admit()` — it becomes a frozen
historical record); Enrollment dies at promotion (superseded, never deleted).
Neither can hold "this person joined this branch on this date, under this
quota, at this level, and left on that date for that reason" — that is
precisely what a Transfer Certificate is issued against, and it is what
`Admission` exists to record. Nursery→Std 10 is **one Admission, twelve
Enrollments**.

### 8.3 `Student` — confirmed fields (Postman `GET /v1/students/:studentId`)

```
id, studentCode, organizationId, branchId, personId, status, displayName,
firstName, middleName, lastName, dob, gender, disabilityStatus,
disabilityNotes, primaryMobile, primaryEmail, apaarId, abcId, penNo,
saralId, udiseStudentId, photoDocumentId, createdVia, sourceApplicantId,
createdAt, updatedAt, religion, caste, category, motherTongue, bloodGroup,
disabilityType
```

**No government identifier in any form** — Aadhaar is never on Student;
reaching it is a separately-permissioned Person operation. `sourceApplicantId`
+ `createdVia` (`ADMISSION | MIGRATION`) confirm Student carries a durable
back-reference to the Applicant it came from, and that more than one creation
path exists. `status`: `ACTIVE, GRADUATED, WITHDRAWN, EXPELLED, ARCHIVED` —
but **write-once `ACTIVE` today**; no transition operation for graduate/
withdraw/expel exists yet (`DEFERRED`, Phase 6).

`PATCH /v1/students/:studentId` doc note, verbatim: *"Identity fields are
unreachable from here, and this does not touch the application the student
came from — that record is a frozen snapshot… a later correction must not
rewrite it."*

Search (`GET /v1/students`) is **branch-scoped by default**: a student in
another branch is **absent from results, not refused** — a refusal would
confirm the record exists. `student.view.organization` widens the search;
out-of-branch matches then come back as a reduced summary. Preserve this
information-disclosure design in any frontend copy about search results.

### 8.4 `Admission` — confirmed fields

`id, organizationId, branchId (immutable), studentId, admissionNo,
admissionType, admissionDate, entryProgramId, entryAcademicUnitId, quotaId,
admissionSourceId, status, sourceApplicantId, previousAdmissionId, exitDate,
exitReason, exitRemarks`. `admissionType` enum: `REGULAR, LATERAL_ENTRY,
TRANSFER, MIGRATION, READMISSION, BRANCH_TRANSFER, RTE` — **`admit()` only
accepts the three first-entry types**, `{REGULAR, LATERAL_ENTRY, RTE}` (§8.7).
`status`: `ACTIVE, ON_HOLD, COMPLETED, CANCELLED, TRANSFERRED_OUT`.

**No `Admission` CRUD folder exists anywhere in Postman.** No `GET
/admissions/:id`, no `POST /admissions`. The only place Admission's own
identifiers surface is inside the `admit` response and inside Enrollment's
`admissionId` field — a direct, positive confirmation that Admission has **no
dedicated read/write API at all**, only controlled creation via `admit()`.

### 8.5 `Enrollment` — confirmed fields

```
id, organizationId, branchId, academicYearId, admissionId, studentId,
programId, academicUnitId, rollNumber, enrollmentKind, enrollmentStatus,
isRepeat, resultOutcome, originType, previousEnrollmentId, supersededById,
changeReason, applicantId, exitDate, exitReason, version, createdAt,
updatedAt, deletedAt
```

Enrollment carries **both** `admissionId` and `applicantId` directly (not
just reachable by joining through Admission). `version` drives **optimistic**
concurrency (`expectedVersion` required on every mutating call — a second,
distinct concurrency strategy from the `SELECT FOR UPDATE` pessimistic lock
`admit()` and workflow transitions use). **No reference to
`ApplicantProgramPreference` appears anywhere on Enrollment** — confirms
`admit()` never reads the preference list (§4.9).

Confirmed mutating endpoints (all require `expectedVersion`):

| Method | Path | Doc note (verbatim, load-bearing) |
| :--- | :--- | :--- |
| `POST` | `.../cancel` | "Records a date and a reason and leaves the row in place. Refused once a result has been recorded against it." |
| `POST` | `.../correct` | "Writes a replacement and closes the original as `SUPERSEDED`. The original is never edited… a blank reason is refused." Response: `{ previous, current }` |
| `POST` | `.../transfer` | "Closes the old placement as `TRANSFERRED`… Cross-branch movement is not this operation: it closes the admission and opens another." |
| `PATCH` | `.../roll-number` | "The one mutable field on a placement, and only until the class list locks. It does not supersede the row." |

`GET /v1/enrollments` — real server-side filtering by `studentId,
admissionId, academicYearId, programId, academicUnitId, enrollmentStatus,
enrollmentKind`, plus `limit, offset`. Doc note: *"The class-list query…
Branch and organization come from the execution context and cannot be
filtered."*

**Promotion and repeat-year have no callable operation yet** — `promote`,
`repeatYear` are `DEFERRED` (Phase 6); the shared "supersede" primitive that
will implement them exists and is proven by test, but no route calls it for
those two cases. `correct` and `transfer` (mid-year section/programme change)
**are** implemented today. A documented `POST
/v1/students/:id/branch-transfer` route appears in the design doc's API
surface table but is **not confirmed present** in the captured Postman
collection — treat branch transfer as likely still `DEFERRED` pending direct
confirmation.

### 8.6 The `/admit` transaction — the complete contract

`POST /v1/admissions/applicants/:applicantId/admit`

> "The only place a learner identity is born from an application, and the one
> operation where a partial result would be unrecoverable by hand." —
> lifecycle spec §23.1

**Input — deliberately minimal.** Only `academicUnitId` is required.
`admissionType` (default `REGULAR`), `admissionDate` (default now) and
`remarks` are optional. **Everything else is absent by design**:

```
~~programId~~                                     — offered and confirmed earlier;
                                                     not the caller's to change now
~~organizationId, branchId, academicYearId~~      — from the applicant's own lineage
~~studentId, studentCode, personId, admissionId,
   enrollmentId~~                                 — server-minted inside the transaction
~~status~~                                        — the engine owns it
```

Every one of those absences is deliberate: a field accepted here is a field
the global `ValidationPipe` would let a client override.

**Pre-transaction validation (read-only, must not hold locks)** — 11 real
checks (permission, `admissionType` restricted to first-entry types, applicant
exists in org+branch, `SEAT_CONFIRMED`, `programId` present, academic unit
exists/matches/active, academic year exists/not locked, numbering
provisioned). **Document checklist and seat capacity are explicitly not
performed** — neither module gates this step.

**Inside the transaction — `READ COMMITTED`, 15 s timeout, eight steps:**

```
1  SELECT … FOR UPDATE on the Applicant                (serialises concurrent admits)
2  Re-assert SEAT_CONFIRMED under the lock              (the pre-read was a guess)
3  personId = locked.personId ?? PersonService.resolve() (reuses the applicant's own Person)
4  Refuse if a Student already exists for this Person    (409 STUDENT_ALREADY_EXISTS —
                                                            this is readmission, a separate op)
5  StudentService.createControlled()  — mints studentCode
6  AdmissionService.createControlled() — mints admissionNo
7  EnrollmentService.createInitialEnrollment() — roll number left unset
8  WorkflowService.transition(ADMIT, orchestrated: true) — last, so status and the
                                                             three rows commit together
```

**What commits**: 1 Student, 1 Admission, 1 Enrollment, 1 Applicant status
update, 1 `WorkflowHistory` row (Applicant only — §4.7). **What is enqueued**:
5 outbox events — `student.created`, `student.code_assigned`,
`admission.created`, `enrollment.created`, `applicant.admitted`.

**Response — exactly six identifiers, nothing else:**

```json
{ "studentId", "studentCode", "admissionId", "admissionNo",
  "enrollmentId", "applicantId" }
```

**Failure — genuinely atomic.** "Anything at all rolls the whole thing back"
— verified by fault injection at each of the six steps and after the last
one. The applicant is left exactly `SEAT_CONFIRMED`: no student, no
admission, no enrolment, no history row, no outbox row. A numbering sequence
value may be burned (a gap — acceptable by the numbering engine's own
`MONOTONIC` allocation mode). After commit, events are safe even if the relay
has not published them yet (they are committed rows; publication is
idempotent via `AuditLog.eventId`).

**Concurrency — three layers, twenty simultaneous requests produce one
student:** the row lock catches the normal double-click case; a partial
unique index on `sourceApplicantId` catches a second admit that somehow got
past the lock; `@@unique([organizationId, personId])` catches **the same
child seat-confirmed at two branches and admitted at once** — the government
identifier resolves both to one Person, so the second admission is refused
rather than splitting the identity. The loser receives an **informative
`409`** naming the `studentId`/`studentCode` that already exists, so a client
can treat the conflict as the completed operation it is — there is no
idempotency-key infrastructure; the state guard, row lock and unique
constraints together are considered sufficient.

**Readmission — explicitly out of scope, not partially built.** An existing
Student produces `409 STUDENT_ALREADY_EXISTS` and the application is left
untouched. This is a deliberate refusal, not a gap to patch around client-side
— "shipping a partial version of it under another name would be worse than
refusing."

### 8.7 `/admit` — complete error table

| Status | Code | Meaning |
| :--- | :--- | :--- |
| 403 | `ForbiddenException` | Missing `admissions.approve` or `student.create` |
| 400 | `ADMISSION_TYPE_NOT_A_FIRST_ENTRY` | `admissionType` not one of `{REGULAR, LATERAL_ENTRY, RTE}`; carries `allowed[]` |
| 404 | `NotFoundException` | Applicant absent or out of scope |
| 409 | `APPLICANT_NOT_SEAT_CONFIRMED` | Wrong state; carries `currentStatus` |
| 409 | `APPLICANT_ALREADY_ADMITTED` | Already converted; carries `studentId`, `studentCode` (documented to also carry `admissionId`/`enrollmentId` — that part is a known, cosmetic drift, `D23`) |
| 409 | `STUDENT_ALREADY_EXISTS` | Person is already a student; carries `studentId`, `studentCode`, `studentStatus` |
| 400 | `PROGRAM_REQUIRED` | No programme on the application |
| 404 | `ACADEMIC_UNIT_NOT_FOUND` | |
| 400 | `ACADEMIC_UNIT_MISMATCH` | Unit's branch/year/programme don't match the applicant's |
| 400 | `ACADEMIC_UNIT_INACTIVE` | |
| 403 | `ACADEMIC_YEAR_LOCKED` | Carries `academicYearId` |
| 400 | `NUMBERING_NOT_PROVISIONED` | **Pre-flight** raises this as `400`; the same condition raised **inside** the transaction is `500` — a known, documented inconsistency (`D24`) both paths should eventually agree on |
| 409 | `ACTIVE_ADMISSION_EXISTS` | |
| 409 | `ENROLLMENT_EXISTS_FOR_YEAR` | |

**`APPLICANT_ALREADY_ADMITTED` should be treated as success**, per the error
contract's own rule §8.9 below — it names an already-completed operation, not
a failure to surface as an error toast.

### 8.8 The identifier map ("ID survival matrix")

| Identifier | Minted | Scope | Ever changes? |
| :--- | :--- | :--- | :--- |
| `personId` | Applicant `SUBMIT` (or first guardian/employee resolution) | Organization, forever | Only via a merge tombstone redirect |
| `applicantId` | Applicant registration (`DRAFT`) | This application, retained forever as evidence | Never |
| `applicationNo` | Registration, branch+year numbering sequence | Life of the application | Never; never an FK |
| `studentId` | `admit()` | Organization, forever | Never |
| `studentCode` | `admit()`, org-scoped `NEVER`-reset sequence | Forever | Never (one audited break-glass correction is designed but **not built**) |
| `admissionId` | `admit()` / transfer / readmission | Entry → exit, then retained | Never |
| `admissionNo` | `admit()`, branch-scoped `YEARLY`-reset sequence | Life of the admission | Never; a transfer/readmission yields a **second** one |
| `enrollmentId` | `admit()` / promotion / repeat / correction / transfer / readmission | One academic year | Never edits in place — a change **supersedes**, producing a new id |
| `rollNumber` | Assigned manually after placement; **null at `admit()`** | One year | Editable until the class list locks |

**No identifier here is interchangeable with another** — `Person.id`,
`Student.id`, `Student.studentCode`, `Admission.admissionNo`,
`Enrollment.id` all have distinct scopes and none may substitute for another
in a display or a lookup.

### 8.9 Error contract rules that apply platform-wide to this lifecycle

From lifecycle spec §40.4, worth internalising for every screen this module
touches:

1. **A scope miss is always `404`, never `403`** — a `403` would itself leak
   that the record exists.
2. **An error never echoes a sensitive value back** — the caller already
   knows what it sent.
3. **A conflict names identifiers, never people** — `studentId`/`studentCode`
   are safe to show; a name or mobile number is not.
4. **`409` is informative** — it names what already exists, so a duplicate
   submission (e.g. a double-click on Admit) can be treated as the completed
   operation it describes rather than a hard failure.

---

## 9. What is deliberately not built — do not invent UI for these

| Not built | Evidence | What exists instead |
| :--- | :--- | :--- |
| Seat capacity anywhere | `DECIDED` — explicitly out of scope; `admit()`'s pre-flight checklist skips it by name | Nothing. No field, no check, no warning |
| Person merge execution | `PersonMergeLog`/`mergedIntoPersonId` exist at the schema level; no operation writes them | Nothing callable |
| Student lifecycle transitions (graduate/withdraw/expel) | `Student.status` is write-once `ACTIVE` | Nothing beyond the initial value `admit()` sets |
| Promotion / repeat-year | `DEFERRED`, Phase 6; the shared "supersede" primitive exists and is test-proven, unused by any route | Nothing callable |
| Branch transfer | A route appears in the design doc's API table; **not confirmed present** in Postman | Treat as unshipped pending confirmation |
| Deferred-applicant next-cycle re-application | `deferredFromApplicantId` field and the `defer` transition both exist; **no confirmed operation that actually creates the linked next-cycle Applicant** | The `defer` action alone, via the generic transition endpoint |
| Configuration admin UI | Only two hard-coded `*ConfigProvider` implementations exist (`F2` deferred) | Whatever those two providers return (e.g. `defermentEnabled: false`, `offerValidityDays: 15`) |
| Parent/guardian document self-service upload | Explicit `DQ3` decision — staff-only in v1 | Staff-mediated upload only |
| Cloud document storage | App refuses to boot on a non-`local` `DOCUMENT_STORAGE_PROVIDER` | Local filesystem only |
| Real virus scanning in production | `NullScanAdapter` fails closed in production (`SCAN_NOT_CONFIGURED`) | A boot-time warning; uploads refused until a real scanner is wired |
| Bulk admission | Not referenced anywhere in the read docs | One `/admit` call per applicant |
| A preference/allotment engine that actually places students | `ApplicantProgramPreference` exists; `admit()` never reads it; `pref_one_allotted` index is inert | `academicUnitId` chosen explicitly at the moment of `admit()` |
| A direct `POST /students`, `POST /admissions` or `POST /enrollments` | **No such route exists anywhere in the collection.** Confirmed structurally: no `Admission` CRUD folder at all in Postman | `POST /admissions/applicants/:id/admit` is the **only** path to any of the three |

---

## 10. A methodological note this reconciliation itself surfaced

Two modules — **Address** and, to a lesser extent, **the document checklist
guard** — are recorded as `DEFERRED`/non-functional in a section of the
lifecycle spec dated 2026-08-12, yet the Postman collection (undated, but
demonstrably captured later) shows them **working**: real `/v1/persons/:id/
addresses` endpoints matching the `S2` design's `PERMANENT/CURRENT/
COMMUNICATION/BILLING` type model and `COMMUNICATION → CURRENT` /
`BILLING → financial guardian → CURRENT` fallback rules almost exactly, and a
real, checked `DOCUMENT_CHECKLIST_SATISFIED` guard (confirmed independently
in §11.8 of the same document, dated 2026-08-17 — later than the baseline
that calls Address `DEFERRED`).

**The lesson for future contract work on this module**: a single "as of"
date at the top of a reconciliation document does not mean every section is
equally current — check each section's own status tag and date, and treat a
later-dated addendum (or a Postman example directly contradicting an
earlier-dated table) as authoritative over an undated or earlier-dated table
elsewhere in the same document.

---

## 13. Frontend implementation — Final Admission / Person / Numbering milestone

Built on top of the shipped Applicant Journey Hub and Admit dialog, not a
rewrite of either:

- **Academic placement is now the review's own section**, not an implicit
  side-effect of picking a unit: the Admit dialog shows Branch, Academic
  Year, Program and the Academic Unit picker together, sourced from
  `useWorkspace()` and the route composition's own `programId` lookup —
  never re-fetched or duplicated.
- **The Academic Unit slot is resolved at the route composition**
  (`applicant-composition.tsx`'s `useAcademicUnitSlot`), not inside
  `AcademicUnitPicker` itself: when the applicant's program has zero
  academic units in the active branch/year, the slot renders a structured
  empty state linking to `ROUTES.app.academicUnits.create` instead of a
  picker with nothing to choose — admission is not silently allowed through
  an empty picker.
- **`PersonPanel` (`features/person`) now renders wherever `applicant.personId`
  is present** — the Overview tab's Identity card, the Admit review's Person
  section, and the post-admit success screen — using the confirmed
  `GET /v1/persons/:id` (`id, dob, governmentIdMasked, governmentIdType,
  governmentIdErased, mergedIntoPersonId`). §2's own "not yet resolved"
  fallback copy is unchanged; only what happens once `personId` *is* present
  is new. `features/person` has no navigation entry — see its own `index.ts`.
- **The Admit dialog's CTA is now "Complete admission"**, its confirmation
  names every consequence the backend actually guarantees (Student +
  Admission + Enrollment created atomically, application moves to
  `ADMITTED`), its loading state disables every control and states plainly
  that this is a UI explanation, not real-time backend progress, and its
  failure state states that nothing was created — because the transaction
  is genuinely atomic, not because the frontend assumes so.
- **The success screen now shows all six `/admit` response identifiers**
  (`studentId`, `studentCode`, `admissionId`, `admissionNo`,
  `enrollmentId`, `applicantId` — §8.6's own confirmed field list), grouped
  by Student/Admission/Enrollment, plus "View applicant" and "Back to
  applicants" (real, working links) — "View Student"/"View
  Admission"/"View Enrollment" are not offered, since no read screen exists
  for any of the three yet (`docs/backend-gaps.md` #43).
- **`STUDENT_CODE`/`ADMISSION_NO` are never generated or previewed by this
  frontend before `/admit`.** See
  [Numbering Module](./numbering-module.md) for the module that configures
  their *format*, entirely separate from the moment a number is allocated.

---

## 14. Frontend implementation — Academic Placement Refinement milestone

Aligns the Admit dialog and the post-admit success card with
`backend/docs/planning/academic-placement-refinement.md` — the backend change
that added `displayPath`/`isPlacementTarget`/`ancestors` to `AcademicUnit`
reads and started refusing a structural node (one with active children) as an
Enrollment or admission `academicUnitId`. Full detail in
[Academic Unit Module §6](./academic-unit-module.md#6-placement-targets--displaypath-and-isplacementtarget);
this section covers only what changed at the Admissions boundary.

- **`AcademicUnitPicker` now offers only placement targets by default**
  (`placementTargetsOnly`, on unless a caller opts out) and labels every
  option with `displayPath` — "Grade 1 → Division A" — never the bare `name`.
  "Division A" alone is ambiguous the moment a program has more than one
  class, and a structural node ("Grade 1" itself, with live divisions under
  it) would be refused by the backend with `ACADEMIC_UNIT_NOT_PLACEMENT_TARGET`
  regardless of what the picker offered, so the frontend narrows the same way
  §28's "a rule the UI can make unexpressible beats a rule it validates"
  already applies to `eligibleParents`.
- **`useAcademicUnitSlot` (the route composition) filters the same way**, so
  "is there anything to choose" matches what the picker itself would show.
  Its empty state now distinguishes two cases a registrar needs to tell
  apart: no academic units configured at all, versus a program whose
  structure exists but is **entirely structural** — every unit has children,
  none is a leaf yet — which reads as "add a leaf unit under the existing
  structure" rather than "configure academic units" from scratch.
- **The post-admit "Academic placement" section now shows the full picture**:
  Program (as before), Academic Year (from `useWorkspace()`, the same seam
  the Admit dialog's own review already used), Placement (the `displayPath`
  of the unit the admit form submitted — resolved without a second read,
  since `admit()`'s response carries no placement id at all, §8.6), and Roll
  Number ("Not yet assigned" — accurate, not a placeholder: `MANUAL` is the
  only implemented roll-number policy and it is left unset at `admit()` by
  design, per the backend's own Enrollment contract).
- **Nothing here duplicates the backend's rule.** `displayPath` is rendered
  exactly as returned, both in the picker and in the post-admit section — the
  frontend narrows *choices* to match the backend's rule; it does not
  recompute the rule itself. The backend remains the sole authority, verified
  by its own test suite (`backend/docs/planning/academic-placement-refinement.md`
  §13).
- **Capacity, roll-number policy and the class-list lock are unchanged** —
  the backend audit found all three already matched its own reasoning and
  made no code change to any of them, so neither does this milestone. No
  capacity field exists anywhere in this frontend, and none was added.

---

## Related

- [Backend Contract Gaps §M](./backend-gaps.md#m-applicant-admission-lifecycle) —
  the curated gap ledger this analysis feeds.
- [Admission Masters Module](./admission-masters-module.md) — the 10
  branch-scoped reference-data resources this lifecycle's dropdowns are built
  from (Categories, Castes, Religions, Genders, Languages, Blood Groups,
  Disabilities, Relation Types, Quotas, Admission Sources).
- [Documents Management Module](./documents-management-module.md) — Document
  Types, Document Requirements and the owner-document panels composed into
  the Journey Hub's Documents tab.
- [Numbering Module](./numbering-module.md) — the format configuration for
  `studentCode`/`admissionNo`, composed nowhere near `/admit` itself.
- [Administration Modules](./administration-modules.md),
  [Response Handling](./response-handling.md) — the platform conventions
  (envelope, `ApiError`, `createResourceService`) any future implementation
  of this module must build on.
