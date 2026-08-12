# Core Admission Lifecycle — Operational Specification

> **Scope.** The single authoritative reference for the complete
> **Person → Applicant → Workflow → Admission → Student → Enrollment** lifecycle
> as it exists in this repository on 2026-08-12, reconciled against every
> planning document that describes it.
>
> **What this document is.** A reconciliation, not a redesign. Where the specs
> and the code disagree, both are stated and one is named correct. Where neither
> answers a question, the question is left open under an explicit label rather
> than resolved by assumption.
>
> **What this document is not.** It is not a replacement for
> [`student-admission-enrollment-architecture.md`](student-admission-enrollment-architecture.md)
> (the build blueprint) or for the module specs in `00-foundation/` through
> `06-academic-structure/`. It consolidates them into one operational reference
> and records where the implementation has moved past them.
>
> **Status classification.** Every material statement carries one of:
> `IMPLEMENTED` · `VERIFIED` · `DECIDED` · `RECOMMENDED` · `PROPOSED` ·
> `DEFERRED` · `REQUIRES BUSINESS DECISION` · `REQUIRES R&D`.
> `VERIFIED` means *read in the repository during this reconciliation*, with the
> file named.

---

## Table of contents

| # | Section | # | Section |
| :--- | :--- | :--- | :--- |
| 1 | [Executive summary](#1-executive-summary) | 27 | [Readmission](#27-readmission) |
| 2 | [Current implementation baseline](#2-current-implementation-baseline) | 28 | [Student lifecycle](#28-student-lifecycle) |
| 3 | [Domain glossary](#3-domain-glossary) | 29 | [ID survival matrix](#29-id-survival-matrix) |
| 4 | [Complete lifecycle](#4-complete-lifecycle) | 30 | [Field ownership matrix](#30-field-ownership-matrix) |
| 5 | [Person / identity](#5-person--identity) | 31 | [Complete field dictionary](#31-complete-field-dictionary) |
| 6 | [Applicant](#6-applicant) | 32 | [Validation matrix](#32-validation-matrix) |
| 7 | [Applicant workflow](#7-applicant-workflow) | 33 | [Form-stage reference](#33-form-stage-reference) |
| 8 | [Guardian](#8-guardian) | 34 | [Configuration matrix](#34-configuration-matrix) |
| 9 | [Guardianship / family](#9-guardianship--family) | 35 | [Permissions](#35-permissions) |
| 10 | [Address](#10-address) | 36 | [Security & privacy](#36-security--privacy) |
| 11 | [Documents](#11-documents) | 37 | [Audit](#37-audit) |
| 12 | [Academic selection](#12-academic-selection) | 38 | [Events](#38-events) |
| 13 | [Admission](#13-admission) | 39 | [Outbox](#39-outbox) |
| 14 | [Admission type](#14-admission-type) | 40 | [Error contract](#40-error-contract) |
| 15 | [Admission source](#15-admission-source) | 41 | [Cross-module contract](#41-cross-module-contract) |
| 16 | [Student](#16-student) | 42 | [Edge cases](#42-edge-cases) |
| 17 | [Student UUID](#17-student-uuid) | 43 | [Database invariants](#43-database-invariants) |
| 18 | [Student code](#18-student-code) | 44 | [Concurrency](#44-concurrency) |
| 19 | [Enrollment](#19-enrollment) | 45 | [Testing requirements](#45-testing-requirements) |
| 20 | [Academic placement](#20-academic-placement) | 46 | [Known defects](#46-known-defects) |
| 21 | [Roll number](#21-roll-number) | 47 | [Required refinements](#47-required-refinements) |
| 22 | [Capacity](#22-capacity) | 48 | [Deferred work](#48-deferred-work) |
| 23 | [Admission conversion](#23-admission-conversion) | 49 | [Open decisions](#49-open-decisions) |
| 24 | [Promotion](#24-promotion) | 50 | [Final recommended architecture](#50-final-recommended-architecture) |
| 25 | [Repeat](#25-repeat) | 51 | [Core freeze checklist](#51-core-freeze-checklist) |
| 26 | [Transfer](#26-transfer) | — | [Final status](#core-admission-lifecycle-status) |

---

# 1. Executive summary

The admission spine is **built and composed end to end**. An application can be
registered, submitted, reviewed, offered, confirmed and converted into a
Student, an Admission and a first Enrollment in one atomic transaction, and that
whole chain is covered by an integration test that walks it as one system
(`test/integration/pipeline.integration-spec.ts`). `VERIFIED`

Five layers are held apart exactly as the architecture requires, and the
separation is enforced by the database rather than by convention:

```
Person      is this the same human?          →  matching keys only, no lifecycle
Applicant   what was declared, this attempt? →  frozen legal snapshot
Student     who is this learner, permanently?→  identity + current demographics
Admission   which spell of study?            →  branch-scoped, entry → exit
Enrollment  where are they placed this year? →  year-scoped, superseded not edited
```

**What is ready.** Person resolution with blind indexing and envelope
encryption; the thirteen-state applicant machine with row locks, mandatory
reasons, history and outbox events on every edge; `studentCode` as a permanent
organization-scoped identifier issued by one central numbering engine;
`Admission` as a spell of study with a database-enforced one-active rule;
`Enrollment` as an immutable placement with a supersede primitive; and
`admit()`, the keystone transaction, verified against concurrency, rollback and
cross-branch collision.

**What is not.** Three whole supporting modules the lifecycle references but
does not have — **Guardian-as-Person**, **Address** and **Document** — plus the
entire post-admission lifecycle (promotion, repeat, transfer, readmission,
withdrawal, graduation, archival).

**The single most important finding of this reconciliation.** The architecture
states, in three separate documents, that guardianship is a **Person ↔ Person**
relationship and that this is *why* `admit()` needs to do nothing about
guardians. **It is not implemented that way.** `Guardian` is a standalone,
branch-scoped table holding a plaintext Aadhaar and inline address columns, and
it links to `Applicant` — not to `Person`. The consequence is precise and
serious:

> **A student admitted today has no guardian.** The guardianship was recorded
> against the *applicant*, `admit()` copies nothing, and there is no
> Student→Guardian or Person→Guardian path in the schema. Every guardian
> relationship is stranded on the application the moment the application stops
> being the live record.

That, together with three further guardian defects (non-transactional primary
exclusivity, absent financial exclusivity, and a complete absence of tenant
scoping on every guardian route), is why this document's verdict is
**NOT READY TO FREEZE** — narrowly, and on the guardian axis alone. The
Person/Student/Admission/Enrollment core itself is sound and is recommended for
freeze once the guardian boundary is corrected.

---

# 2. Current implementation baseline

## 2.1 What exists, by layer

| Layer | Model(s) | Service | Routes | Status |
| :--- | :--- | :--- | :--- | :--- |
| Identity index | `Person`, `PersonSensitive`, `PersonMatchDecision`, `PersonMergeLog` | `PersonService` | `POST /persons/match`, `GET /persons/:id`, `POST /persons/:id/government-id`, `POST /persons/match-decisions` | `IMPLEMENTED` `VERIFIED` |
| Crypto | `OrganizationDataKey`, `DataKeyRotationLog` | `IdentityCryptoService`, `IdentityHashService` | — | `IMPLEMENTED` `VERIFIED` |
| Application | `Applicant`, `ApplicantProgramPreference` | `ApplicantService`, `ApplicantPreferenceService` | `/admissions/applicants/**` | `IMPLEMENTED` `VERIFIED` |
| Workflow | `WorkflowHistory` (polymorphic) | `WorkflowService`, `OfferExpiryJob` | `POST /admissions/applicants/:id/workflow/transition`, `GET …/history` | `IMPLEMENTED` `VERIFIED` |
| Guardian | `Guardian`, `ApplicantGuardianMapping` | `GuardiansService` | `/admissions/guardians/**` | `IMPLEMENTED` — **but not to spec**, see §8 |
| Learner identity | `Student` | `StudentService` | `GET /students`, `GET /students/lookup`, `GET /students/:id`, `PATCH /students/:id` | `IMPLEMENTED` `VERIFIED` |
| Spell of study | `Admission` | `AdmissionService` | **none** — controlled creation only | `IMPLEMENTED` `VERIFIED` |
| Placement | `Enrollment` | `EnrollmentService` | `GET /enrollments`, `…/:id`, `…/:id/history`, `POST …/correct`, `…/transfer`, `…/cancel`, `PATCH …/roll-number` | `IMPLEMENTED` `VERIFIED` |
| Conversion | — | `AdmissionConversionService` | `POST /admissions/applicants/:id/admit` | `IMPLEMENTED` `VERIFIED` |
| Numbering | `NumberSequenceConfig`, `NumberSequenceCounter` | `NumberingService` | `/numbering/**` | `IMPLEMENTED` `VERIFIED` |
| Events / durability | `OutboxEvent` | `OutboxPublisher`, `OutboxRelay` | — | `IMPLEMENTED` `VERIFIED` |
| Audit | `AuditLog` | `AuditListener`, `AuditEventMapper`, `AuditRepository` | `/audit/**` | `IMPLEMENTED` `VERIFIED` |
| Masters | Religion, Caste, Category, Gender, BloodGroup, Language, Disability, RelationType, Quota, AdmissionSource | `BaseMasterService` + 10 services | `/admissions/masters/**` | `IMPLEMENTED` `VERIFIED` |

## 2.2 What does not exist at all

| Missing | Referenced by | Consequence today | Status |
| :--- | :--- | :--- | :--- |
| `Address` / `PersonAddress` / `PincodeReference` | S2 spec, blueprint §25 | Addresses are inline columns on `Applicant` and `Guardian`; a Student has **no address** | `DEFERRED` (S2) |
| `Document` / `DocumentVersion` / `DocumentType` / `DocumentRequirement` | S3 spec, blueprint §26, `DOCUMENT_PENDING`, `DOCUMENT_CHECKLIST_SATISFIED` | The checklist guard is a **no-op**; `Applicant.photoFileId` and `Student.photoDocumentId` point at nothing | `DEFERRED` (S3) |
| `Guardianship` (Person ↔ Person) | S1 D1, blueprint §24.1 | Guardians do not survive conversion — §8 | **BLOCKING** |
| `ConfigDefinition` / `ConfigValue` | F2, every `*ConfigProvider` | Policy comes from two hard-coded providers | `DEFERRED` (F2) |
| Seat capacity anywhere | blueprint §50 Q3 | No capacity check is performed, by design | `DECIDED` — out of scope |
| Student lifecycle transitions | blueprint §19 | `Student.status` is write-once `ACTIVE` | `DEFERRED` (Phase 6) |
| Promotion / repeat / branch transfer / readmission | blueprint §20, §22, §23 | Enum values exist; no operation writes them | `DEFERRED` (Phase 6) |
| Person merge execution | blueprint §19.3 | `mergedIntoPersonId` and `PersonMergeLog` exist; nothing writes them | `DEFERRED` |
| `UserIdentityLink` (Student ↔ User) | blueprint §27 | No portal, no student/parent login | `DEFERRED` (Phase 7) |

## 2.3 Migration state

| Migration | Contents |
| :--- | :--- |
| `00000000000000_baseline` | Pre-phase schema |
| `20260808000000_phase0_foundation` | Numbering rewrite, outbox, `AuditLog.eventId`, `pg_trgm` |
| `20260809000000_phase1_identity_foundation` | Person, PersonSensitive, keys, match/merge tables |
| `20260810000000_phase2_student_identity` | Student + `student_one_per_applicant`, `student_origin_check`, dob/code/name CHECKs |
| `20260811000000_phase3_admission_workflow` | Admission, preferences, `admission_one_active`, `applicant_one_active`, offer-window CHECK, two `NOT VALID` CHECKs |
| `20260812000000_phase4_enrollment` | Enrollment rebuild, composite FKs, `enrollment_one_primary_per_year`, `enrollment_rollno_unique`, supersede/provenance CHECKs, deferred self-FKs |

Phase 5 (`admit()`) required **no migration** — it composes what Phases 1–4
built. `VERIFIED`

---

# 3. Domain glossary

| Term | Definition | Owner model | Never means |
| :--- | :--- | :--- | :--- |
| **Person** | "Is this the same human?" A deduplication index of matching keys, organization-scoped, with no lifecycle and no display attributes. | `Person` | A profile. A user. A role. |
| **Applicant** | One admission attempt: one application, to one branch, for one academic year. A **frozen legal snapshot** of what was declared on a date. | `Applicant` | A student. A person's current details. |
| **Guardian** | The adult side of a caring relationship, plus role-specific facts (occupation, income). | `Guardian` | The relationship itself. |
| **Guardianship** | The relationship — who is primary, who pays, who may collect. | *(not implemented)* | A household. |
| **Student** | The permanent learner identity within one organization, plus the institution's **current official** demographics. | `Student` | A placement. A login. A person. |
| **Admission** | One continuous **spell of study** at one branch: entry date, entry level, quota, exit date, exit reason. | `Admission` | An academic year. An application. |
| **Enrollment** | One **academic-year placement**: programme, unit, roll number, for this year only. | `Enrollment` | Identity. Demographics. A spell. |
| **Academic Unit** | The leaf of academic structure a learner sits in — section, division, class. Branch + programme + year scoped. | `AcademicUnit` | A programme. |
| **Programme** | What is studied. Branch-scoped. | `Program` | Org-wide. Two branches' "Std 9" are two rows. |
| **Study spell** | The interval between joining a branch and leaving it. Spans many academic years. | `Admission` | — |
| **Placement** | Where a learner sits for one year. | `Enrollment` | — |
| **Supersede** | Close a placement naming its replacement, and write the replacement. Never an edit. | `Enrollment` | Delete. Update. |
| **Blind index** | `HMAC-SHA256(pepper, orgId + ":" + domain + ":" + normalized)` — searchable without being reversible. | `Person.govtIdHash`, `Person.phoneHash` | Encryption. |
| **Crypto-erasure** | Null the ciphertext and keep the row, so the record survives and the value does not. | `PersonSensitive` | Deletion. |
| **Orchestrated transition** | A workflow edge only its owning operation may invoke, because the status alone would assert something the rest of the database does not support. | `SEAT_CONFIRMED → ADMITTED` | A system-only edge. |
| **MONOTONIC / GAPLESS** | Allocation modes. The first commits on its own connection (gaps possible); the second runs in the caller's transaction (no gaps, serialised). | `AllocationMode` | — |

---

# 4. Complete lifecycle

## 4.1 The canonical diagram

```
                          ┌─────────────────────────────────────┐
                          │  Person  (organization-scoped)      │
                          │  govtIdHash · phoneHash · dob ·     │
                          │  nameNormalized                     │
                          └───────┬─────────────────────┬───────┘
                                  │                     │
              PersonSensitive ────┘                     │
              (AES-256-GCM ciphertext, last4)           │
                                                        │
   ┌────────────────────────────────────────────────────┴────────────┐
   │                                                                 │
   │  Guardian side — INTENDED (S1 D1)          Ward side            │
   │                                                                 │
   │   Person(adult) ──Guardianship──▶ Person(child)                 │
   │                                                                 │
   │  Guardian side — AS IMPLEMENTED                                 │
   │                                                                 │
   │   Guardian(branch-scoped, own aadhaarNo, own address)           │
   │        └──ApplicantGuardianMapping──▶ Applicant   ✗ dies here   │
   └─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
              ┌───────────────────────────────────────┐
              │  Applicant  (branch + academic year)  │
              │   personId?    ← bound at SUBMIT      │
              │   programId?   ← required at SUBMIT   │
              │   inline address snapshot             │
              │   previous education snapshot         │
              │   ApplicantProgramPreference[]        │
              │   admissionFormNo · applicationNo     │
              └───────────────────┬───────────────────┘
                                  │
                     ┌────────────▼────────────┐
                     │   WORKFLOW (13 states)  │
                     │   lock → validate →     │
                     │   mutate → history →    │
                     │   outbox, per edge      │
                     └────────────┬────────────┘
                                  │
                            SEAT_CONFIRMED
                                  │
                    POST /admissions/applicants/:id/admit
                                  │
             ┌────────────────────▼─────────────────────┐
             │  ONE TRANSACTION — READ COMMITTED, 15 s  │
             │  1 lock applicant  FOR UPDATE            │
             │  2 re-assert SEAT_CONFIRMED              │
             │  3 personId ← applicant's own            │
             │  4 refuse if a Student exists            │
             │  5 Student   + STUDENT_CODE              │
             │  6 Admission + ADMISSION_NO              │
             │  7 Enrollment                            │
             │  8 workflow ADMIT (orchestratedOnly)     │
             └────────────────────┬─────────────────────┘
                                  │
        ┌─────────────────────────┼──────────────────────────┐
        ▼                         ▼                          ▼
┌───────────────┐        ┌────────────────┐        ┌──────────────────┐
│   Student     │        │   Admission    │        │   Enrollment     │
│  studentCode  │◀───────│  admissionNo   │◀───────│  rollNumber?     │
│  status       │        │  entryProgram  │        │  academicYearId  │
│  demographics │        │  entryUnit     │        │  programId       │
│  personId     │        │  quota/source  │        │  academicUnitId  │
│  branchId ptr │        │  exit*         │        │  originType      │
└───────────────┘        └────────────────┘        └──────────────────┘
      forever              entry → exit                  one year
```

## 4.2 Post-admission shapes — `DEFERRED` (Phase 6), shapes verified by test

```
Student ──▶ PROMOTION      old Enrollment  PROMOTED   ──▶ new Enrollment (next unit)
                           same Student · same Admission · same studentCode

Student ──▶ REPEAT         old Enrollment  DETAINED   ──▶ new Enrollment (same unit,
                           isRepeat: true)                same Student · same Admission

Student ──▶ CORRECTION     old Enrollment  SUPERSEDED ──▶ new Enrollment
            / MID-YEAR     naming its successor and reason  (IMPLEMENTED today)
            TRANSFER

Student ──▶ BRANCH         Admission #1 TRANSFERRED_OUT ──▶ Admission #2 (new branch,
            TRANSFER       Enrollment  TRANSFERRED          new admissionNo)
                           Student.branchId moves      ──▶ new Enrollment
                           studentCode UNCHANGED

Student ──▶ READMISSION    Admission #1 closed          ──▶ Admission #2
                           (gap)                             previousAdmissionId: #1
                           same Student · same personId ──▶ new Enrollment
                           studentCode UNCHANGED
```

`test/integration/pipeline.integration-spec.ts` asserts each of these three
shapes is *representable* without touching student identity, ahead of the
operations that will write them. `VERIFIED`

## 4.3 What the four tables count

Conflating these is the most likely reporting error. `DECIDED`

| Question | Count | Why not the others |
| :--- | :--- | :--- |
| How many applied? | `Applicant` | Includes rejected, withdrawn, cancelled |
| How many people do we teach? | `Student` | A readmitted student is one person, not two |
| How many did we admit this year? | `Admission` | A readmission is a second admission for one student |
| How many are placed in a class? | `Enrollment` | One per student per year; the only year-scoped count |

---

# 5. Person / identity

## 5.1 What Person is, and the sprawl rule

`Person` holds **only matching keys** — values whose sole purpose is deciding
whether two records describe one human. It has no status, no lifecycle, no
display name, no contact details, no photograph and no address. `DECIDED`

> **The sprawl rule.** The moment Person exists there is pressure to move "just
> the name" onto it, then the photo, then the address. Every one of those varies
> **per role** — an applicant's declared name, a student's corrected name and a
> guardian's name legitimately diverge — which is precisely what Person must not
> do. A change adding a display or contact attribute to Person is a design
> error, not a convenience.
> — `prisma/modules/identity/person.prisma` `VERIFIED`

## 5.2 Columns and their purpose

| Column | Type | Null | Purpose | Sensitive |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid v7 | no | Internal identity, never rendered to end users | — |
| `organizationId` | String | no | **Person never spans tenants.** The same human at two organizations is two Persons, by design. | — |
| `govtIdHash` | String? | yes | Blind index over the government identifier. Null until one is supplied; Postgres treats NULLs as distinct, so any number of people may have none. | Derived — not reversible |
| `phoneHash` | String? | yes | Blind index over the last 10 digits. **A weak signal** — one household mobile routinely serves every child. | Derived |
| `dob` | DateTime | **no** | The primary discriminator between same-named people. Required, because a nullable one would silently degrade every medium- and low-confidence match. | Yes (plaintext, by necessity) |
| `nameNormalized` | String | no | Case-folded, punctuation-stripped, whitespace-collapsed. **Never rendered** — it exists to be compared, not read. | Yes (plaintext, by necessity) |
| `mergedIntoPersonId` | String? | yes | Tombstone pointer. Merge execution is not built; the column exists so a stale reference resolves rather than dangles once it is. | — |

`IMPLEMENTED` `VERIFIED`

**There is deliberately no `deletedAt`.** Historical records point at this row,
and a Person whose sensitive data has been erased still deduplicates — which is
what stops an erased subject re-enrolling as a stranger. `DECIDED`

## 5.3 The blind index, and why the organization id is inside the message

```
govtIdHash = HMAC-SHA256(pepper, organizationId + ":" + domain + ":" + normalized)
phoneHash  = HMAC-SHA256(pepper, organizationId + ":" + "phone" + ":" + last10)
```

The organization id is inside the **message**, not merely the query scope, so
the same human at two tenants produces **unrelated digests**. The index cannot
correlate people across organizations even by direct comparison of stored
values. The domain separator (`aadhaar`, `phone`) stops a phone number equal to
an identifier colliding. `IMPLEMENTED` `VERIFIED`
(`src/infrastructure/crypto/identity-hash.service.ts`, `government-id.ts`)

## 5.4 Encryption and masking

| Concern | Mechanism | Location |
| :--- | :--- | :--- |
| Ciphertext | AES-256-GCM, authenticated | `PersonSensitive.aadhaarEnc` |
| Key | Per-organization DEK, **never stored** — only its wrapped forms | `OrganizationDataKey` |
| Operational wrap | Symmetric `ENCRYPTION_KEY` (server holds it) | `dekWrappedOperational` |
| Recovery wrap | **Public half** of a recovery keypair; the private half never exists on the server | `dekWrappedRecovery` |
| Key generation | Recorded per row so a rotation does not invalidate existing ciphertext | `keyVersion` |
| Display | `XXXX XXXX 1234` from `aadhaarLast4`, no decryption | `maskAadhaar()` |
| Erasure | Null `aadhaarEnc`, set `erasedAt`/`erasedBy`, keep the row and the blind index | `IdentityCryptoService` |

`IMPLEMENTED` `VERIFIED`. A DEK with no recovery wrap is
`PENDING_RECOVERY_CUSTODY` and is **refused outright in production** — the
application must not pretend a recovery path exists when it does not.

**Gap.** `PersonSensitiveErasedEvent` is declared and registered in the audit
allowlist, and `IdentityCryptoService` has the erase primitive, but **no route
or service method invokes it**. Erasure is a capability, not yet an operation.
`VERIFIED` · `DEFERRED` (F1)

## 5.5 Resolution — deterministic, never blocking

`PersonService.resolve(organizationId, identifiers, tx?)` `IMPLEMENTED` `VERIFIED`

```
1. normalize name → reject if empty          PERSON_NAME_REQUIRED
2. compute phoneHash (if phone supplied)
3. normalize + validate government id (if supplied) → GOVERNMENT_ID_INVALID
4. if government id:
     look up (organizationId, govtIdHash)
       hit  → follow merge tombstone → return { created: false,
                                                matchedByGovernmentId: true,
                                                warnings: [] }        ← SILENT
5. INSERT Person   (inside a SAVEPOINT when running in a caller's transaction)
     unique violation → ROLLBACK TO SAVEPOINT → re-read the winner's row
6. if created: compute fuzzy candidates as NON-BLOCKING warnings
```

Two operations, kept apart on purpose:

| | `resolve()` | `findCandidates()` |
| :--- | :--- | :--- |
| Nature | **Deterministic** | **Fuzzy** |
| Question | "This *is* the same human" | "This *might* be the same human" |
| Output | A usable Person | Suggestions for a human to judge |
| Blocks? | Never | Never |

> Conflating them is why duplicate detection in most systems is either useless
> or infuriating: the deterministic case gets a warning nobody needs, and the
> fuzzy case gets a block that rejects twins.

### The savepoint, and why it is load-bearing

Catching the unique violation is only half of it. In Postgres a failed statement
aborts the **whole** transaction: every later command returns *"current
transaction is aborted"*. Standalone, that never shows — the failed insert *is*
the transaction. Composed inside an applicant submission, the re-read would land
in the aborted transaction and the caller would get a Prisma error instead of
the winner's Person. A savepoint scopes the failure to the insert.
`IMPLEMENTED` `VERIFIED`

## 5.6 Match confidence

| Confidence | Signal | Behaviour |
| :--- | :--- | :--- |
| **Deterministic** | Same `govtIdHash` | Same human. Return silently, no warning. |
| **MEDIUM** | `phoneHash` + `dob` | Suggestion only. Likely the same human **or a sibling** — households share numbers. |
| **LOW** | `nameNormalized` + `dob` | Suggestion only. Common names plus a shared birthday are not rare. |
| **HIGH** | *declared in the type, never produced* | — |

Candidates are capped at 25 per signal and exclude pairs already recorded
`DISTINCT`. `IMPLEMENTED` `VERIFIED`

## 5.7 Twins, and why demographics never merge

Twins share a surname, a date of birth, an address, a household mobile and their
parents. **Every** demographic signal matches. Resolution therefore *never*
returns an existing Person on demographics alone — it always creates a new one
and reports the similarity as a warning. `DECIDED`

The consequence, and the defect this caused before Phase 5.5: asking the
identity question **twice** for one applicant gives two different answers when
there is no government identifier. Submission resolved a Person; `admit()`
re-resolved and, finding no deterministic key, minted a **second** Person. The
Applicant pointed at the first and the Student at the second. Fixed by
`admit()` reusing the applicant's own `personId` and resolving only for rows
that predate the identity index. `VERIFIED` — `admission-conversion.service.ts`
step 3.

## 5.8 `PersonMatchDecision` — why "not a duplicate" is stored

Without it the same twin warning fires at every step of every year, and staff
learn to dismiss all warnings reflexively — which destroys the value of the ones
that matter. The pair is stored in canonical order (`personAId < personBId`) so
one comparison cannot be recorded twice under two spellings. A mandatory reason
is what makes the decision reviewable. Only `DISTINCT` is ever written; the
opposite conclusion is a **merge**, not a decision row. `IMPLEMENTED` `VERIFIED`

## 5.9 Cross-organization isolation

| Vector | Closed by |
| :--- | :--- |
| Probing another tenant's students by identifier | The organization id is inside the HMAC message — digests do not correlate |
| Reading another tenant's Person by UUID | `findFirst({ id, organizationId })`, 404 on miss |
| A global identity registry | **Refused.** The same human at two organizations is two Persons. `DECIDED` |

## 5.10 Person's relationships

| Relationship | Cardinality | Status |
| :--- | :--- | :--- |
| Person → Student | `0..1` — `Student.personId @unique` **and** `@@unique([organizationId, personId])` | `IMPLEMENTED` `VERIFIED` |
| Person → Applicant | `0..n` — one human may have several attempts across years and branches | `IMPLEMENTED` `VERIFIED` |
| Person → PersonSensitive | `0..1` | `IMPLEMENTED` `VERIFIED` |
| **Person → Guardian** | **Does not exist** | **BLOCKING** — §8 |
| Person → Employee | Not modelled; S4 is `planned` | `DEFERRED` |
| Person → Person (merge) | Self-relation, tombstone only | `DEFERRED` |

The overlap between `personId @unique` and `@@unique([organizationId, personId])`
is deliberate: the composite is the invariant the architecture names and it
survives a corrupted `organizationId`; the column-level constraint is what makes
the Prisma relation **one-to-one**, so a reader sees `Person.student` rather
than `Person.students[]` and cannot be misled about cardinality.

## 5.11 Merge — designed for, not built

| Property | Decision |
| :--- | :--- |
| Direction | Merge is a **Person** operation, never a Student operation | `DECIDED` |
| Evidence | `PersonMergeLog` records survivor, merged, reason and `repointedRefs` JSON | `IMPLEMENTED` (table only) |
| Chains | Collapsed, not walked — merge writes A→C directly when B is already merged into C. `resolveSurvivor` caps at 5 hops as a corruption guard. | `IMPLEMENTED` `VERIFIED` |
| Second approver | `REQUIRES BUSINESS DECISION` — blueprint §50 Q11 recommends single-actor for v1 |
| Execution | `DEFERRED` |

---

# 6. Applicant

## 6.1 What Applicant owns

One admission attempt: one application, to one branch, for one academic year.
**Temporary by design, terminal once resolved.** Its demographic fields are a
**frozen legal snapshot** of what was declared on the form on a date — which is
why `Student` carries its own copy rather than referencing back. A name
corrected by affidavit in 2029 must not silently rewrite the 2026 application
form. `DECIDED`

## 6.2 Field specification

Legend for **Editable**: `D` = DRAFT only, `D/S` = until the offer is issued,
`✗` = never through any route. Frozen statuses are `APPROVED`, `SEAT_CONFIRMED`,
`ADMITTED`, `DEFERRED`, `REJECTED`, `WITHDRAWN`, `CANCELLED`
(`applicant.service.ts:FROZEN_STATUSES`). `VERIFIED`

### Scope and numbering

| Field | Type | Req | Default | Editable | Validation | Owner | Sensitive | Audit |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | uuid v7 | auto | `uuid(7)` | ✗ | — | Applicant | no | key |
| `organizationId` | String | auto | from context | ✗ | ExecutionContextGuard | Context | no | key |
| `branchId` | String | auto | from context | ✗ | `@RequireBranch()` | Context | no | key |
| `academicYearId` | String | auto | from context | ✗ | `@RequireAcademicYear()` | Context | no | key |
| `admissionFormNo` | String | auto | `ADMISSION_FORM` seq | ✗ | `@@unique([branchId, academicYearId, admissionFormNo])` | Numbering | no | high |
| `applicationNo` | String | auto | `APPLICATION` seq | ✗ | `@@unique([branchId, academicYearId, applicationNo])` | Numbering | no | high |

### Personal information

| Field | Type | Req | Editable | Validation | Belongs to | Sensitive |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `firstName` | String | ✅ | D/S | non-empty | **Snapshot** (also Person `nameNormalized`) | low |
| `middleName` | String? | — | D/S | — | Snapshot | low |
| `lastName` | String | ✅ | D/S | non-empty | Snapshot | low |
| `displayName` | String | derived | ✗ | joined from the three parts on write | Applicant | low |
| `dob` | DateTime | ✅ | D/S | ISO date | **Snapshot** (also a Person matching key) | **yes** |
| `genderId` | String | ✅ | D/S | master exists | Snapshot | low |
| `birthPlace` | String? | — | D/S | — | Snapshot | low |
| `photoFileId` | String? | — | D/S | **references nothing** | *(S3 when it lands)* | yes |

### Contact information

| Field | Type | Req | Editable | Validation | Belongs to | Sensitive |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `primaryMobile` | String | ✅ | D/S | `/^[+0-9\s-]{7,15}$/` | Snapshot + Person `phoneHash` | **yes** |
| `alternateMobile` | String? | — | D/S | same | Snapshot | **yes** |
| `primaryEmail` | String? | — | D/S | `@IsEmail` | Snapshot | **yes** |

### Demographic information

`religionId`, `casteId`, `categoryId`, `motherTongueId`, `bloodGroupId`,
`disabilityTypeId` — all `String?`, editable D/S, each validated as an existing
non-deleted master. `disabilityStatus Boolean @default(false)`,
`disabilityNotes String?`. All are **snapshot** facts, copied to `Student` at
admission and thereafter maintained independently. Sensitivity: caste, category,
religion and disability are **special-category personal data** — see §36.

### Government identity

| Field | Type | Req | Editable | Validation | Belongs to | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `aadhaarNo` | String? | — | D/S | `/^\d{12}$/` at the DTO | **Should be `PersonSensitive`** | **DISCREPANCY** — see below |
| `penNo` | String? | — | D/S | — | Snapshot → copied to Student | plaintext by design (F1 D5) |
| `apaarId` | String? | — | D/S | — | Snapshot → copied to Student | plaintext by design |

> **DISCREPANCY — Applicant.aadhaarNo**
> **DOCUMENTED** — I2 D4: *"`aadhaarNo` is REMOVED from Applicant. Sensitive
> identifiers live once, on `PersonSensitive`, so erasure has one place to act."*
> **IMPLEMENTED** — the column, its `@@index([aadhaarNo])`, the DTO field and
> the `checkDuplicates` search on it all still exist.
> **VERIFIED** — `prisma/modules/admissions/applicant.prisma`,
> `applicant.dto.ts`, `applicant.service.ts:73`.
> **RECOMMENDED** — keep as-is **only** until the Guardian→Person work lands,
> then migrate both `Applicant.aadhaarNo` and `Guardian.aadhaarNo` out in one
> pass. `planning/README.md` already carries this as a named carry-forward. The
> mitigation that makes it survivable today: the value is **only ever read
> through `PersonService`**, and `Student`, `Admission` and `Enrollment` have no
> such column — asserted by test. One plaintext copy defeats encryption as
> thoroughly as three, so this is a real debt, not a cosmetic one.

### Address (inline snapshot)

`currentAddressLine1` (required), `currentAddressLine2?`, `city` (required),
`district?`, `state` (required), `country` (required), `pincode` (required,
`/^[a-zA-Z0-9\s-]{3,10}$/`).

**These are the declaration, not the residence.** They are never migrated to S2
and never rewritten when the family moves — see §10. `DECIDED`

### Previous education

`previousSchoolName?`, `previousBoard?`, `previousClass?`,
`previousPercentage?` (Float), `tcNumber?`. All snapshot, all optional, none
validated beyond type. Not copied to Student. `IMPLEMENTED` `VERIFIED`

### Academic selection

| Field | Type | Req | Editable | Validation | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `programId` | String? | **at SUBMIT** | D/S | must belong to the branch, be active, not deleted | *Applied for*, not *entered* |
| `admissionSourceId` | String? | — | D/S | master in scope | Acquisition channel |
| `quotaId` | String? | — | D/S | master in scope | Reservation category |
| `transportRequired` | Boolean | — | D/S | — | An intent, not a booking |
| `hostelRequired` | Boolean | — | D/S | — | An intent, not a booking |

**There is deliberately no `academicUnitId` on Applicant.** An applicant applies
to a programme — "Std 1" — and which *section* they join is the decision made at
admission. `DECIDED`

### Identity linkage and workflow state

| Field | Type | Set by | Immutable after |
| :--- | :--- | :--- | :--- |
| `personId` | String? | `WorkflowService` at `SUBMIT` | Set once; `if (applicant.personId) return it` |
| `admissionStatus` | enum | **Workflow engine only** | Never directly writable |
| `submittedAt`, `approvedAt`, `offerIssuedAt`, `offerExpiresAt`, `seatConfirmedAt`, `deferredAt`, `withdrawnAt`, `rejectedAt`, `cancelledAt` | DateTime? | The transition table's `timestamps` list | Per transition |
| `approvedBy`, `rejectedBy` | String? | The transition table's `actorColumn` | Per transition |
| `deferredFromApplicantId` | String? | Deferment re-application | — |

One nullable timestamp per transition rather than a single `statusChangedAt`: a
report asking *"when was the offer issued?"* must not have to reconstruct it
from history, and the offer window is a business deadline the expiry job reads
directly. `DECIDED`

### Provenance, remarks and extensibility

`internalRemarks?`, `counsellorRemarks?`, `assignedCounsellorId?`,
`customFieldData Json?`, `checklistStatus Json?`, `tags Json?`,
`formTemplateVersion?`, `createdBy/updatedBy/createdAt/updatedAt/deletedAt`.

> **`checklistStatus` is an unvalidated client-supplied JSON blob** accepted by
> both the create and update DTOs, and nothing reads it. When S3 lands, the
> computed checklist supersedes it. **RECOMMENDED:** stop accepting it from the
> client now; it is a field that looks like a control and is not one.
> `VERIFIED` — `applicant.dto.ts:248`.

## 6.3 What is on Applicant that belongs elsewhere

| Field | Belongs to | Why it is still here | Status |
| :--- | :--- | :--- | :--- |
| `aadhaarNo` | `PersonSensitive` | Migration deferred with the Guardian work | **REQUIRED REFINEMENT** |
| Address columns | `Address` + `PersonAddress` for the *residence*; the snapshot legitimately stays | Correct as a snapshot; there is simply no residence record anywhere else | `DECIDED` (snapshot) + `DEFERRED` (S2) |
| `photoFileId` | `Document` | S3 not built. **RECOMMENDED: drop the column** and treat a photo as an ordinary document — a special-case column gets none of the scanning, size limits, versioning or encryption. | `DEFERRED` |
| `checklistStatus` | Computed from `DocumentRequirement` | S3 not built | `DEFERRED` |

## 6.4 What is correctly *not* on Applicant

No `studentId`, no `admissionId`, no `enrollmentId`, no `academicUnitId`, no
`rollNumber`, no capacity, no fee balance. The application is not the student,
and the funnel does not own placement. `VERIFIED`

---

# 7. Applicant workflow

## 7.1 The engine

One method drives every transition — human or scheduled — because the moment
there are two paths one of them stops writing history. Every transition is:

```
lock (SELECT … FOR UPDATE, scoped)
  → re-read status under the lock
  → assert the edge is legal from the current state
  → evaluate named guards
  → update status + stamped timestamps + actor column
  → write WorkflowHistory
  → enqueue the named outbox event
```

in **one transaction, in that order**. The lock comes first because a state
check against an unlocked read is a guess: `findUnique` takes no lock, so two
registrars approving at the same moment both see `UNDER_REVIEW` and both pass.
`IMPLEMENTED` `VERIFIED` — `workflow.service.ts`

**The caller names a verb, never a destination.** `{ action: 'approve' }`, not
`{ newStatus: 'APPROVED' }` — the engine owns where each action leads, so a
client cannot invent a path. `DECIDED`

## 7.2 The thirteen states

| State | Meaning | Terminal | Editable | Reachable from |
| :--- | :--- | :--- | :--- | :--- |
| `DRAFT` | A form somebody is part-way through | no | ✅ | *(creation)* |
| `SUBMITTED` | Filed; **Person bound here** | no | ✅ | DRAFT |
| `UNDER_REVIEW` | Being assessed | no | ✅ | SUBMITTED, DOCUMENT_PENDING, CANCELLED (force) |
| `DOCUMENT_PENDING` | Waiting on paperwork | no | ✅ | UNDER_REVIEW |
| `FEE_PENDING` | Waiting on an application fee | no | ✅ | UNDER_REVIEW |
| `WAITLISTED` | Held pending a seat | no | ✅ | UNDER_REVIEW |
| `APPROVED` | **Offer made, seat provisionally held** | no | ❌ frozen | UNDER_REVIEW, DOCUMENT_PENDING, FEE_PENDING, WAITLISTED |
| `SEAT_CONFIRMED` | Offer accepted; the only admissible state | no | ❌ frozen | APPROVED |
| `DEFERRED` | Terminal *for this cycle*; continues as a new Applicant | no exit edge | ❌ frozen | APPROVED |
| `ADMITTED` | Student, Admission and Enrollment exist | **✅** | ❌ frozen | SEAT_CONFIRMED *(orchestrated only)* |
| `REJECTED` | Institution refused | **✅** | ❌ frozen | SUBMITTED, UNDER_REVIEW, DOCUMENT_PENDING, FEE_PENDING, WAITLISTED |
| `WITHDRAWN` | Applicant walked away | **✅** | ❌ frozen | every non-terminal state |
| `CANCELLED` | Institution ended it, or the offer lapsed | reopenable | ❌ frozen | every non-terminal state, + expiry sweep |

`IMPLEMENTED` `VERIFIED` — `admission-application.enums.prisma`,
`workflow.transitions.ts`

`DEFERRED` has **no outbound edge** and is not in `TERMINAL_STATES`. It is
terminal in practice and the continuation is a *new* Applicant carrying
`deferredFromApplicantId`. Mutating the old row would destroy the record of
which year it was originally for. `DECIDED`

## 7.3 The complete transition table

| Action | From | To | Permission | Remarks | Guards | Stamps | Actor col | Event | Flags |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `submit` | DRAFT | SUBMITTED | `admissions.update` | optional | — | `submittedAt` | — | `applicant.submitted` | **binds `personId`** |
| `startReview` | SUBMITTED | UNDER_REVIEW | `admissions.update` | optional | — | — | — | `applicant.review_started` | |
| `requestDocuments` | UNDER_REVIEW | DOCUMENT_PENDING | `admissions.update` | **required** | — | — | — | `applicant.documents_requested` | |
| `documentsReceived` | DOCUMENT_PENDING | UNDER_REVIEW | `admissions.update` | optional | `DOCUMENT_CHECKLIST_SATISFIED` | — | — | `applicant.documents_received` | guard is a **no-op** |
| `requestFee` | UNDER_REVIEW | FEE_PENDING | `admissions.update` | optional | — | — | — | `applicant.fee_requested` | |
| `waitlist` | UNDER_REVIEW | WAITLISTED | `admissions.approve` | **required** | — | — | — | `applicant.waitlisted` | |
| `approve` | UNDER_REVIEW, DOCUMENT_PENDING, FEE_PENDING, WAITLISTED | APPROVED | `admissions.approve` | optional | `DOCUMENT_CHECKLIST_SATISFIED` | `approvedAt`, `offerIssuedAt`, `offerExpiresAt` | `approvedBy` | `applicant.offer_issued` | |
| `confirmSeat` | APPROVED | SEAT_CONFIRMED | `admissions.update` | optional | `OFFER_NOT_EXPIRED` | `seatConfirmedAt` | — | `applicant.seat_confirmed` | |
| `defer` | APPROVED | DEFERRED | `admissions.approve` | **required** | `DEFERMENT_ENABLED` | `deferredAt` | — | `applicant.deferred` | off by default |
| `expireOffer` | APPROVED | CANCELLED | `admissions.approve` | optional | `OFFER_EXPIRED` | `cancelledAt` | — | `applicant.offer_expired` | **`systemOnly`** |
| `reject` | SUBMITTED, UNDER_REVIEW, DOCUMENT_PENDING, FEE_PENDING, WAITLISTED | REJECTED | `admissions.reject` | **required** | — | `rejectedAt` | `rejectedBy` | `applicant.rejected` | |
| `withdraw` | DRAFT … SEAT_CONFIRMED (8 states) | WITHDRAWN | `admissions.update` | **required** | — | `withdrawnAt` | — | `applicant.withdrawn` | applicant-initiated |
| `cancel` | DRAFT … SEAT_CONFIRMED (8 states) | CANCELLED | `admissions.approve` | **required** | — | `cancelledAt` | — | `applicant.cancelled` | institution-initiated |
| `admit` | SEAT_CONFIRMED | ADMITTED | `admissions.approve` (+ `student.create` in the orchestrator) | optional | — | — | — | `applicant.admitted` | **`orchestratedOnly`** |
| `forceReopen` | CANCELLED | UNDER_REVIEW | `admissions.approve` | **required** | — | — | — | `applicant.force_reopened` | audit `severity: WARN` |

`IMPLEMENTED` `VERIFIED` — `workflow.transitions.ts`

## 7.4 The three flags, and what each protects

| Flag | Question it answers | Effect |
| :--- | :--- | :--- |
| `systemOnly` | **Who** may act | Only `actor.system = true`. Keeps the expiry sweep out of the human action surface while still routing it through the engine. Human attempt → `403 SYSTEM_ACTION`. |
| `orchestratedOnly` | **What else must already have happened** | Only the operation that owns the transition. `POST /workflow/transition` cannot reach it — there is **no DTO field** that sets `orchestrated`, which is the entire mechanism. Attempt → `400 ORCHESTRATED_TRANSITION`. |
| `severity: WARN` | How loudly to record it | Raised audit severity on the break-glass path. |

> `ADMITTED` means a Student, an Admission and an Enrollment exist. No request
> body can assert that. This is why the edge exists in the table (so the machine
> is complete and testable) and is unreachable over HTTP.

## 7.5 The four guards

| Guard | Rule | Implementation |
| :--- | :--- | :--- |
| `OFFER_NOT_EXPIRED` | `expiresAt` read **under the lock**, never from the request. Inclusive of its own instant: `now === expiresAt` still confirms. | `IMPLEMENTED` `VERIFIED` |
| `OFFER_EXPIRED` | The complementary **strict** comparison, so exactly one of the two can win a race. | `IMPLEMENTED` `VERIFIED` |
| `DEFERMENT_ENABLED` | `AdmissionConfigProvider.defermentEnabled()` — **false** by default. | `IMPLEMENTED` `VERIFIED` |
| `DOCUMENT_CHECKLIST_SATISFIED` | **Returns without checking anything.** | See below |

> **DISCREPANCY — the document checklist guard**
> **DOCUMENTED** — blueprint §26.2 and S3 §2.1: `DOCUMENT_PENDING` means *"at
> least one unsatisfied mandatory requirement at the current stage"*, computed
> from `DocumentRequirement` over `admissionType × programId × quotaId ×
> categoryId`.
> **IMPLEMENTED** — the guard is declared on `documentsReceived` and `approve`
> and its body is a bare `return`.
> **VERIFIED** — `workflow.service.ts:424-430`.
> **RECOMMENDED** — **leave it exactly as it is.** The code states the reasoning
> and it is right: *"a fabricated check would pass every time while looking like
> a control."* The guard is wired so S3 satisfies it by supplying the service,
> changing nothing at the call site. Until then, `DOCUMENT_PENDING` means only
> *"a reviewer said documents are outstanding"* and `documentsReceived` means
> *"a reviewer said they arrived"* — a human control, honestly labelled.

## 7.6 Person binding at submission

`SUBMIT` is the one transition that also establishes identity. It happens inside
the same transaction and **after the lock**, so a Person is never resolved for
an application that then fails to move. `IMPLEMENTED` `VERIFIED`

```
submit:
  programId missing        → 400 PROGRAM_REQUIRED
  personId already set     → reuse it
  aadhaarNo present        → resolve WITH the government id (deterministic)
    …validation fails      → log a warning WITHOUT the value, degrade to demographics
  aadhaarNo absent         → resolve on demographics (always creates)
  candidate warnings       → logged, NEVER blocking
  duplicate active app     → 409 DUPLICATE_ACTIVE_APPLICATION (from applicant_one_active)
```

A stored identifier that fails validation does **not** block submission: the
column predates the identity module and may hold anything, and refusing an
application because a legacy field is malformed would be a new failure
introduced by a cleanup. `DECIDED`

## 7.7 The offer window

| Aspect | Behaviour |
| :--- | :--- |
| Length | `AdmissionConfigProvider.offerValidityDays(scope, asOf)` — **15 days** default |
| Set | `approve` stamps `offerIssuedAt` and `offerExpiresAt` together |
| Constraint | `applicant_offer_window_check`: both null or both set, and `offerExpiresAt > offerIssuedAt` |
| Enforcement | The `confirmSeat` guard, read under the lock — **this** is what enforces the deadline |
| Sweep | `OfferExpiryJob`, hourly, batches of 200, **through the engine** with `system: true` |
| Disable | `OFFER_EXPIRY_JOB_DISABLED=true` logs a warning at boot |

The job tidies state; it is not what enforces the deadline. An offer is unusable
the instant it lapses regardless of when the sweep next runs. `IMPLEMENTED`
`VERIFIED`

## 7.8 `WorkflowHistory`

Polymorphic on `(entityType, entityId)` rather than holding a foreign key, so
history survives the deletion of what it describes. `organizationId` and
`branchId` are carried on the row rather than reached through a join, so a
history read can be scoped without touching the entity table.
`WorkflowEntityType` covers `APPLICANT`, `ADMISSION`, `ENROLLMENT`, `STUDENT`.
`IMPLEMENTED` `VERIFIED`

> **DISCREPANCY — history coverage**
> **DOCUMENTED** — blueprint §31.1 step 10: *"Write `WorkflowHistory` rows for
> Applicant, Admission and Enrollment."*
> **IMPLEMENTED** — `admit()` writes **one** row, for the Applicant.
> `AdmissionService.createControlled` and
> `EnrollmentService.createInitialEnrollment` write none;
> `supersedeEnrollment` and `cancelEnrollment` do write `ENROLLMENT` rows.
> **VERIFIED** — `admission.service.ts`, `enrollment.service.ts:writeInitialEnrollment`.
> **RECOMMENDED** — add a birth row for Admission and Enrollment inside
> `admit()`'s transaction (`oldStatus: null`, `newStatus: ACTIVE`,
> `actionType: 'ADMISSION'`). Without it, `GET /enrollments/:id/history` on a
> freshly admitted student returns an **empty array**, and the admission
> register has no origin entry. Low risk, one insert each, closes a real gap
> between the two most-read history endpoints and the rows they describe.

---

# 8. Guardian

> **This section reports the single blocking finding of the reconciliation.**

## 8.1 What the architecture specifies

Three documents agree, in identical terms:

| Source | Statement |
| :--- | :--- |
| S1 §2 D1 | *"Guardianship links two **Persons**, not a Guardian to an Applicant. The decisive change. A guardianship survives the applicant→student transition with **zero re-mapping**."* |
| S1 §2 D2 | Guardian becomes **organization-scoped** (branch-scoped today) — one parent login shows every child, and siblings frequently sit in different branches. |
| S1 §2 D3 | Guardian **drops `aadhaarNo`**, gains `personId`. |
| S1 §3.1 | Guardian **drops** all six address columns; they move to S2. |
| Blueprint §24.1 | *"`admit()` does nothing about guardians."* |
| Blueprint §20.3 | On a branch transfer, guardianships are *"untouched — Person↔Person, and Guardian is org-scoped."* |

```
                    INTENDED
    Person(adult) ──Guardianship──▶ Person(child) ◀── Student.personId
                         │
                         ├─ relationTypeId
                         ├─ isPrimary            at most one active per ward
                         ├─ isFinancialGuardian  at most one active per ward
                         ├─ isEmergencyContact   many, ordered by emergencyPriority
                         ├─ isLegalGuardian
                         ├─ pickupAllowed + pickupValidFrom/To
                         └─ startedAt / endedAt
```

## 8.2 What is implemented

```
                   AS IMPLEMENTED
    Guardian (organizationId, branchId, aadhaarNo, address×6)
        │
        └── ApplicantGuardianMapping ──▶ Applicant
                                            │
                                            ✗  admit() copies nothing
                                            ✗  no Student → Guardian path
                                            ✗  no Person  → Guardian path
```

`Guardian` columns, verified in `prisma/modules/admissions/guardian.prisma`:

| Group | Columns |
| :--- | :--- |
| Scope | `organizationId`, **`branchId`** |
| Identity | `firstName`, `middleName?`, `lastName` |
| Contact | `mobilePrimary`, `mobileSecondary?`, `email?` |
| Professional | `occupation?`, `income?` |
| Government | **`aadhaarNo?`** — plaintext, `@@index([aadhaarNo])` |
| Address | **`addressLine1?`, `addressLine2?`, `city?`, `state?`, `country?`, `pincode?`** |
| Lifecycle | `createdAt`, `updatedAt`, `deletedAt?` |
| **Absent** | **`personId`** |

`ApplicantGuardianMapping`: `applicantId`, `guardianId`, `relationTypeId`,
`isPrimary`, `isEmergencyContact`, `isFinancialGuardian`, `pickupAllowed`,
`priority`, `@@unique([applicantId, guardianId])`.

**Absent from the mapping:** `startedAt`/`endedAt`, `isLegalGuardian`,
`emergencyPriority`, `pickupValidFrom`/`pickupValidTo`.

## 8.3 The reconciliation

```
DOCUMENTED   Guardianship is Person ↔ Person, organization-scoped, no Aadhaar,
             no address, with validity windows, and it survives conversion
             untouched.

IMPLEMENTED  Guardian is a standalone branch-scoped record holding its own
             plaintext Aadhaar and its own address, linked to Applicant.

VERIFIED     prisma/modules/admissions/guardian.prisma
             src/modules/admissions/guardians/guardians.service.ts
             src/modules/admissions/guardians/guardians.controller.ts
             src/modules/admissions/admission/admission-conversion.service.ts
               — searched: zero references to guardian, guardianship or mapping

RECOMMENDED  BLOCKING REFINEMENT. Implement Guardianship as specified before
             the core is frozen. Everything downstream of it — parent portal,
             fee dunning, emergency contact, pickup authorisation, transport,
             sibling derivation — depends on a relationship that currently
             evaporates at the exact moment the child becomes a student.
```

### Why this is blocking rather than merely incomplete

It is not that guardians are missing a feature. It is that the **stated reason
`admit()` is allowed to ignore guardians is false**. The architecture reasons:
*guardianship is Person↔Person, Person does not change at admission, therefore
no re-mapping is needed*. The premise does not hold, so the conclusion does not
either — and the code faithfully implements the conclusion. The result:

| After `admit()` | Result |
| :--- | :--- |
| `student.guardians` | No such relation exists |
| `person.guardians` | No such relation exists |
| Guardian of a student | Reachable **only** by `Student.sourceApplicantId → ApplicantGuardianMapping` |
| A migrated student (`sourceApplicantId = null`) | **Unreachable. No guardian at all, ever.** |
| A readmitted student (Admission #2, no new Applicant) | Guardians still hang off the *first* application |
| Siblings | Not derivable — two children of one parent are two `Guardian` rows if the parent was entered twice, and there is no dedup key |

## 8.4 The four live guardian defects

### Defect 1 — primary-guardian exclusivity is not transactional · **BLOCKING**

```ts
// guardians.service.ts:110-144  VERIFIED
if (dto.isPrimary) {
  await this.prisma.applicantGuardianMapping.updateMany({   // ← statement 1
    where: { applicantId, isPrimary: true },
    data:  { isPrimary: false },
  });
}
const mapping = await this.prisma.applicantGuardianMapping.upsert({ … }); // ← statement 2
```

Two statements, **no transaction**. If the upsert fails — a bad
`relationTypeId`, a constraint, a dropped connection — every previous
`isPrimary` has already been cleared and committed. **The child is left with no
primary guardian at all**, and nothing reports it.

`DOCUMENTED` (S1 §2.1 Defect 1, blueprint §24.2) · `IMPLEMENTED` unchanged ·
`VERIFIED` 2026-08-12 · **still exists**

### Defect 2 — `isFinancialGuardian` has no exclusivity at all · **BLOCKING**

`isPrimary` at least *attempts* the clear-then-set dance. `isFinancialGuardian`
is written straight through in both the `create` and `update` branches with no
clearing and no constraint. **A ward can have three financial guardians**, and
the fee module will either pick one arbitrarily or send three invoices.

`DOCUMENTED` (S1 §2.1 Defect 2) · `VERIFIED` · **still exists**

### Defect 3 — no tenant or branch scoping on any guardian operation · **BLOCKING, NEW**

Not recorded in any existing document. Found during this reconciliation.

| Method | Scope in the `WHERE` | Consequence |
| :--- | :--- | :--- |
| `findOne(id)` | `{ id, deletedAt: null }` | **Any authenticated user of any tenant can read any guardian by UUID** — name, mobile, email, occupation, income, **Aadhaar**, full address |
| `update(id, dto)` | `findOne` then `update({ where: { id } })` | **Cross-tenant write** |
| `mapGuardianToApplicant` | applicant looked up by id only; guardian by id only | **Maps another tenant's guardian to another tenant's applicant** |
| `getMappedGuardians` | `{ applicantId }` | Reads any applicant's guardian list cross-tenant |
| `removeMapping` | `{ applicantId, guardianId }` | Cross-tenant delete |
| `search(q, branchId)` | branch only | Scoped, but see Defect 4 |

The controller declares `@Roles(...)` and `@RequireBranch()` but **no
`@RequirePermission`** on any route — the only guardian module in the codebase
without one. Compare `applicant.controller.ts`, `student.controller.ts`,
`enrollment.controller.ts`, all of which carry both.

This is exactly the BOLA class the blueprint's §8.2 catalogued and Phase 0
closed **for other modules**. Guardians were not in that sweep. `VERIFIED` ·
**BLOCKING REFINEMENT**

### Defect 4 — guardian search is a substring oracle over plaintext Aadhaar · **HIGH, NEW**

```ts
OR: [ { mobilePrimary: { contains: searchTerm } },
      { aadhaarNo:     { contains: searchTerm } }, … ]
```

Any `STAFF` user can probe Aadhaar values by substring across an entire branch,
learning digits they were never shown. The correct shape is what `Person`
already does: **hash the input and compare digests**, so a search matches an
exact identifier and reveals nothing about any other. `VERIFIED` ·
**REQUIRED REFINEMENT**

### Defect 5 — re-mapping silently clears the flags · **MEDIUM, NEW**

The `upsert`'s `update` branch writes `isPrimary: dto.isPrimary || false` and
the same for the other three booleans. A client calling
`POST /guardians/applicant/:id/map` to change **only** the relation type, with
`isPrimary` omitted, silently **demotes the primary guardian to false**. A
partial update that resets unmentioned fields is a data-loss shape.
`VERIFIED` · **REQUIRED REFINEMENT**

### Defect 6 — guardian events bypass the outbox and carry PII · **MEDIUM, NEW**

```ts
await this.eventBus.publish(new GuardianCreatedEvent({
  guardianId, firstName, lastName, mobilePrimary,   // ← PII into the payload
}));
```

Two problems. First, `eventBus.publish` is fire-and-forget and is **not** in a
transaction — the guardian row can commit while the event is lost, or the event
can fire for a write that then fails. Every other Phase 1–5 module uses
`outbox.enqueue(event, tx)`. Second, `guardian.created` is in the audit
allowlist, so the name and mobile number are **written verbatim into
`AuditLog.payload`**, contradicting the standing rule that identity values do
not enter audit payloads. `VERIFIED` · **REQUIRED REFINEMENT**

## 8.5 The target model

`RECOMMENDED` — as specified by S1 §3, unchanged by this document.

**`Guardian`** — organization-scoped, `personId` required, dropping `branchId`,
`aadhaarNo` and all six address columns. What remains is the role-specific
residue: names, `mobilePrimary`, `mobileSecondary`, `email`, `occupation`,
`income`.

> Guardian is then thin enough to ask whether it should exist at all rather than
> being fields on Person. It survives because occupation, income and employer
> are **guardian-role** facts that a Person who is only a student never has —
> and Person must stay a matching index.

**`Guardianship`** — replaces `ApplicantGuardianMapping`:
`organizationId`, `guardianPersonId`, `wardPersonId`, `relationTypeId`,
`isPrimary`, `isFinancialGuardian`, `isEmergencyContact`, `emergencyPriority?`,
`isLegalGuardian`, `pickupAllowed`, `pickupValidFrom?`, `pickupValidTo?`,
`startedAt`, `endedAt?`, plus audit columns.

## 8.6 Migration order

The sequence matters, and step 5 is the one that will surprise:

1. Resolve a `Person` for every existing `Guardian`, hashing `aadhaarNo` into
   `Person.govtIdHash` and encrypting it into `PersonSensitive`.
2. Move guardian addresses to S2 (or hold them until S2 lands).
3. Convert `ApplicantGuardianMapping` → `Guardianship`, translating
   `applicantId` to that applicant's `wardPersonId`. **An applicant with a null
   `personId` (a DRAFT) has no ward** — decide whether to drop or defer those.
4. Drop `Guardian.aadhaarNo`, `Guardian.branchId`, the address columns.
5. **Reconcile pre-existing violations before creating the partial unique
   indexes.** Index creation will fail on any ward that already has two
   financial guardians — which Defect 2 makes possible, and which nothing has
   been stopping.

---

# 9. Guardianship / family

## 9.1 The relationship roles

| Role | Cardinality per ward | Meaning | Consumer |
| :--- | :--- | :--- | :--- |
| **Primary** | Exactly one active | The default contact; who the school calls first | Communication, portal |
| **Financial** | Exactly one active | Who pays. Exactly one, or invoicing has no addressee. | Fees, invoicing, `BILLING` address resolution |
| **Emergency** | Many, **ordered** | An escalation list — the entire point is that there is more than one | Attendance, medical, incident |
| **Legal** | Many | Custody, legally distinct from biology | Certificates, consent, disclosure |
| **Pickup** | Many, **time-boxed** | Who may collect the child, and when | Gate, transport |

`emergencyPriority` orders the escalation list; `priority` on the current
mapping is an undifferentiated integer serving the same purpose less precisely.
`RECOMMENDED`: replace `priority` with `emergencyPriority` so the column names
the thing it orders.

## 9.2 Sibling derivation — no `Household`, no sibling table

> **Two wards sharing an active guardianship are siblings.** An explicit sibling
> edge is a second source of truth that drifts the moment a guardianship
> changes. `DECIDED` (S1 D5)

```sql
-- the whole implementation
SELECT g2."wardPersonId"
  FROM "Guardianship" g1
  JOIN "Guardianship" g2 ON g2."guardianPersonId" = g1."guardianPersonId"
 WHERE g1."wardPersonId" = $1
   AND g2."wardPersonId" <> $1
   AND g1."endedAt" IS NULL AND g2."endedAt" IS NULL;
```

**`Household` is explicitly refused.** It adds a mandatory join to every address
and contact read and pays off only in the minority of genuinely shared cases.
Shared addresses are handled by two people referencing **one `Address` row**,
which is all a household would have provided here. `DECIDED` — do not introduce
one.

## 9.3 Cross-branch and cross-organization

| Case | Behaviour | Status |
| :--- | :--- | :--- |
| Siblings in **different branches** of one organization | Both visible under one guardian — **requires** the org-scoped Guardian of S1 D2. **Impossible today**, since `Guardian.branchId` is required. | **BLOCKING** |
| One human guardian at **two organizations** | Two Persons, two unrelated guardianships, two logins. Correct for isolation; accepted cost. | `DECIDED` |
| Guardian who is also a **student or employee** | One Person, several roles. This is precisely why Person exists. | `DECIDED` |
| Guardian **merge** | There is no separate path — it is a **Person merge**. | `DECIDED` · `DEFERRED` |

## 9.4 Guardianship lifecycle

```
[created] ──▶ [active] ──┬──▶ [ended]        endedAt + reason: custody change,
                         │                    death, withdrawal
                         └──▶ flags change    primary / financial handover
```

**No status column** — `endedAt` carries it. A guardianship is **never
hard-deleted**: an ended guardianship still explains a historical sibling
relationship, and a school needs to show why a parent stopped being an
authorised contact on a given date.

### The handover shape

Father was primary; mother becomes primary in March:

```
Guardianship  father → child   isPrimary: false   endedAt: null
                               ← flag cleared, row still active:
                                 he is still a guardian, just not the primary
Guardianship  mother → child   isPrimary: true    startedAt: 2027-03-04
```

Both rows persist. The audit trail shows the exact date the primary contact
changed — which is what matters when someone asks who should have been called.

## 9.5 Guardian continuity across conversion

**The intended answer, and the one this specification recommends restoring:**

| Entity | At `admit()` | Why |
| :--- | :--- | :--- |
| `Guardianship` rows | **Untouched. Zero writes.** | Both ends are Persons, and `Person` does not change at admission |
| `guardianPersonId` | unchanged | |
| `wardPersonId` | unchanged | It is the same Person the Student now points at |
| Guardian's `Person` | unchanged | |
| Student → guardians | `GuardianService.findByWard(student.personId)`, composed **at the API layer** | Student never joins to Guardian directly — that is what keeps the dependency one-way |

**The actual answer today:** the guardianship is an
`ApplicantGuardianMapping` and it stays pointed at the Applicant. Nothing about
the Student can reach it except through `sourceApplicantId`, and that path is
null for migrated students. `VERIFIED`

## 9.6 Is a guardian mandatory?

`REQUIRES BUSINESS DECISION` — S1 §10 Q1, unchanged.

For a minor, obviously yes. For an adult learner (distance education, coaching)
there may be none at all. Options: (a) required below a configurable age,
optional above; (b) always optional with a warning; (c) required per programme
type. The recommendation on file is **(a)** using F2 configuration, since the
age threshold differs by institution. Nothing enforces any of the three today.

---

# 10. Address

## 10.1 Two things called "address"

| | Applicant's inline address | S2 `Address` |
| :--- | :--- | :--- |
| What it is | A **legal snapshot** of what was declared on a date | Where the person **actually lives now** |
| Changes? | **Never** | Whenever they move |
| Owner | `Applicant` | `Person` |
| Purpose | Evidence | Operations |
| Status | `IMPLEMENTED` `VERIFIED` | **Does not exist** |

If a family moves in 2029, the 2026 application form must still show the 2026
address. Merging these would make that impossible — the same reasoning that
keeps Student's demographics separate from Applicant's. `DECIDED`

## 10.2 Current state

| Location | Columns | Assessment |
| :--- | :--- | :--- |
| `Applicant` | `currentAddressLine1/2`, `city`, `district`, `state`, `country`, `pincode` | **Correct as a snapshot.** Keep. Never migrate. |
| `Guardian` | `addressLine1/2`, `city`, `state`, `country`, `pincode` | **Wrong.** These are current-address facts about a living person and belong in S2. Backfill and drop. |
| `Student` | **none** | **Correct.** Verified: `Student` has zero address columns. |
| `Person` | **none** | Correct — Person is a matching index; addresses attach *through* `PersonAddress`. |

> **A student admitted today has no address record anywhere except the frozen
> application snapshot.** Blueprint §25.2 anticipated this: *"`admit()` copies
> the applicant's declared address into a `CURRENT` `PersonAddress` **if S2
> exists**; otherwise the applicant's inline address remains the only address,
> reachable through `sourceApplicantId`."* That is the state we are in.
> `VERIFIED` · `DEFERRED` (S2)

## 10.3 The target model

`RECOMMENDED` — S2 §3, unchanged.

**`Address` — immutable value object.** `organizationId`, `line1`, `line2?`,
`landmark?`, `city`, `district?`, `state`, `countryCode` (default `IN`),
`pincode`, `latitude?`, `longitude?`, `normalizedHash`, `createdAt`. **No
`updatedAt` — the row never changes.**

**`PersonAddress` — append-only link.** `personId`, `addressId`, `addressType`,
`validFrom`, `validTo?`, `verificationStatus`, `verifiedBy?`, `verifiedAt?`,
`proofDocumentId?`, `changeReason?`.

**`PincodeReference` — seeded.** `pincode` (PK), `district`, `state`,
`countryCode`. Used to auto-fill and validate, **never to block** — new PIN
codes are issued and the reference will always lag.

### Why immutable

The obvious design gives each person an address row and edits it when they move.
That loses history, and history is required: a Transfer Certificate issued in
2031 must print the address as it was when issued. Versioning rows in place
breaks *sharing*, because two siblings pointing at one row cannot have
independent histories. So the place is immutable and the link is append-only —
which gives sharing and history simultaneously.

A family of four at one address is **one** `Address` row and four
`PersonAddress` links, de-duplicated on `normalizedHash`. A move creates **one**
new `Address` and closes/opens one link per family member.

## 10.4 The four types

| Type | Meaning | Resolution |
| :--- | :--- | :--- |
| `PERMANENT` | The family's home of record | Direct |
| `CURRENT` | Where they live now | Direct |
| `COMMUNICATION` | Where post goes | **Falls back to `CURRENT`** |
| `BILLING` | Where the invoice goes | **Resolves through the financial guardian**, then their `CURRENT` |

```
resolveAddress(personId, type, asOf = now)
  1. PersonAddress of exactly `type`, valid at asOf
  2. COMMUNICATION → fall back to CURRENT
  3. BILLING       → the ward's financial guardian (S1) → their CURRENT
  4. else null
```

Step 3 is why `BILLING` is rarely set directly — the bill goes to whoever pays,
which the guardianship already records. **It therefore depends on the financial-
guardian exclusivity that §8 Defect 2 does not enforce**: with three financial
guardians the billing address is non-deterministic.

## 10.5 Correction versus relocation

A clerk mistypes a house number and fixes it an hour later. **This produces the
same shape as a move** — a new `Address` and a new link — because the system
cannot distinguish a correction from a relocation after the fact, and the wrong
value may already be printed on a certificate. `changeReason` is what
distinguishes them **for a human reader**, which is the correct place for the
distinction: a free-text reason a person wrote, not a flag the system guessed.

## 10.6 Address invariants (target)

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | One current address per person per type | Partial unique index on `(personId, addressType) WHERE validTo IS NULL` |
| 2 | No overlapping windows | Exclusion constraint over `tstzrange(validFrom, validTo)` — needs `btree_gist` |
| 3 | A closed window is ordered | `CHECK (validTo IS NULL OR validFrom < validTo)` |
| 4 | De-duplication within a tenant | `@@unique([organizationId, normalizedHash])` |
| 5 | **`Address` is never updated** | No update path **and** `REVOKE UPDATE` on the table role |
| 6 | Well-formed Indian PIN | `CHECK (countryCode <> 'IN' OR pincode ~ '^[1-9][0-9]{5}$')` |

Invariant 5 is what makes history trustworthy. If **any** code path can edit an
`Address`, every historical `PersonAddress` silently starts pointing at the new
value and certificates printed years ago retroactively change.

## 10.7 Open questions

| # | Question | Status |
| :--- | :--- | :--- |
| A1 | Where does India Post PIN data come from, and how is it refreshed? | `REQUIRES BUSINESS DECISION` — recommendation on file: a static seeded snapshot refreshed per release, since unknown PINs warn rather than block |
| A2 | Must an address change be verified before it takes effect? | `REQUIRES BUSINESS DECISION` — a parent updating an address in a portal could redirect a Transfer Certificate. Recommendation: staff writes immediate-with-audit, portal writes propose-then-approve |
| A3 | Does `admit()` seed a `CURRENT` `PersonAddress` from the application? | `RECOMMENDED: yes`, once S2 exists. Student's schema is identical either way, so S2 can land before or after without touching it. |

---

# 11. Documents

## 11.1 Current state — nothing exists

There is **no `Document`, `DocumentVersion`, `DocumentType`,
`DocumentRequirement`, `File` or `Attachment` model in the schema.** `VERIFIED`

Three dangling references point at the absence:

| Reference | Type | Points at | Status |
| :--- | :--- | :--- | :--- |
| `Applicant.photoFileId` | `String?` | nothing | **RECOMMENDED: drop.** A photograph is a document; it needs the same scanning, size limits, versioning and encryption, and a special-case column gets none of them. |
| `Student.photoDocumentId` | `String?` | nothing, **deliberately no FK** | **Keep.** The comment is explicit: no foreign key, so Student compiles and migrates whether or not S3 exists. |
| `Applicant.checklistStatus` | `Json?` | nothing reads it | **RECOMMENDED: stop accepting it from clients.** |

## 11.2 Document versus requirement

> A **document** is a file that exists. A **requirement** is the rule that a file
> must exist. They are different tables, and the second is the one that gets
> forgotten — which is exactly why `DOCUMENT_PENDING` currently has nothing to
> compute against. `DECIDED`

Requirements are a function of:

```
admissionType × programId × quotaId × categoryId   → required at requiredByStage
```

A general-category regular admission needs a birth certificate and a marksheet.
An RTE admission additionally needs an income certificate and residence proof. A
migration admission needs a migration certificate. **Hard-coding that is how
institutions end up unable to run their own admission policy.** `DECIDED`

`requiredByStage` is what lets a school accept an incomplete application and
chase documents later — which is what actually happens.

## 11.3 Ownership by document meaning

**This is the table to implement against.** Ownership follows what the document
*proves*, not who uploaded it. `DECIDED` — blueprint §26.1, verified as
internally consistent, not redesigned here.

| Document | `ownerType` | `ownerId` | Why |
| :--- | :--- | :--- | :--- |
| Birth certificate | `PERSON` | `personId` | Follows the human across roles and across admissions |
| Aadhaar copy | `PERSON` | `personId` | Same |
| Caste / income certificate | `PERSON` | `personId` | A fact about the human |
| Photograph | `PERSON` | `personId` | Same human, one photo |
| Application-supporting evidence | `APPLICANT` | `applicantId` | Evidence attached to **one attempt** |
| **Transfer Certificate** | `ADMISSION` | `admissionId` | A TC certifies a **spell of study** |
| Character certificate | `ADMISSION` | `admissionId` | Covers the whole spell |
| Marksheet | `ENROLLMENT` | `enrollmentId` | Belongs to one academic year |
| Bonafide for a specific year | `ENROLLMENT` | `enrollmentId` | Certifies a placement |
| Migration certificate | `ENROLLMENT` | `enrollmentId` | Certifies a placement |
| Medical / health record | `STUDENT` | `studentId` | A student-role fact, not a person-role one |
| Guardian ID proof | `PERSON` | guardian's `personId` | A fact about that human |

The test that generalises it: **what does this document prove?** A fact about the
human → `PERSON`. Evidence for one attempt → `APPLICANT`. A fact about a spell →
`ADMISSION`. A fact about a year → `ENROLLMENT`. A student-role fact that is not
about a placement → `STUDENT`.

## 11.4 Per-type policy

| Attribute | Held on | Purpose |
| :--- | :--- | :--- |
| Required when | `DocumentRequirement.requiredByStage` | Which workflow state demands it |
| Required for whom | `appliesToAdmissionType / ProgramId / QuotaId / CategoryId` (null = all) | Institution's own policy |
| Mandatory? | `DocumentRequirement.isMandatory` | Drives `DOCUMENT_PENDING` |
| Expiry | `DocumentType.hasExpiry`, `defaultValidityMonths` → `Document.expiresAt` | Caste, income, medical fitness expire |
| Who verifies | `BRANCH_ADMIN`+ | Verification is a decision, not data entry |
| Replaceable | Yes — **new version**, never overwrite | `DocumentVersion` append-only |
| Versioning | `versionNumber` 1..n, `@@unique([documentId, versionNumber])` | |
| Storage | Adapter interface; `storageKey` **generated, never derived from the filename** | Path traversal |
| Encryption | Organization DEK at rest | Tenant offboarding crypto-shreds documents too |
| Virus scan | **Mandatory and blocking on ingest** | Parents upload arbitrary files from arbitrary devices |
| Download | **Signed, short-lived, audited URL** — never a public path | A predictable URL to a birth certificate is a breach with extra steps |
| Size / MIME | Per type — a photo is not a 40 MB PDF | |
| Retention | `DocumentType.retentionYears` | Drives archival |

## 11.5 The lifecycle and its one dangerous state

```
upload ──▶ [scan PENDING] ──┬──▶ [CLEAN]    ──▶ becomes current ──▶ [verification PENDING]
                            │                                          ├──▶ [VERIFIED]
                            │                                          └──▶ [REJECTED + reason]
                            ├──▶ [INFECTED] ──▶ quarantined, never served, admin alerted
                            └──▶ [FAILED]   ──▶ retry; NEVER assumed clean
```

**`FAILED` must not be treated as `CLEAN`.** A scanner that is down is a reason
to refuse the file, not to wave it through. **An infected or unscanned version
is never current** — this cannot be a database constraint (it spans tables), so
it needs an explicit test rather than a comment.

**Re-verification is required when a new version is uploaded.** Otherwise
uploading a fresh file inherits the previous file's verified status, which is an
obvious way to slip an unverified document past a checklist.

**Expiry does not invalidate an admission.** An expired caste certificate is an
administrative task, not a reason to un-enroll a child.

## 11.6 Resolving the two workflow terms

| Term | Meaning today | Meaning once S3 lands |
| :--- | :--- | :--- |
| `DOCUMENT_PENDING` | *"A reviewer said paperwork is outstanding."* A human judgement with no computation behind it. | **At least one unsatisfied mandatory `DocumentRequirement` at the applicant's current stage.** |
| `DOCUMENT_CHECKLIST_SATISFIED` | A guard that returns without checking. | Every mandatory requirement for `admissionType × program × quota × category` at `requiredByStage ≤ current` has a `VERIFIED`, unexpired document. |

`VERIFIED` · the second column is `RECOMMENDED`, and the guard is already wired
so supplying the service is the only change needed.

## 11.7 Document open questions

| # | Question | Status |
| :--- | :--- | :--- |
| DQ1 | What performs virus scanning? | `REQUIRES BUSINESS DECISION` — ClamAV sidecar (self-hosted, needs operating) vs a cloud API (**sends student documents to a third party** — a DPDP consideration). Skipping is not acceptable. Recommendation on file: ClamAV, and it is a real P5 infrastructure dependency. |
| DQ2 | Where are blobs stored? | `REQUIRES BUSINESS DECISION` — depends on the undecided deployment model. Recommendation: one S3-compatible contract everywhere (MinIO on-premise), to avoid two backup stories. |
| DQ3 | Do parents upload directly? | `REQUIRES BUSINESS DECISION` — recommendation: **staff-only in v1**; parent upload once the portal is scoped and rate limiting designed. |

---

# 12. Academic selection

## 12.1 What each object is, and who chooses it

| Object | Kind | Scope | Chosen by | Recorded on |
| :--- | :--- | :--- | :--- | :--- |
| `Program` | Academic structure | **branch** | Applicant (application choice) → confirmed at offer | `Applicant.programId` → `Admission.entryProgramId` → `Enrollment.programId` |
| `AcademicYear` | Academic structure | **branch** | Execution context at registration | `Applicant.academicYearId` → `Enrollment.academicYearId` |
| `AcademicUnit` | Academic structure | **branch + programme + year** | **Registrar, at `admit()`** | `Admission.entryAcademicUnitId` → `Enrollment.academicUnitId` |
| Section / division | *A value of `AcademicUnitType`*, not a separate model | same | same | same |
| `Quota` | Master (three-tier) | org / branch / system | Applicant, verified by reviewer | `Applicant.quotaId` → `Admission.quotaId` |
| `AdmissionSource` | Master (three-tier) | org / branch / system | Staff | `Applicant.admissionSourceId` → `Admission.admissionSourceId` |
| `Category` | Master (three-tier) | org / branch / system | Applicant declares | `Applicant.categoryId` → `Student.categoryId` |
| `AdmissionType` | **Enum, core vocabulary** | — | Registrar, at `admit()` | `Admission.admissionType` |
| `ApplicantProgramPreference` | Application choice | applicant | Applicant | own table |

`IMPLEMENTED` `VERIFIED`

## 12.2 Classification

| Classification | Members |
| :--- | :--- |
| **Master / reference data** | Quota, AdmissionSource, Category, Caste, Religion, Gender, BloodGroup, Language, Disability, RelationType |
| **Academic structure** | Program, AcademicYear, AcademicUnit |
| **Core vocabulary (enum, not configurable)** | AdmissionType, AdmissionStatus, AdmissionExitReason, EnrollmentKind/Status/OriginType, AdmissionApplicationStatus |
| **Application choices** | `Applicant.programId`, preferences, quota, category, transport/hostel intent |
| **Admission decisions** | `Admission.entryProgramId`, `entryAcademicUnitId`, `admissionType`, `admissionDate`, quota, source |
| **Final placement** | `Enrollment.programId`, `academicUnitId`, `rollNumber` |

## 12.3 Applied-for versus entered versus placed

Three different facts, three different columns, and collapsing any two loses
information:

```
Applicant.programId          what was APPLIED FOR
        │                    a lateral entrant applies to a degree
        ▼
Admission.entryProgramId     what was ACTUALLY ENTERED
Admission.entryAcademicUnitId  …and at what level
        │                    …and enters its SECOND YEAR
        ▼
Enrollment.programId         where they are PLACED, this year
Enrollment.academicUnitId    …and after two promotions this is the fourth year
```

> Deriving the entry level from a later Enrollment would lose it, because by
> then the student has been promoted past it. `DECIDED`

`admit()` copies `Applicant.programId` into `Admission.entryProgramId` **and
refuses to let the caller change it** — the programme was offered and confirmed
earlier in the funnel and is not the caller's to change at this moment. The
academic unit is an input because nothing earlier records one. `VERIFIED`

## 12.4 Preferences and allotment

`ApplicantProgramPreference`: ordered, `preferenceOrder ≥ 1`, unique per
position and per programme, status
`PENDING | ALLOTTED | REJECTED | WITHDRAWN`. A school creates **zero** rows and
sets `Applicant.programId` directly; a college ranks. One model serves both.
`IMPLEMENTED` `VERIFIED`

The list is replaced wholesale rather than edited one row at a time — positions
are only meaningful together, and adding a choice at position 2 shifts
everything below it. Delete-and-reinsert in one transaction means no observer
ever sees an inconsistent ranking. `VERIFIED`

> **DISCREPANCY — allotment**
> **DOCUMENTED** — I2 §3.2: status values `PENDING | OFFERED | DECLINED |
> ALLOTTED`; invariant 4 requires a partial unique index
> `pref_one_allotted ON (applicantId) WHERE status = 'ALLOTTED'`; when a
> preference is allotted, `Applicant.programId` is set to it.
> **IMPLEMENTED** — enum values are `PENDING | ALLOTTED | REJECTED | WITHDRAWN`;
> **the `pref_one_allotted` index does not exist**; there is **no allotment
> operation** anywhere, so nothing ever writes a non-`PENDING` status.
> **VERIFIED** — migration grep, `applicant-preference.service.ts`.
> **RECOMMENDED** — the enum divergence is fine and arguably better
> (`REJECTED`/`WITHDRAWN` are more useful than `OFFERED`/`DECLINED` for a
> preference row). **Add the partial unique index with the allotment
> operation, not before** — an index guarding a state nothing can reach is
> inert, and adding it alongside the operation keeps the two in step.
> `DEFERRED` until an institution runs an allotment round.

## 12.5 Structural validation at every write

| Rule | Where | Mechanism |
| :--- | :--- | :--- |
| Programme belongs to the branch, is active, not deleted | `ApplicantService.assertProgramInBranch`, `AdmissionService.assertAcademicStructure` | Service check |
| Unit belongs to branch **and** programme **and** year, and is active | `AdmissionConversionService.resolvePlacement` | Service check → clean named error |
| Unit belongs to branch, programme and year | `Enrollment` composite FK to `AcademicUnit(id, branchId, programId, academicYearId)` | **Database — unrepresentable otherwise** |
| Programme belongs to the branch | `Enrollment` composite FK to `Program(id, branchId)` | **Database** |
| Enrollment's student and branch match its admission's | `Enrollment` composite FK to `Admission(id, studentId, branchId)` | **Database** |
| Year is not locked | `readAcademicYearLock` under `FOR SHARE` | Lock + check |
| Quota / source belong to this tenant or are platform-seeded | `assertMastersInScope` | Service check |

The service checks exist so the caller gets a **named** error; the database
constraints exist so the combination is impossible even if a service is
bypassed. Both, deliberately. `IMPLEMENTED` `VERIFIED`

## 12.6 Cross-branch programme identity

`Program`, `AcademicYear` and `AcademicUnit` are **all branch-scoped with no
`organizationId`**. "Std 9 CBSE English medium" at Mumbai and at Pune are two
different rows with two different UUIDs. Consequences:

- A branch transfer produces an Enrollment referencing a **different**
  `programId`, even though a parent and a registrar would both say "same
  programme".
- Any cross-branch academic report must group by **name/medium/stream**, not by
  `programId`.
- Master data must resolve **above the branch**: a transferred student's
  `categoryId` must point at a row visible in the new branch, so
  government-defined masters must be seeded at SYSTEM or ORGANIZATION level,
  never per branch. The three-tier scoping already supports this — it is a
  provisioning policy, not a schema change.

`VERIFIED` · `REQUIRES BUSINESS DECISION` (blueprint §50 Q4 — an org-level
`ProgramTemplate` is the recommendation, as academic-structure work *after* this
build).

---

# 13. Admission

## 13.1 Why Admission is a spell of study, not a year

The layer that neither Applicant nor Enrollment can be. **Applicant dies at
admission and Enrollment dies at promotion**, so neither can hold *"this person
joined this branch on this date, under this quota, at this level, and left on
that date for that reason"* — which is precisely the record a Transfer
Certificate is issued against. `DECIDED`

```
Admission #1  (2026, Mumbai, REGULAR, quota: GENERAL)
   ├── Enrollment 2026-27   Std 1-A
   ├── Enrollment 2027-28   Std 2-A
   └── Enrollment 2028-29   Std 3-B
```

**There is deliberately no `academicYearId` on Admission.** It would name the
year the spell *started* while looking like the year it belongs to.

```
Applicant    branch + year        scoped
Admission    branch               scoped   ← no year
Enrollment   branch + year        scoped
```

Keeping those three different is what stops the model tangling. `DECIDED`

## 13.2 Field specification

| Field | Type | Req | Default | Immutable | Validation | Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | uuid v7 | auto | `uuid(7)` | ✅ | — | Internal identity |
| `organizationId` | String | ✅ | from the applicant's lineage | ✅ | FK | Tenant |
| `branchId` | String | ✅ | from the applicant's lineage | ✅ **the hinge of the design** | FK + `assertStudentBelongsToBranch` | Where the spell happened |
| `studentId` | String | ✅ | — | ✅ | FK; must be in the same branch | Whose spell |
| `admissionNo` | String | auto | `ADMISSION_NO` seq | ✅ | `@@unique([branchId, admissionNo])`, non-blank CHECK | Human-facing, branch-scoped |
| `admissionType` | enum | ✅ | `REGULAR` | ✅ | must be in `FIRST_ENTRY_TYPES` at `admit()` | Academic nature of entry |
| `admissionDate` | DateTime | ✅ | `now()` | ✅ | `exitDate >= admissionDate` | **The joining date** — not approval, offer, confirmation or application |
| `entryProgramId` | String | ✅ | `Applicant.programId` | ✅ | belongs to branch, active | What was entered |
| `entryAcademicUnitId` | String | ✅ | caller's input | ✅ | belongs to branch + programme | At what level |
| `quotaId` | String? | — | from the applicant | ✅ | master in scope | Reservation |
| `admissionSourceId` | String? | — | from the applicant | ✅ | master in scope | Acquisition channel |
| `status` | enum | ✅ | `ACTIVE` | ✗ (lifecycle) | `admission_one_active` partial unique | Spell lifecycle |
| `sourceApplicantId` | String? | — | the applicant | ✅ | FK `onDelete: SetNull` | **Provenance, not a dependency** |
| `previousAdmissionId` | String? | — | null | ✅ | FK; `<> id` CHECK | Readmission chain / transfer's other half |
| `exitDate` | DateTime? | — | null | write-once | paired with `exitReason` by CHECK | When the spell ended |
| `exitReason` | enum? | — | null | write-once | paired with `exitDate` by CHECK | Why — a TC is issued against it |
| `exitRemarks` | String? | — | null | — | — | Free text |
| `createdBy/updatedBy/createdAt/updatedAt/deletedAt` | — | — | — | — | — | Audit |

`IMPLEMENTED` `VERIFIED` — `prisma/modules/admissions/admission.prisma`

## 13.3 Why `branchId` cannot change

`admissionNo` is branch-scoped and fee structures are branch-scoped. An
admission cannot span branches. A transfer **closes** this spell and opens
another at the new branch — which is why `Student.branchId` can move while this
cannot: the student is somewhere new, but the history of where they studied does
not change. `DECIDED`

## 13.4 `AdmissionStatus` — and why it is not the applicant's enum

| Value | Meaning |
| :--- | :--- |
| `ACTIVE` | Currently studying under this spell |
| `ON_HOLD` | A whole year away; the seat is retained |
| `COMPLETED` | Finished the programme |
| `CANCELLED` | A student who **had actually joined** stopped being admitted |
| `TRANSFERRED_OUT` | Moved to another branch |

> `Applicant.CANCELLED` means the application ended without producing a student.
> `Admission.CANCELLED` means a student who had joined stopped being admitted —
> which triggers refunds and a transfer certificate. **Collapsing them loses a
> distinction every fee report depends on.** `DECIDED`

`AdmissionExitReason`: `GRADUATED`, `TRANSFER_OUT`, `BRANCH_TRANSFER`,
`DROPPED_OUT`, `EXPELLED`, `DECEASED`, `CANCELLED_BEFORE_JOINING`. An enum
rather than free text because a TC is issued against it and government reporting
counts it — *"dropped out"* and *"left for another branch"* are different
numbers on a return. `DECIDED`

## 13.5 No routes

There is **no controller** for Admission. No route creates, updates or lists
admissions. Creation belongs to `admit()`, branch transfer, readmission and the
migration importer; the fields that matter are immutable once written; and
reading an admission history is a Student concern that arrives with the Student
lifecycle module. `DECIDED` `VERIFIED`

Reads exist as service methods: `findById(id, scope)` (branch-scoped) and
`findByStudent(studentId, scope)` (**organization-scoped**, because a student
who transferred has admissions at two branches and a branch filter would
truncate the record a TC is written from).

---

# 14. Admission type

## 14.1 The seven values

`AdmissionType` is **core vocabulary, not configuration**: policy *around* a type
varies by institution, but what "lateral entry" means does not. `DECIDED`

| Type | New Student? | Existing Student? | New Admission | New Enrollment | Requires Applicant | Requires previous Admission | Typical scenario | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| `REGULAR` | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Std 1 intake; first-year degree | **`IMPLEMENTED`** — accepted by `admit()` |
| `LATERAL_ENTRY` | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Diploma holder entering year 2 of a degree | **`IMPLEMENTED`** — accepted by `admit()` |
| `RTE` | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Right to Education quota seat | **`IMPLEMENTED`** — accepted by `admit()` |
| `READMISSION` | ❌ | ✅ | ✅ | ✅ | configurable | ✅ **must be closed** | Dropout returns after a gap | `DEFERRED` — refused by `admit()` |
| `BRANCH_TRANSFER` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ closed as `TRANSFERRED_OUT` | Family relocates Mumbai → Pune | `DEFERRED` — refused by `admit()` |
| `TRANSFER` | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | Joining from **another institution** mid-programme | `DEFERRED` — refused by `admit()` |
| `MIGRATION` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Importing an existing student from a legacy system | `DEFERRED` — importer's, not a route's |

## 14.2 What `admit()` accepts, and why the rest are refused

```ts
const FIRST_ENTRY_TYPES = ['REGULAR', 'LATERAL_ENTRY', 'RTE'];
```

> `READMISSION` and `BRANCH_TRANSFER` are excluded because both begin from a
> Student that already exists and a previous Admission that has to be closed
> first — they are **operations in their own right**, not a value a caller may
> select here. `TRANSFER` and `MIGRATION` are likewise the importer's and the
> transfer workflow's to write.

Anything else → `400 ADMISSION_TYPE_NOT_A_FIRST_ENTRY`, listing what is allowed.
`IMPLEMENTED` `VERIFIED`

This is the right shape. A type field that *names* an operation without
*performing* it is how a readmission ends up recorded with none of readmission's
guards — no closed previous spell, no elevated permission for an expelled
student, no mandatory reason.

## 14.3 `TRANSFER` versus `BRANCH_TRANSFER`

Routinely confused:

| | `TRANSFER` | `BRANCH_TRANSFER` |
| :--- | :--- | :--- |
| Coming from | **Another institution** | **Another branch of this organization** |
| Previous Admission | None in this system | Exists; closed as `TRANSFERRED_OUT` |
| Student | New identity | **Same** Student, same `studentCode` |
| `previousAdmissionId` | null | The closed admission |
| Evidence | A TC from the other school | Internal |

---

# 15. Admission source

## 15.1 The distinction

```
AdmissionType   = the ACADEMIC NATURE of the entry      (enum, core vocabulary)
AdmissionSource = HOW the applicant CAME TO the institution  (master, configurable)
```

A `REGULAR` admission acquired through a referral is **both**, and collapsing
them loses one of the two. `DECIDED`

## 15.2 `AdmissionSource` as a master

| Property | Value |
| :--- | :--- |
| Model | `AdmissionSource` — the standard master shape |
| Scoping | Three-tier: `organizationId?` + `branchId?`, null = platform-seeded and shared |
| Columns | `code`, `name`, `description?`, `displayOrder`, `isActive`, `metadata?`, soft delete |
| Uniqueness | `@@unique([organizationId, branchId, code])` and `…, name])` |
| Recorded on | `Applicant.admissionSourceId` → copied to `Admission.admissionSourceId` |
| Validation | `assertMastersInScope` — global **or** belonging to this tenant, active, not deleted |
| **Seeded values** | **None in the repository.** The master is a container; its contents are per-deployment. |

`IMPLEMENTED` `VERIFIED` · the value set is `REQUIRES BUSINESS DECISION` (per
institution — walk-in, referral, online portal, agent, camp, sibling,
advertisement, government allotment are typical, but none is asserted here).

## 15.3 Quota — the third axis

`Quota` is a separate master with the identical shape, recording the
**reservation category the seat was granted under** (management, government,
NRI, staff, RTE, sports…). Also copied `Applicant.quotaId → Admission.quotaId`.

Three orthogonal facts, three columns:

| Column | Question |
| :--- | :--- |
| `admissionType` | What **kind** of academic entry is this? |
| `admissionSourceId` | **How did they find us?** |
| `quotaId` | **Under which reservation** was the seat granted? |

---

# 16. Student

## 16.1 What Student is

The **permanent learner identity within one organization**. Student answers *"is
this human an institutional learner here?"* where Person answers *"is this the
same human?"*. Both are needed: one human is routinely a student, a guardian and
an employee, and only Person can say they are one human. `DECIDED`

## 16.2 The placement test

> **What does this fact vary with?**
> Anything that varies with the academic year, the class, the section or the
> programme belongs to **Enrollment**. Anything that varies with the spell of
> study belongs to **Admission**. **If a field would have to be *copied* when a
> student is promoted, it is in the wrong table.**

## 16.3 What Student holds

| Group | Columns |
| :--- | :--- |
| Identity | `id`, `organizationId`, `personId` (unique), `studentCode`, `status` |
| Pointer | `branchId` — **mutable, not identity** |
| Current official demographics | `firstName`, `middleName?`, `lastName`, `displayName` (derived), `dob`, `genderId`, `religionId?`, `casteId?`, `categoryId?`, `motherTongueId?`, `bloodGroupId?`, `disabilityStatus`, `disabilityTypeId?`, `disabilityNotes?` |
| Own contact | `primaryMobile?`, `mobileNormalized?` (derived), `primaryEmail?` |
| Institutional identifiers | `apaarId?`, `abcId?`, `penNo?`, `saralId?`, `udiseStudentId?` — **plaintext by design** |
| Reference | `photoDocumentId?` — a reference, never a blob, **no FK** |
| Provenance | `createdVia`, `sourceApplicantId?`, `createdBy/updatedBy/createdAt/updatedAt`, `deletedAt` (never set) |

`IMPLEMENTED` `VERIFIED`

## 16.4 What Student deliberately does not hold

| Absent | Why |
| :--- | :--- |
| `academicYearId`, `programId`, `academicUnitId`, `rollNumber` | All vary with the year — Enrollment's |
| **`currentEnrollmentId`** | Looks harmless and is not: it needs maintaining on every promotion, correction, transfer, supersede and cancel, and **each is a chance to leave it stale while looking authoritative**. The context always carries an academic year, so current placement is a one-row indexed query. |
| `userId` | A student identity exists whether or not the learner can log in, and junior classes usually cannot |
| `aadhaarNo` | `PersonSensitive` is the single owner; a second copy is a second thing to erase |
| Any address column | Person-owned |
| Any guardian column — `fatherName`, `motherMobile`, `emergencyContact` | **Ever.** Reached through Guardianship |
| Marks, attendance, fees | Consumers reference inward; Student holds nothing of theirs |

`VERIFIED` — asserted by `pipeline.integration-spec.ts`
(*"keeps academic placement off the student"*, *"answers 'where is this student
now?' without a stored pointer"*).

## 16.5 Why Student's demographics are a separate copy

Deliberately not a reference back to Applicant. A name corrected by affidavit in
2029 **must not** silently rewrite the 2026 application form. Two facts that
happen to start equal and legitimately diverge. `StudentService.correctDemographics`
therefore **does not touch Applicant**. `DECIDED` `VERIFIED`

## 16.6 `branchId` is a pointer, not identity

It exists so a branch-scoped list does not need a join through Admission. A
branch transfer moves it; the immutable truth of where a spell of study happened
lives on `Admission.branchId`, which never changes.

`[id, branchId]` is **deliberately never declared unique**: a composite foreign
key on a mutable column would break every child row the moment a student
transfers. `DECIDED` `VERIFIED`

## 16.7 Creation — controlled, never routed

**There is no `create` on any Student route.** A Student is born from `admit()`
or the migration importer, both of which call `createControlled` directly. An
ordinary create endpoint would let staff mint identities with nothing behind
them, which is how a student list acquires rows nobody can explain. `DECIDED`
`VERIFIED`

`createControlled` guards:

| Guard | Error |
| :--- | :--- |
| Plausible DOB (`> 1900-01-01`, `<= today`) — service **and** CHECK | `400 STUDENT_DOB_INVALID` |
| `createdVia = ADMISSION` ⇒ `sourceApplicantId` present — service **and** `student_origin_check` | `400 STUDENT_SOURCE_APPLICANT_REQUIRED` |
| One Student per Person per org | `409 STUDENT_ALREADY_EXISTS` |
| One Student per Applicant (`student_one_per_applicant` partial unique) | `409 APPLICANT_ALREADY_ADMITTED` |
| `studentCode` collision (should be unreachable) | `409 STUDENT_CODE_ALREADY_EXISTS` + **logged as a sequence misconfiguration** |

## 16.8 Correction

`PATCH /students/:id` → `correctDemographics`. **Not a general update.** The
input type lists exactly what may change, so `studentCode`, `personId`,
`organizationId`, `sourceApplicantId` and `status` are **unreachable** — the
first four are identity and status moves only through a lifecycle engine that
does not exist yet. `IMPLEMENTED` `VERIFIED`

- Archived students are read-only → `409 STUDENT_ARCHIVED`.
- Derived columns (`displayName`, `mobileNormalized`) follow their sources
  rather than being separately settable, so they cannot drift.
- The write **re-asserts scope in its own `WHERE`** via `updateMany` and asserts
  `count === 1` — a read-then-write-by-id is only as safe as the read.
- The event carries **field-level diffs** (`{ field, oldValue, newValue }`),
  because *"the record changed"* is not an audit trail when the question is who
  changed a date of birth and from what.

## 16.9 Search

One free-text term interpreted **by shape** rather than by asking the caller
which field they meant — staff type a code, a name or a phone number into one
box and expect it to work. Ranking is deterministic, so a second page is a
continuation rather than a reshuffle. Branch is the default boundary;
`organizationWide` widens it and requires `student.view.organization`. Archived
students remain searchable **but only when asked for** — archival is a write
lock, not a disappearance. `IMPLEMENTED` `VERIFIED`

---

# 17. Student UUID

| Property | Value | Status |
| :--- | :--- | :--- |
| Type | UUID **v7**, `@default(uuid(7))` | `DECIDED` `VERIFIED` |
| Mutability | Immutable, forever | `DECIDED` |
| Role | **The** relational identity. Every downstream module references it. | `DECIDED` |
| Exposed in API? | **Yes** — `/students/:studentId` and in every response body | `DECIDED` |
| Valid FK target | ✅ the preferred one | `DECIDED` |
| Scope of uniqueness | Global (UUID) | — |
| Generated by | The database default, **never** the numbering engine | `VERIFIED` |

## 17.1 Why v7

Time-ordered, so index locality on insert is sequential rather than random —
which matters at the volume `Enrollment` and `Attendance` will reach — while
remaining a UUID everywhere else.

## 17.2 The security consideration, stated honestly

UUID v7 **embeds a creation timestamp**. Two consequences:

1. **Guessability.** v7 is guessable *in principle*. The mitigation is not
   secrecy but scope: every read is
   `findFirst({ id, organizationId, …branchScope })` and a miss is `404`, so
   guessing a valid UUID outside the caller's scope yields nothing.
2. **Information leak.** Anyone holding a `studentId` can read off approximately
   when the record was created.

`RECOMMENDED` — the exposure boundary in blueprint §38.6, restated:

| Consumer | Sees UUIDs? |
| :--- | :--- |
| Staff web client | **Yes** — a trusted first-party consumer that needs a stable handle |
| **Parent / student portal** | **No** — those endpoints resolve the subject from the authenticated principal and never accept a `studentId` in a path. That is the shape BOLA takes in a portal. |
| **Third-party integrations** | **No** — the exported identifier is `studentCode`, resolved through `/students/lookup` |

`DEFERRED` — no portal and no integration surface exists yet.

---

# 18. Student code

## 18.1 The format, as implemented

```
studentCode  =  {prefix}{sequence padded to width}

default      STU + 10 digits           →  STU0000000123
purpose      STUDENT_CODE
scope        ORGANIZATION
reset        NEVER
mode         MONOTONIC          (gaps permitted, by design)
uniqueness   @@unique([organizationId, studentCode])
storage      PERSISTED, never recomputed
shape guard  /^[A-Z0-9][A-Z0-9\-\/]{0,31}$/
db guard     student_code_nonblank_check
```

`IMPLEMENTED` `VERIFIED` — the prefix and width are **configuration at
provisioning**, frozen after the first allocation.

## 18.2 Why nothing volatile is encoded

> **The disqualifying test: does the identifier encode something that can become
> false?**

| Rejected format | Encodes | Becomes false when |
| :--- | :--- | :--- |
| `STU-2026-000123` | Admission year | The student reaches 2031 — and worse, it *looks* like a year field, so reports, filters and humans will use it as one |
| `BR01-STU-000123` | Branch | A Mumbai → Pune transfer, which the design explicitly requires the code to survive |
| `ORG01-BR01-2026-000123` | Both plus the organization | All of the above, and unreadable aloud |

`STU0000000123` encodes nothing that can become false. `DECIDED`

## 18.3 Why organization-scoped rather than global

**A global sequence leaks tenant volume.** If Organization A's codes run
`…0410`–`…0455` in a week and the next allocation is `…0892`, A has learned that
other tenants issued ~437 codes that week. Sequence gaps are a side channel, and
complete tenant isolation is a frozen commitment. A global counter would also
serialise student creation across every customer on the platform. Nothing in the
stated reasons for a global code — branch transfer, central reporting, parent
portal, certificates, alumni — operates outside a single organization.
`DECIDED` `VERIFIED` — the pipeline test asserts a second organization's
sequence **starts again from one**.

## 18.4 Why fixed width, and why it freezes

Fixed width is what makes `ORDER BY studentCode` equal `ORDER BY sequence`,
which every export, CSV and printed register depends on. Changing the width
mid-life produces `STU0000000999` followed by `STU00000001000` — different
lengths, which breaks lexicographic sort, fixed-width ID-card and certificate
layouts, and any downstream pattern match.

> **Rule.** For any config with `resetStrategy = NEVER`, `prefix` and
> `sequencePadding` are **immutable after the first allocation**.
> `400 SEQUENCE_WIDTH_IMMUTABLE`. `IMPLEMENTED` `VERIFIED`

Ten digits will never roll over.

## 18.5 Permanence

| Event | Code changes? |
| :--- | :--- |
| Academic year rollover | ❌ |
| Promotion / detention / repeat | ❌ |
| Section, class or unit change | ❌ |
| Programme change (Science → Commerce) | ❌ |
| **Branch transfer** | ❌ — the Student row survives; only `branchId` and the Admission change |
| Graduation, withdrawal, expulsion, archival | ❌ |
| Readmission after a break | ❌ — same Student, new Admission |
| **Numbering format change** | ❌ — **the value is persisted, never recomputed** |

`DECIDED` `VERIFIED`

**The one genuine exception** is an *organization transfer*, which produces a
**new** Student with a **new** code in the target organization. That is not a
code change — the original Student and its code remain unaltered in the source.

## 18.6 Correction — break-glass, narrow by design

A code assigned from a misconfigured sequence (wrong prefix on day one) may be
corrected **once**, by `SUPER_ADMIN`, through a dedicated audited operation
publishing `student.code_corrected` with both values, and **only** while the
student has zero issued certificates and zero printed receipts. Outside that
window the answer is no.

`RECOMMENDED` · **not implemented** — neither the operation nor the
`student.code.correct` permission nor the `student.code_corrected` event exists.
`VERIFIED`

## 18.7 `studentCode` is never a foreign key

- **No table declares a foreign key to `Student.studentCode`.** `VERIFIED` by
  test — *"is never used as a foreign key by anything downstream"*.
- No module stores a `studentCode` column to mean "which student". Modules store
  `studentId`.
- It may be **displayed, searched, exported, printed, imported and quoted**.
  Import resolves it to a `studentId` **at the boundary** and never carries it
  inward.

> The reason is not purity. It is that `studentCode` is the **one identifier
> with a correction path**, and a correctable value must never be the thing
> other rows point at. `DECIDED`

## 18.8 Gaps

A rollback burns the number. `MONOTONIC` commits the increment on its own
connection, so `admit()` never holds the counter lock. **A collision is fatal; a
hole is cosmetic** — nobody audits student codes for continuity. Receipts,
invoices and TCs are `GAPLESS` precisely because someone does.
`VERIFIED` by test — *"survives a rollback without ever being reissued"*.

## 18.9 Lookup

`GET /students/lookup?code=STU0000000123` — **a query parameter, not a path
segment**, because a code is a search term rather than a resource address.
Case-insensitive: a code read off a printed card and typed in lower case must
find the same row. Normalisation is upper-case with whitespace stripped, matching
how the engine renders it. Exact lookup uses the unique constraint; prefix and
`ILIKE` search use a trigram GIN index. `IMPLEMENTED` `VERIFIED`

---

# 19. Enrollment

## 19.1 What Enrollment is

**One academic-year placement.** The spine attendance, examination, fees and the
timetable will hang off, and the reason none of them has to know what an
admission is. It answers exactly one question: *where is this learner placed,
for this year?* `DECIDED`

> Twelve years of school is **one Person, one Student, one Admission and twelve
> thin Enrollment rows** — with **zero** demographic fields copied into any of
> them. If a change ever seems to need a name or a date of birth here, the
> design has broken.

## 19.2 Its own module, not part of admissions

Admissions is a three-month intake funnel; this is a twelve-year concern.
Promotion, examination and corrections all write enrolments and none of them is
an admission. The dependency runs **one way**:

```
enrollment → identity            ✅
enrollment → academic structure  ✅
enrollment → admissions          ❌ NEVER
```

The schema holds an `admissionId`; **the TypeScript module holds no import of
admissions**. `IMPLEMENTED` `VERIFIED`

## 19.3 Field specification

| Field | Type | Req | Immutable | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid v7 | auto | ✅ | Internal identity |
| `organizationId` | String | ✅ | ✅ | Tenant |
| `branchId` | String | ✅ | ✅ | Branch |
| `academicYearId` | String | ✅ | ✅ | **The year this placement is for.** Denormalizes `AcademicUnit.academicYearId`, kept honest by the composite FK |
| `admissionId` | String | ✅ | ✅ | The spell this year belongs to |
| `studentId` | String | ✅ | ✅ | **Denormalized on purpose** — every downstream module needs "this student's rows" without a three-table join |
| `programId` | String | ✅ | ✅ | Placement, this year only |
| `academicUnitId` | String | ✅ | ✅ | Placement, this year only |
| `rollNumber` | String? | — | **✗ the one mutable field** | Position in a class register |
| `enrollmentKind` | enum | ✅ `PRIMARY` | ✅ | `PRIMARY` / `SECONDARY` / `EXCHANGE` |
| `enrollmentStatus` | enum | ✅ `PENDING`→ set `ACTIVE` | ✗ (lifecycle) | Placement life |
| `isRepeat` | Boolean | ✅ `false` | ✅ | Same unit as last year |
| `resultOutcome` | enum? | — | — | **Examination owns the decision; Enrollment owns only the column.** Nothing in the module writes it and no route can. |
| `originType` | enum | ✅ | ✅ | **Why this row exists** |
| `previousEnrollmentId` | String? | — | ✅ | Provenance, forward-readable |
| `supersededById` | String? **@unique** | — | write-once | Provenance, backward-readable |
| `changeReason` | String? | conditional | — | Mandatory for supersede / correction / transfer |
| `applicantId` | String? | — | ✅ | **Provenance only.** Nullable, non-unique, `onDelete: Restrict` |
| `exitDate` / `exitReason` | DateTime? / enum? | conditional | — | Paired by CHECK for `CANCELLED` and `DROPPED_OUT` |
| `version` | Int | ✅ `1` | — | **Optimistic lock** |
| audit columns | — | — | — | `createdBy/updatedBy/createdAt/updatedAt/deletedAt` |

`IMPLEMENTED` `VERIFIED`

## 19.4 The three composite foreign keys

Not validation — **impossibility**. Each turns a rule a service could forget
into something Postgres cannot store:

| FK | Guarantees |
| :--- | :--- |
| `(admissionId, studentId, branchId) → Admission(id, studentId, branchId)` | This enrolment's student **is** its admission's student, and its branch **is** its admission's branch |
| `(academicUnitId, branchId, programId, academicYearId) → AcademicUnit(id, branchId, programId, academicYearId)` | The unit belongs to this branch, this programme **and** this year |
| `(programId, branchId) → Program(id, branchId)` | The programme belongs to this branch |

Service checks still run so the caller gets a **named** error; the database is
what makes the combination impossible. `IMPLEMENTED` `VERIFIED`

## 19.5 Two deliberate deviations, recorded rather than hidden

**1. The two self-referencing FKs are `DEFERRABLE INITIALLY DEFERRED`.** With
immediate checking there is **no order that works**:

```
insert replacement, then close original
   → enrollment_one_primary_per_year counts the original while it is still live
     and rejects the replacement — the very index that makes correction necessary

close original, then insert replacement
   → enrollment_supersede_check demands a successor the moment the status
     becomes SUPERSEDED, and the self-FK rejects an id that does not exist yet
```

Deferring resolves it: within the transaction the pair is momentarily
incomplete; at COMMIT both ends must exist. Prisma does not model deferrability,
and it introduces no drift. **Only the self-references defer**; every other FK
stays immediate. `IMPLEMENTED` `VERIFIED`

**2. There is no class-list lock column anywhere in the schema**, and Phase 4
did not invent one — a second lock competing with `AcademicYear.isLocked` is
exactly the conflicting model to avoid. Until F2 provides a per-class-list lock,
`EnrollmentConfigProvider.classListLocked()` derives it from the year, which is
**coarser than the eventual rule and never weaker**. `VERIFIED` · `DEFERRED` (F2)

## 19.6 No create route, no delete route, no update

| Absent | Why |
| :--- | :--- |
| `POST /enrollments` | Every placement has an **origin operation** behind it. A bare create is a placement with no origin, which is how a class list acquires students nobody can account for. |
| `DELETE /enrollments/:id` | Academic history is **cancelled or superseded**, never removed |
| `PATCH /enrollments/:id` (general) | Placement is immutable. A generic PATCH would erase the correction/transfer distinction one field at a time. |
| `PATCH …{ status }` | Every edge belongs to a named operation |

`createInitialEnrollment` is reachable **only from code**, takes an optional
transaction client and opens none of its own when given one — which is what lets
`admit()` write Student, Admission and Enrollment atomically. `DECIDED` `VERIFIED`

## 19.7 `EnrollmentStatus`

| Status | Meaning | Open? |
| :--- | :--- | :--- |
| `PENDING` | Created, not yet in effect | ✅ |
| `ACTIVE` | The current placement | ✅ |
| `ON_BREAK` | Paused for the year; the seat is retained | ✅ |
| `PROMOTED` | Finished the year and moved up | historical |
| `DETAINED` | Finished the year and repeats it | historical |
| `COMPLETED` | Finished a terminal year | historical |
| `TRANSFERRED` | Placement moved elsewhere (**branch** transfer) | historical |
| `DROPPED_OUT` | Left mid-year | historical |
| `CANCELLED` | Voided | historical |
| `SUPERSEDED` | Replaced by a corrected row, which it names | historical |

**Deliberately without `SUSPENDED`.** Suspension is a property of the *human*,
not of the placement: a suspended student still occupies their seat in 9-A, and
duplicating the state here would leave two aggregates disagreeing about the same
fact. A whole year away is `ON_BREAK` on the enrolment plus `ON_HOLD` on the
admission. `DECIDED`

**No path leads back from any terminal state.** A mistake can only ever be put
right by a row that leaves both versions visible. `VERIFIED`

## 19.8 `EnrollmentOriginType` — recorded, never inferred

`ADMISSION` · `PROMOTION` · `REPEAT` · `CORRECTION` · `TRANSFER` ·
`READMISSION` · `MIGRATION`

> Timestamps cannot tell a **correction** from a genuine mid-year **move**, and
> that is exactly the question asked when a registrar is challenged about a
> student appearing in two classes. `DECIDED`

Reachable today: `ADMISSION` (via `admit()`), `CORRECTION` and `TRANSFER` (via
supersede). The rest await Phase 6. `VERIFIED`

## 19.9 `resultOutcome` — owning the column is not owning the decision

`PASS` / `FAIL` / `WITHHELD`. Three values, not a grading vocabulary: `PASS`
leads to `PROMOTED` or `COMPLETED`, `FAIL` to `DETAINED`, `WITHHELD` to neither
yet. A richer result vocabulary belongs to Examination's own tables.

**Nothing in the Enrollment module writes it and there is no route that can.**
The one place it is read is `assertNoRecordedResult`, which refuses to cancel a
placement a student has already been examined for — cancelling it would leave
marks pointing at a placement that officially never happened. `DECIDED` `VERIFIED`

---

# 20. Academic placement

## 20.1 Placement is immutable; correction is supersession

```
BEFORE                         AFTER a correction
Enrollment A                   Enrollment A   status: SUPERSEDED
  status: ACTIVE                              supersededById: B
  unit: Std 1-A                               changeReason: "wrong section"
                               Enrollment B   status: ACTIVE
                                              previousEnrollmentId: A
                                              originType: CORRECTION
                                              unit: Std 1-B
```

Both rows persist and the chain reads **from either end** without either row
being rewritten. `IMPLEMENTED` `VERIFIED`

## 20.2 The supersede primitive — one, with four callers

Correction and mid-year transfer use it today; promotion and repeat will in
Phase 6. Writing the fourth one separately is how provenance gets forgotten by
whoever writes it, so there is only ever **one place** that knows how to link an
old row to a new one. `DECIDED`

```
supersedeEnrollment:
  1. require a non-blank reason               → 400 CHANGE_REASON_REQUIRED
  2. assert enrollment.correct permission     → 403
  3. LOCK the old row FIRST  (scoped)         → 404 if out of scope
  4. assert the academic year is open (FOR SHARE) → 403 ACADEMIC_YEAR_LOCKED
  5. optimistic version check (if stated)     → 409 STALE_ENROLLMENT_VERSION
  6. assert the row is still open             → 409 ENROLLMENT_CLOSED
  7. assert the closing status is a legal edge→ 400 INVALID_TRANSITION
  8. carry over anything not named            (a section change cannot move the programme)
  9. refuse a no-op                           → 400 PLACEMENT_UNCHANGED
 10. generate the replacement's id in code
 11. CLOSE the original naming its successor
 12. INSERT the replacement
 13. two WorkflowHistory rows
 14. enrollment.created + enrollment.superseded to the outbox
```

**The order is not negotiable.** The old row is locked **first**, before any
decision and before the replacement is built: creating the replacement and then
discovering the original was already superseded leaves an orphan row that
satisfies every constraint and means nothing. With the lock first, the loser of
a race re-reads under `READ COMMITTED`, sees `SUPERSEDED`, and fails **having
written nothing**. `IMPLEMENTED` `VERIFIED`

**Scope, admission and student are copied from the row being replaced, never
from the request context.** A correction can change where a student sits; it can
never move them to another branch, another year or another spell of study.
There is no input that could. `VERIFIED`

## 20.3 Correction versus transfer — and why the closing status is the same

| | `correctPlacement` | `transferPlacement` |
| :--- | :--- | :--- |
| Meaning | The student was **never** in the old class | A **real** mid-year move within the branch |
| `originType` | `CORRECTION` | `TRANSFER` |
| Closing status | `SUPERSEDED` | `SUPERSEDED` |
| Roll number | carried over | may be reassigned |
| Permission | `enrollment.correct` | `enrollment.correct` |

The closing status is deliberately **not** `TRANSFERRED` for a same-branch move.
`TRANSFERRED` is reserved for a **branch** transfer, whose replacement sits under
a different Admission — and it is deliberately **not excluded** from
`enrollment_one_primary_per_year`, so using it here would leave the old row
counting as live and make the replacement unwritable. `VERIFIED`

**Cross-branch cannot be reached from here.** The replacement's branch is copied
from the row being replaced.

## 20.4 Cancellation

Never a delete. A cancelled enrolment stays visible with its date and its
reason, because *"this student was placed here and it was undone"* is a fact
somebody will need, and a missing row cannot express it. Guarded by
`assertNoRecordedResult`. `IMPLEMENTED` `VERIFIED`

## 20.5 The current-placement probe

```ts
findCurrent(studentId, academicYearId, scope)
  → PRIMARY, status IN (ACTIVE, ON_BREAK), not deleted
```

**At most one row can come back** — `enrollment_one_primary_per_year` guarantees
it. This is the reason Student carries no `currentEnrollmentId`, and it is the
hottest query in the system; `@@index([studentId, academicYearId, enrollmentStatus])`
serves it. `IMPLEMENTED` `VERIFIED`

## 20.6 Read scoping — one deliberate asymmetry

| Read | Scope | Why |
| :--- | :--- | :--- |
| `findById` | organization **+ branch** | Ordinary resource read |
| `search` | organization **+ branch** | Class register, branch headcount |
| `findByAdmission` | organization | An admission is branch-bound anyway |
| **`findByStudent`** | **organization only** | A student who transferred between branches has history in both, and a branch filter would **silently truncate the record a transfer certificate is written from** |

`VERIFIED`

---

# 21. Roll number

## 21.1 What it is, and what it is not

> A **position in one class register for one academic year.** Globally it means
> nothing: Std 10-A and Std 10-B both have a Roll 1.

| Property | Value |
| :--- | :--- |
| Owner | **Enrollment** — not Student, not the numbering engine |
| Scope of uniqueness | `(academicUnitId, academicYearId, rollNumber)` excluding `SUPERSEDED` and `CANCELLED` |
| Mutable | ✅ **until the class list locks** |
| Regenerated | ✅ under `ALPHABETICAL_ON_LOCK` |
| Foreign key target | ❌ never |
| Allocated by numbering? | ❌ **never** — it is a position in a list, not a sequence |
| Human-facing | ✅ |
| In an API path | ❌ |
| Nullable | ✅ — a student may be placed before the register is drawn up |
| Blank | ❌ — `enrollment_rollno_nonblank_check`; send `null` to clear |

`IMPLEMENTED` `VERIFIED`

## 21.2 Separated from every other identifier

```
Student  STU0000000123        ← never changes
  2025-26  Std 9-A   roll 17
  2026-27  Std 10-A  roll 23  ← different, and that is correct
```

| Identifier | Scope | Lifetime | Changes? |
| :--- | :--- | :--- | :--- |
| `studentCode` | Organization | Forever | ❌ |
| `admissionNo` | Branch (yearly reset) | Life of the spell | ❌ |
| `applicationNo` | Branch + year | Life of the application | ❌ |
| `admissionFormNo` | Branch + year | Life of the application | ❌ |
| **`rollNumber`** | **Unit + year** | **One year** | **✅ until lock** |
| Exam seat number | Exam + centre | One exam | *(Examination's — not modelled)* |
| Library number | Organization | Membership | *(Library's — not modelled)* |

## 21.3 Assignment today

`PATCH /enrollments/:enrollmentId/roll-number` · `enrollment.rollnumber.manage`
· `STAFF`+ (the widest write permission in the module, deliberately — assigning
a roll number reshuffles a printed list; correcting a placement rewrites where a
child is recorded as studying).

```
lock the enrollment (scoped)
  → read the year's lock state under FOR SHARE
  → classListLocked(...) ?         → 403 CLASS_LIST_LOCKED
  → optimistic version check       → 409 STALE_ENROLLMENT_VERSION
  → placement still open?          → 409 ENROLLMENT_CLOSED
  → set (or clear with null), version += 1
  → enrollment.roll_number_changed to the outbox, carrying from → to
```

**It does not supersede the row.** The student is in the same class before and
after. `IMPLEMENTED` `VERIFIED`

`admit()` deliberately leaves it **unset**: *"the roll number is a class-register
position and the default policy is manual. Inventing one at admission would
produce a number nobody can explain."* `VERIFIED`

## 21.4 The three policies

| Policy | Behaviour | Concurrency | Status |
| :--- | :--- | :--- | :--- |
| **`MANUAL`** | A clerk types it. The engine assigns nothing. | Two clerks typing "17" — the second gets `409 ROLL_NUMBER_TAKEN` from `enrollment_rollno_unique`. **No lock needed**; the index is the arbiter. | **`IMPLEMENTED`** — the default |
| **`SEQUENTIAL_ON_ADMISSION`** | Next free position in the class as students arrive. | `MAX(rollNumber) + 1` is a **read-then-write race**: two concurrent admissions both read 16 and both write 17; one loses on the unique index and the operation fails rather than retrying. Needs either a lock on the `AcademicUnit` row for the duration, or a bounded retry loop on the unique violation. **`REQUIRES R&D`** — and note that under `MONOTONIC` semantics a rollback would leave a hole in a *class register*, which is exactly where a hole is visible and questioned. | `PROPOSED` |
| **`ALPHABETICAL_ON_LOCK`** | Numbers are left null (or provisional) during intake, then the whole class list is **regenerated alphabetically in one transaction** when it settles. Common Indian practice. | **The correct shape**: one transaction per class list, ordering by `Student.displayName`, clearing then reassigning. Clearing first avoids transient collisions within the batch. Concurrent single assignment during the run blocks on the row locks and then fails the class-list-lock check. | `PROPOSED` |

**Roll numbers change under `ALPHABETICAL_ON_LOCK`** — that is the point of it,
and it is precisely why a roll number must never be a foreign key or an
identity.

> **DISCREPANCY — the default policy**
> **DOCUMENTED** — blueprint §50 Q7 recommends *"configurable per branch,
> defaulting to `ALPHABETICAL_ON_LOCK`"*.
> **IMPLEMENTED** — `EnrollmentConfigProvider.rollNumberPolicy()` returns
> **`MANUAL`**, with the reasoning stated in the code: *"a number the system
> chose is a number nobody can explain to the parent who asks why their child is
> Roll 34."*
> **VERIFIED** — `enrollment-config.provider.ts`.
> **RECOMMENDED** — **keep `MANUAL` as the default.** An institution that has
> not chosen should get manual assignment rather than a number invented on its
> behalf, and neither alternative is implemented, so a default naming one would
> be a promise the code does not keep. Revisit when F2 lands and the two
> generators are built. `REQUIRES BUSINESS DECISION` per institution.

## 21.5 The lock

| Question | Answer |
| :--- | :--- |
| What locks the class list today? | `AcademicYear.isLocked`, read under `FOR SHARE` inside the transaction |
| Is that the intended rule? | No — the eventual rule is a **per-class-list** lock from F2 |
| Is the interim rule safe? | **Yes.** Coarser, never weaker: a year closed for results is not a year whose registers are still being reshuffled |
| Why not add a column now? | A second lock competing with `AcademicYear.isLocked` is the conflicting model this design exists to avoid |

`IMPLEMENTED` `VERIFIED` · `DEFERRED` (F2)

## 21.6 What happens to a roll number

| Event | Roll number |
| :--- | :--- |
| **Promotion** | **New one** in the new class. The old row keeps its own, forever. |
| **Repeat** | New one in the same class for the new year — the old row's is retained |
| **Correction** | Carried over unless explicitly changed |
| **Mid-year transfer** | May be reassigned; the old row keeps the old one |
| **Branch transfer** | New one in the new class; the old row keeps the old one |
| **Withdrawal** | Frozen on the closed row. **Not** freed for reuse within the year — the partial unique index still counts `DROPPED_OUT` rows, so the position stays occupied. |
| **Cancellation / supersession** | **Released** — both statuses are excluded from the unique index, which is what makes correction possible at all |
| **Readmission** | New enrolment, new roll number |

`VERIFIED` from the index definition. The withdrawal case is a deliberate
consequence worth stating: a mid-year dropout's roll number is not reissued, and
a register with a gap at 17 is the honest representation.

---

# 22. Capacity

## 22.1 The current answer: there is none

**`AcademicUnit` has no capacity column. Nothing anywhere in the schema does.**
A repository-wide search for `capacity` returns nothing in `prisma/modules/` or
`src/modules/`. `VERIFIED`

`admit()` therefore performs **no capacity check**, and this is stated
explicitly rather than assumed: blueprint §31.1 lists it as step 9,
*"~~Seat capacity~~ — **Not performed.** No seat matrix exists."* `DECIDED`

> A fake check is worse than a stated absence. A check against a column that
> does not exist would have to invent a number, and an invented capacity is a
> constraint nobody agreed to that will refuse a real child at a counter.

## 22.2 Where capacity should live

`RECOMMENDED` — ownership analysis, not an implementation.

| Candidate owner | Verdict | Reasoning |
| :--- | :--- | :--- |
| `Program` | ❌ | A programme spans years and units. "Std 1 holds 40" is meaningless without saying *which section, which year*. |
| `AcademicYear` | ❌ | A year is a calendar, not a container |
| **`AcademicUnit`** | ✅ **for physical seats** | Capacity is a **fact about the unit** — Std 1-A has 40 desks. By the boundary test (*a fact about the thing is a column; a rule about behaviour is configuration*) it is a **column**, not configuration. |
| Section | — | A section *is* an `AcademicUnit`; there is no separate model |
| **Seat matrix** | ✅ **for quota-wise allocation** | Its own module. `(academicUnitId × quotaId × categoryId) → allocated, filled` is a different shape from a single integer and should not be squeezed into one. |
| Admission configuration | ❌ for the number; ✅ for the **policy** | *Whether* over-admission is permitted, and who may override, are rules about behaviour |

**The recommended increments, in order:**

1. `AcademicUnit.maxCapacity Int?` and `minCapacity Int?` — nullable, so an
   institution that does not track seats is unaffected. A **soft warning** at
   `admit()` first, a hard refusal only once an institution asks for it.
2. Configuration: `admissions.capacity.enforcement` =
   `OFF | WARN | BLOCK` (default `OFF`), and `admissions.capacity.overridePermission`.
3. A seat-matrix module, if and when quota-wise allocation is required. **Not
   before** — a full matrix built speculatively will not match the first
   institution that needs one.

`REQUIRES BUSINESS DECISION` — blueprint §50 Q3 is open.

## 22.3 The concurrency question: capacity 40, current 39, two requests

**This is the question that determines the shape.** With `maxCapacity` as a
plain column and a naive check:

```
T1: SELECT count(*) … WHERE academicUnitId = X   → 39
T2: SELECT count(*) … WHERE academicUnitId = X   → 39      ← neither sees the other
T1: 39 < 40  ✓  INSERT enrollment                → 40
T2: 39 < 40  ✓  INSERT enrollment                → 41      ← OVER CAPACITY
```

Both commit. **Read-then-write without a lock is not a capacity check.** Under
`READ COMMITTED` neither transaction can see the other's uncommitted insert, so
no amount of care in the query fixes it.

Four options, assessed:

| Option | Mechanism | Correct? | Cost | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **A. Count under a unit row lock** | `SELECT … FROM "AcademicUnit" WHERE id = X FOR UPDATE` **first**, then count, then insert | ✅ | Serialises admissions **into one section**, not the branch. A section admits perhaps 40 students over weeks — contention is negligible. | ✅ **RECOMMENDED** |
| **B. Materialised counter with a guarded decrement** | `UPDATE "AcademicUnit" SET filled = filled + 1 WHERE id = X AND filled < "maxCapacity" RETURNING *`; zero rows ⇒ full | ✅ — the check and the increment are **one atomic statement** | A denormalized counter that must be corrected on every cancel, supersede and transfer, and can drift | ⚠️ Only if counting proves slow, which it will not at these volumes |
| **C. `SERIALIZABLE` isolation** | Let Postgres detect the anomaly | ✅ | Retries on the whole `admit()` transaction; the rest of the system is designed around `READ COMMITTED` | ❌ Disproportionate |
| **D. Advisory lock** | `pg_advisory_xact_lock(hashtext(unitId))` | ✅ | Same effect as A without a real row to lock | ⚠️ A is clearer when the row exists |

**Recommended shape**, inside `admit()`'s existing transaction, immediately
after the applicant lock and before the Student insert:

```
if capacity enforcement is ON for this scope:
    lock the AcademicUnit row FOR UPDATE          ← must precede the count
    count live PRIMARY enrolments for (unit, year)
       excluding SUPERSEDED and CANCELLED         ← the same exclusion the index uses
    if count >= maxCapacity:
         WARN  → attach a warning to the response, proceed
         BLOCK → 409 CAPACITY_EXCEEDED { academicUnitId, capacity, current }
                 …unless the caller holds the override permission,
                 in which case a MANDATORY reason is recorded and
                 enrollment.capacity_overridden is published at severity WARN
```

**Lock ordering matters.** `admit()` already locks `Applicant` first. Adding
`AcademicUnit` **second** and consistently is what keeps the deadlock-free
ordering the rest of the system observes: always lock in the same sequence, and
never lock a parent after a child.

## 22.4 Related capacity concepts, unowned

| Concept | Status |
| :--- | :--- |
| Minimum capacity (viability threshold for running a section) | `PROPOSED` — a reporting concern, not a write-path guard |
| Seat reservation during deferment | `REQUIRES BUSINESS DECISION` — I2 §10 Q2. If the seat is held the branch runs a place short for a year; if released, deferment is worthless. Recommendation on file: configurable, defaulting to held with an expiry. |
| Waitlist release when an offer expires | `PROPOSED` — `applicant.offer_expired` exists precisely as the trigger; nothing consumes it |
| Quota-wise seat allocation | `DEFERRED` — its own module |
| Over-admission override | `PROPOSED` — needs a permission and a mandatory reason |

---

# 23. Admission conversion

## 23.1 The contract

`POST /v1/admissions/applicants/:applicantId/admit`

> The only place a learner identity is born from an application, and the one
> operation where a partial result would be unrecoverable by hand.

**The caller supplies the academic unit and nothing else that matters.**
Everything else comes from the applicant's own lineage: the organization, the
branch, the academic year, the programme, the quota and the admission source.

| Input | Required | Why it is (or is not) an input |
| :--- | :--- | :--- |
| `academicUnitId` | ✅ | **Nothing earlier records a section.** An applicant applies to "Std 1"; which section they join is the decision being made now. |
| `admissionType` | — (`REGULAR`) | The academic nature of the entry; restricted to first-entry types |
| `admissionDate` | — (`now`) | A back-dated entry states its own |
| `remarks` | — | Recorded on the workflow history row |
| ~~`programId`~~ | **absent** | It was offered and confirmed earlier and is **not the caller's to change at this moment** |
| ~~`organizationId`, `branchId`, `academicYearId`~~ | **absent** | From the applicant's lineage |
| ~~`studentId`, `studentCode`, `personId`, `admissionId`, `enrollmentId`~~ | **absent** | Server-owned, minted inside the transaction |
| ~~status~~ | **absent** | The engine owns it |

Every one of those absences is deliberate: a field here is a field the global
`ValidationPipe` would accept from a client. `IMPLEMENTED` `VERIFIED`

## 23.2 An orchestrator that writes nothing itself

`AdmissionConversionService` composes five services on **one** transaction
client. Each opens its own transaction when called alone and **joins this one**
when given `tx` — and there is a test asserting exactly that for all of them,
because *a service that silently ignored the client it was passed is the single
most common way an "atomic" operation turns out not to be*. `VERIFIED`

## 23.3 Before the transaction — validation that must not hold locks

Read-only and cheap to repeat. Every statement here would otherwise extend the
lock hold on the applicant row.

| # | Check | Failure |
| :--- | :--- | :--- |
| 1 | Actor holds **both** `admissions.approve` **and** `student.create` | `403` |
| 2 | `admissionType ∈ {REGULAR, LATERAL_ENTRY, RTE}` | `400 ADMISSION_TYPE_NOT_A_FIRST_ENTRY` |
| 3 | Applicant exists **within org + branch**, not soft-deleted | `404` (never `403`) |
| 4 | Applicant is `SEAT_CONFIRMED` | `409 APPLICANT_NOT_SEAT_CONFIRMED` / `409 APPLICANT_ALREADY_ADMITTED` |
| 5 | `Applicant.programId` present | `400 PROGRAM_REQUIRED` |
| 6 | Academic unit exists, not deleted | `404 ACADEMIC_UNIT_NOT_FOUND` |
| 7 | Unit's branch, year **and programme** match the applicant's | `400 ACADEMIC_UNIT_MISMATCH` |
| 8 | Unit is active | `400 ACADEMIC_UNIT_INACTIVE` |
| 9 | Academic year exists and belongs to the branch | `404` |
| 10 | Academic year is **not locked** | `403 ACADEMIC_YEAR_LOCKED` |
| 11 | `STUDENT_CODE` and `ADMISSION_NO` sequences are provisioned | `400 NUMBERING_NOT_PROVISIONED` |
| 12 | ~~Document checklist~~ | **Not performed** — S3 does not exist |
| 13 | ~~Seat capacity~~ | **Not performed** — no capacity exists (§22) |

`IMPLEMENTED` `VERIFIED`

The applicant is loaded with an explicit `select` of exactly the columns the
conversion needs. **Guardians, documents and preferences are deliberately not
read** — they are not part of this operation, and loading them would put an
unbounded graph in front of a transaction that is about to take a lock.

## 23.4 Inside the transaction

`prisma.$transaction`, `READ COMMITTED`, **15 s timeout**.

| # | Step | Why it is inside |
| :--- | :--- | :--- |
| 1 | `SELECT … FROM "Applicant" WHERE id AND organizationId AND branchId FOR UPDATE`, reading `admissionStatus`, `deletedAt`, `personId` | **Serialises concurrent admits on one applicant.** Prisma has no row-lock API; this is `$queryRaw` behind `RowLockService`. |
| 2 | Re-assert `SEAT_CONFIRMED` **under the lock** | The pre-read was a guess — a competing admit, a cancellation or the expiry sweep may have committed in between |
| 3 | `personId = locked.personId ?? PersonService.resolve(…, tx)` | **Reuses the applicant's own Person.** Resolution runs only for rows predating the identity index |
| 4 | Refuse if a Student already exists for `(organizationId, personId)` | `409 STUDENT_ALREADY_EXISTS` — this is readmission, a separate operation |
| 5 | `StudentService.createControlled(…, tx)` — allocates `STUDENT_CODE` | Identity |
| 6 | `AdmissionService.createControlled(…, tx)` — allocates `ADMISSION_NO` | Spell of study |
| 7 | `EnrollmentService.createInitialEnrollment(…, tx)` — `originType: ADMISSION`, roll number left unset | Placement |
| 8 | `WorkflowService.transition(ADMIT, …, tx, { orchestrated: true })` — **last** | The status and the three rows behind it commit together or not at all |

`IMPLEMENTED` `VERIFIED`

**Step 3 is the Phase 5.5 fix and deserves its own note.** Submission places the
applicant in the identity index; `admit()` used to ask again. For an applicant
*with* a government identifier the second answer matched, which is why every
earlier test passed — the fixtures all supplied one. For an applicant *without*
one, resolution deliberately never merges on demographics (twins share every
signal), so it minted a **second Person**: the Applicant pointed at the first and
the Student at the second, and `@@unique([organizationId, personId])` was being
enforced against a row nothing else referenced. `VERIFIED` — and the government
identifier now travels through the Person abstraction rather than being read,
logged or copied in admissions at all.

## 23.5 What commits, and what is enqueued

| Written | Count |
| :--- | :--- |
| `Student` | 1 |
| `Admission` | 1 |
| `Enrollment` | 1 |
| `Applicant` update (status + `updatedBy`) | 1 |
| `WorkflowHistory` (`APPLICANT`) | 1 — **and no Admission or Enrollment row; see §7.8** |
| `OutboxEvent` | 4 — `student.created`, `student.code_assigned`, `admission.created`, `applicant.admitted` |
| Committed **outside** by the numbering engine | 2 `MONOTONIC` increments |

> `enrollment.created` **is** enqueued by `createInitialEnrollment`, giving
> **five** outbox rows in total. `VERIFIED`

## 23.6 Failure

**Anything at all rolls the whole thing back** and leaves the applicant
`SEAT_CONFIRMED` with no student, no admission, no enrolment, no history row and
no outbox row. A `MONOTONIC` number may be burned — a gap, acceptable by
definition. **Verified by injecting a failure at each of the six steps and after
the last one.** `VERIFIED`

| Failure point | Outcome |
| :--- | :--- |
| Pre-transaction validation | Nothing written. Retry is safe. |
| Anywhere inside | Everything rolls back. A number may be burned. |
| After commit, before the relay publishes | **The events are safe** — they are committed rows. The relay publishes on its next pass. |
| Relay publishes twice | Consumers deduplicate; `AuditLog.eventId` is unique |
| A consumer throws | Isolated per subscriber; the transaction already committed |

## 23.7 Concurrency

**Twenty simultaneous requests for one applicant produce one student, one
admission, one enrolment, one code and nineteen conflicts naming what exists.**
`VERIFIED`

Three mechanisms, in layers:

| Layer | Catches |
| :--- | :--- |
| `SELECT … FOR UPDATE` on the Applicant | The normal case — two registrars clicking Admit |
| `student_one_per_applicant` (partial unique on `sourceApplicantId`) | A second admit that somehow got past the lock |
| `@@unique([organizationId, personId])` | **The same child seat-confirmed at two branches and admitted at once** — the government identifier resolves both to one Person, so the second admission is refused rather than splitting the record |
| `admission_one_active` (partial unique on `studentId`) | A second live spell |
| `enrollment_one_primary_per_year` | A second live placement |

The loser gets an **informative** `409` naming the `studentId` and `studentCode`
that now exist, so a client can treat the conflict as the completed operation it
is. There is no idempotency-key table: the state guard, the row lock and the
unique constraints give the client everything it needs without new
infrastructure. `DECIDED`

## 23.8 The readmission boundary — the one deliberate deviation

```
DOCUMENTED   Blueprint §31.1 step 5b: "If one exists: reuse it. Assert it is not
             EXPELLED/ARCHIVED without the elevated permission. This is the
             readmission path."

IMPLEMENTED  An existing Student produces 409 STUDENT_ALREADY_EXISTS naming the
             studentId, studentCode and status, and the application is left
             untouched.

VERIFIED     admission-conversion.service.ts:assertNoExistingStudent

RECOMMENDED  Keep it. Reusing the Student and opening a second Admission *is*
             readmission, and readmission closes the previous spell, needs an
             elevated permission for an expelled student, and records a
             mandatory reason. Shipping a partial version of it under another
             name would be worse than refusing. This is the Phase 6 entry point.
```

## 23.9 Errors, complete

| Condition | Status | Code | Details |
| :--- | :--- | :--- | :--- |
| Not authenticated | 403 | `ForbiddenException` | — |
| Missing `admissions.approve` or `student.create` | 403 | `ForbiddenException` | — |
| Type is not a first entry | 400 | `ADMISSION_TYPE_NOT_A_FIRST_ENTRY` | `allowed[]` |
| Applicant absent or out of scope | 404 | `NotFoundException` | — |
| Not `SEAT_CONFIRMED` | 409 | `APPLICANT_NOT_SEAT_CONFIRMED` | `currentStatus` |
| Already admitted | 409 | `APPLICANT_ALREADY_ADMITTED` | `studentId`, `studentCode` |
| Person is already a student | 409 | `STUDENT_ALREADY_EXISTS` | `studentId`, `studentCode`, `studentStatus` |
| No programme on the application | 400 | `PROGRAM_REQUIRED` | — |
| Unit not found | 404 | `ACADEMIC_UNIT_NOT_FOUND` | — |
| Unit mismatch | 400 | `ACADEMIC_UNIT_MISMATCH` | — |
| Unit inactive | 400 | `ACADEMIC_UNIT_INACTIVE` | — |
| Year locked | 403 | `ACADEMIC_YEAR_LOCKED` | `academicYearId` |
| Sequences not provisioned | 400 | `NUMBERING_NOT_PROVISIONED` | `missing[]` |
| Active admission exists | 409 | `ACTIVE_ADMISSION_EXISTS` | `studentId` |
| Placement exists for the year | 409 | `ENROLLMENT_EXISTS_FOR_YEAR` | — |

`IMPLEMENTED` `VERIFIED`

> Two small divergences from the documented contract, both cosmetic and both
> `RECOMMENDED` for alignment: (a) `APPLICANT_ALREADY_ADMITTED` is documented to
> carry `admissionId` and `enrollmentId` as well, and carries only the student
> pair; (b) `NUMBERING_NOT_PROVISIONED` is documented as `500` and the
> **pre-flight** raises `400` while the **in-transaction** path raises `500`.
> The pre-flight is the one a caller normally meets; `400` is arguably the
> better answer, so align the document rather than the code — but make the two
> paths agree.

---

# 24. Promotion

`DEFERRED` — Phase 6. Shape asserted by test; no operation exists. `VERIFIED`

**Promotion never mutates Student and never mutates the historical Enrollment.**
It writes **one new Enrollment row** through the same supersede primitive.

```
Enrollment 2025-26  Std 9   status: PROMOTED     ← closed, never edited
                                    │ previousEnrollmentId
                                    ▼
Enrollment 2026-27  Std 10  status: ACTIVE
                            originType: PROMOTION
```

Same `studentId`. Same `admissionId`. Same `studentCode`. **New `rollNumber`.**

| Variant | Old row | New row | Note |
| :--- | :--- | :--- | :--- |
| Promotion | `PROMOTED` | Next unit, `originType: PROMOTION` | The normal case |
| Conditional promotion | `PROMOTED` | Next unit + a flag carried by **Examination** | Enrollment records the placement, not the condition |
| Failed promotion | unchanged | none | The student stays where they are until a decision is made |
| Terminal year | `COMPLETED` | none | Student → `GRADUATED`, Admission → `COMPLETED` |
| Promotion reversal | new row → `SUPERSEDED` | Restores the prior placement, `originType: CORRECTION`, reason mandatory | **Not a delete.** Both rows stay visible. |

## 24.1 Bulk promotion

Year-end promotion is the **largest write the system performs** — a branch may
promote two thousand students at once. Treating it as a synchronous HTTP request
is wrong. `RECOMMENDED`:

| Requirement | Specification |
| :--- | :--- |
| Execution | A job with an id, progress and a partial-failure report. `POST /enrollments/bulk-promote` → `202` + `jobId` |
| **Atomicity** | **Per student, not per job.** A run failing at 1,400 must not leave 1,399 promoted with no record — the job record *is* the record |
| Resumability | Store the last processed `studentId`; a resume skips anyone who already has a target-year enrolment, which `enrollment_one_primary_per_year` makes detectable |
| Idempotency | Re-running is safe: an existing `PRIMARY` in the target year is **skipped**, not duplicated. The partial index is the backstop. |
| Events | **One** `enrollment.bulk_promoted` carrying job id and counts — **not two thousand**. Individual `enrollment.created` rows still go to the outbox for downstream state; audit records the batch. |
| Locking | A row lock per source enrolment. A concurrent editor blocks briefly, then sees `409 STALE_ENROLLMENT_VERSION`. |
| Year lock | **Both** source and target years checked |
| Concurrency limit | One job per `(branchId, targetAcademicYearId)`, enforced by a partial unique index on the job table |

**There is no bulk undo.** Reversal is the per-student correction, run over the
affected list, each writing a supersede pair with a reason — because a bulk undo
that deletes rows would destroy the evidence that the promotion happened, and it
may already have been reported to a board.

---

# 25. Repeat

`DEFERRED` — Phase 6. `EnrollmentOriginType.REPEAT`, `EnrollmentStatus.DETAINED`
and `Enrollment.isRepeat` all exist and nothing writes them. `VERIFIED`

```
Enrollment 2025-26  Std 9   status: DETAINED     isRepeat: false
                                    │
                                    ▼
Enrollment 2026-27  Std 9   status: ACTIVE       isRepeat: true
                            originType: REPEAT   ← SAME unit
```

**Two Enrollments on Std 9, one Admission, one Student, one `studentCode`.**

| Question | Answer |
| :--- | :--- |
| Same academic unit? | Yes — that is what distinguishes repeat from promotion |
| New Admission? | **No.** Repeating a year does not end a spell of study |
| `isRepeat` | `true` on the **new** row |
| Roll number | New, in the new year's register |
| Why not overwrite the old row? | Two years of attendance and two independent result sets both need somewhere to attach. A student who repeats Std 9 has **two** enrollments and two result sets — impossible to model on `studentId` alone. |
| Constraint interaction | The two rows differ in `academicYearId`, so `enrollment_one_primary_per_year` is satisfied without any exclusion |

The current `supersedeEnrollment` **hard-codes `isRepeat: false`** on every
replacement, which is correct for correction and transfer and will need a
parameter when repeat is built. `VERIFIED` · `RECOMMENDED` — extend the
primitive rather than writing a second one.

---

# 26. Transfer

Three different things share the word. Keeping them apart is the point.

| | **Section transfer** | **Branch transfer** | **External transfer** |
| :--- | :--- | :--- | :--- |
| Meaning | Mid-year move within one branch | Move to another branch of this organization | Arriving from another institution |
| Operation | `POST /enrollments/:id/transfer` | `POST /students/:id/branch-transfer` | `admit()` with `admissionType: TRANSFER` |
| Student | unchanged | unchanged | **new** |
| `studentCode` | unchanged | **unchanged** | new |
| Admission | unchanged | **#1 closed, #2 opened** | new |
| `admissionNo` | unchanged | **new, from the target branch** | new |
| Enrollment | superseded | old `TRANSFERRED`, new created | created |
| `originType` | `TRANSFER` | `TRANSFER` under Admission #2 | `ADMISSION` |
| Permission | `enrollment.correct` | `student.transfer` (**does not exist**) | `admissions.approve` + `student.create` |
| Status | **`IMPLEMENTED`** | `DEFERRED` | `DEFERRED` |

## 26.1 Section transfer — implemented

Superseding within the same branch, year and admission. Cross-branch is
**unreachable**: the replacement's branch is copied from the row being replaced.
`VERIFIED`

## 26.2 Branch transfer — the twelve steps

`DEFERRED` · `RECOMMENDED` shape, unchanged from blueprint §20.2:

```
POST /v1/students/:studentId/branch-transfer   ORG_ADMIN+   reason mandatory
                                               ONE transaction

 1  lock the Student row FOR UPDATE                    prevents two concurrent transfers
 2  assert exactly one ACTIVE Admission                admission_one_active
 3  assert the target branch is in the same org AND the actor is authorised for it
 4  assert the target academic year is not locked
 5  close Admission #1 — TRANSFERRED_OUT,
       exitReason: BRANCH_TRANSFER, exitDate = effective date
 6  close the current Enrollment — TRANSFERRED, exitDate
       (the historical row is CLOSED, never rewritten)
 7  allocate a NEW branch-scoped ADMISSION_NO from the target branch
 8  open Admission #2 — admissionType: BRANCH_TRANSFER, previousAdmissionId: #1
 9  create the new Enrollment under Admission #2, originType: TRANSFER, reason mandatory
10  update Student.branchId                            the POINTER moves
11  three WorkflowHistory rows (Admission ×2, Enrollment)
12  outbox: admission.closed, admission.created, enrollment.created,
            student.branch_transferred
```

**Why it is an Admission operation and not an Enrollment one.** `admissionNo` is
branch-scoped and fee structures are branch-scoped. If a transfer merely moved
the Enrollment, the Admission would point at a branch where the student no
longer is, and every Transfer Certificate, admission register and branch
headcount would be wrong.

## 26.3 What survives a branch transfer

| | Changes | Stays |
| :--- | :--- | :--- |
| `studentId`, **`studentCode`**, `personId` | | ✅ |
| `Student.branchId` | ✅ moves | |
| Admission | ✅ #1 closed, #2 opened | #1's `branchId` and `admissionNo` never touched |
| Enrollment | ✅ old closed, new created | Old row readable forever |
| `rollNumber` | ✅ new one | Old retained on the closed row |
| **Guardianships** | | ✅ **untouched** — *once* Person↔Person and org-scoped (§8) |
| Addresses | | ✅ untouched — Person-owned (*once* S2 exists) |
| Documents | | Person-owned stay; admission-owned stay with Admission #1 |
| Academic history | | ✅ every past Enrollment intact and attributable to its branch |

## 26.4 The three consequences

1. **Programme identity does not survive.** `Program` is branch-scoped, so the
   new Enrollment references a *different* `programId` for what a parent would
   call the same programme. Cross-branch reports must group by name/medium/stream.
2. **Master data must resolve above the branch.** A transferred student's
   `categoryId` must point at a row visible in the new branch — seed
   government-defined masters at SYSTEM or ORGANIZATION level, never per branch.
3. **Open workflows block.** A transfer with an outstanding fee balance, an
   in-flight document verification or an unissued certificate needs a pre-flight
   check. Phase 1 of the operation should **block and report the blockers**
   rather than transferring and leaving orphans.

## 26.5 Organization transfer — not a workflow

**This is tenant data migration.** `Person`, `studentCode` and the entire
academic structure are organization-scoped. It produces a **new Student with a
new code** in the target organization; the source's Student and history remain
unaltered. `DECIDED` · `DEFERRED`

---

# 27. Readmission

`DEFERRED` — Phase 6, and the explicit entry point. `VERIFIED`

**Existing Student + new Admission. Never a new Student.**

```
Student STU0000000123                      ← unchanged throughout
  Admission #1  2024  Std 8   status: CANCELLED  exitReason: DROPPED_OUT
       └─ Enrollment 2024-25  DROPPED_OUT
                                                    ← two-year gap
  Admission #2  2026  Std 9   admissionType: READMISSION
                              previousAdmissionId: #1
       └─ Enrollment 2026-27  originType: READMISSION
```

`studentId`, `studentCode` and `personId` unchanged. The new Admission gets a
**new** branch-scoped `admissionNo`.

## 27.1 How the existing Student is found

This is the failure mode readmission usually has. `ApplicantService.checkDuplicates`
searches only **Applicants**, branch-scoped — so a returning dropout, who is a
**Student**, is invisible to it and a second identity would be created silently.

With Person: `resolve()` matches on `govtIdHash` and returns the existing
Person; the conversion then finds the existing Student through
`@@unique([organizationId, personId])`. **The mechanism that prevents the
duplicate is the same one that enables readmission.** `VERIFIED` — this is
exactly what `assertNoExistingStudent` detects today, and it refuses instead of
proceeding.

> `checkDuplicates` remains routed at `POST /admissions/applicants/check-duplicates`
> and is documented (I2 §7) as **replaced** by `PersonService.findCandidates()`.
> `RECOMMENDED` — retire it, or reimplement it over Person, so a returning
> dropout is visible at registration and not only at admission.

## 27.2 Guards

| Guard | Rule |
| :--- | :--- |
| No overlapping admission | The previous Admission must be `COMPLETED`, `CANCELLED` or `TRANSFERRED_OUT`. **`admission_one_active` enforces it at the database.** |
| Student not `EXPELLED` | Requires `ORG_ADMIN`+ and a **mandatory reason** |
| Student not `ARCHIVED` | Un-archive first, as an explicit audited operation |
| Entry level is **chosen, not derived** | The registrar states which unit the student re-enters. Deriving it from the last enrolment is wrong after a two-year gap. |

## 27.3 Does readmission need a fresh application?

**Configuration, not code** — institutions genuinely differ. `DECIDED` (shape) ·
`REQUIRES BUSINESS DECISION` (per institution) · `DEFERRED` (F2)

| Key | Values | Effect |
| :--- | :--- | :--- |
| `admission.readmission.requiresApplication` | `ALWAYS` \| `NEVER` \| `AFTER_GAP_YEARS` | Whether a new `Applicant` must exist |
| `admission.readmission.gapYearsThreshold` | Int, default `1` | Used when the above is `AFTER_GAP_YEARS` |

| Mode | Flow |
| :--- | :--- |
| Fresh application | A new `Applicant` runs the normal machine; the conversion detects the existing Student and opens Admission #2 |
| Direct | `POST /students/:id/readmit` skips the applicant. `Admission.sourceApplicantId` is null; `Student.createdVia` is **unchanged** — it records how the *identity* was born, not how this spell started |

Both paths converge on the same shape. **The conversion transaction is written
once, with the Student-creation step conditional** on whether a Student already
exists — not two code paths that drift.

---

# 28. Student lifecycle

`DEFERRED` — Phase 6. `StudentStatus` exists with six values; **nothing writes
anything but the `ACTIVE` default.** `VERIFIED`

```
                    ┌──────────────────────────────┐
                    │          [ACTIVE]            │
                    └───┬──────┬──────┬──────┬─────┘
          suspend ──────┘      │      │      └────── expel
              ▼                │      │                 ▼
        [SUSPENDED] ──reinstate┘      │           [EXPELLED] ✦
              │                       │                 │
              └─ withdraw ──┐   graduate                │
                            ▼         ▼                 │
                     [WITHDRAWN] ✦  [GRADUATED] ✦       │
                            └─────────┴─────────────────┘
                                      │  retention period elapses
                                      ▼
                                 [ARCHIVED]
                                      │
                          readmit (§27) — via a NEW Admission,
                          Student returns to [ACTIVE]

✦ terminal for the current SPELL OF STUDY — not for the IDENTITY
```

| Status | Meaning | Enrollments | Searchable | Who sets it |
| :--- | :--- | :--- | :--- | :--- |
| `ACTIVE` | Currently a student | May have a current one | ✅ | `admit()`, readmission |
| `SUSPENDED` | Temporarily barred, **still enrolled** | Stay `ACTIVE` | ✅ | `BRANCH_ADMIN`+, reason required |
| `WITHDRAWN` | Left before completing | Closed | ✅ | `BRANCH_ADMIN`+, reason required |
| `GRADUATED` | Completed the terminal programme | `COMPLETED` | ✅ | `BRANCH_ADMIN`+ |
| `EXPELLED` | Removed for cause | Closed | ✅ | `ORG_ADMIN`+, reason required |
| `ARCHIVED` | Read-only after retention | Frozen | ✅ **remains searchable and reportable** | Scheduled job or `ORG_ADMIN` |

## 28.1 The six rules

1. **There is no hard-delete path.** No service method, no endpoint, no
   `DELETE /students/:id`. `deletedAt` exists for schema consistency and is
   **never set by any Student code path**. `VERIFIED`
2. **`ARCHIVED` is read-only but not hidden.** Archival is a **write lock**, not
   a disappearance. Archived students appear in search, historical reports and
   alumni queries, and it is reversible by a privileged audited correction.
3. **Archival never moves rows to a shadow table.** A flag in place, in the same
   table — shadow-table archival breaks every foreign key and every report.
4. **Status changes only through the lifecycle service.** No `PATCH` accepts a
   `status` field. Each transition is a named operation with its own permission,
   its own required reason and its own event. `VERIFIED` — unreachable today.
5. **Suspension is a Student status, not an Enrollment status.** A suspended
   student still occupies a seat, still owes fees, still appears on the register.
6. **The identity survives every terminal status.** `WITHDRAWN` and `GRADUATED`
   are terminal for the *spell of study*. A readmitted student is the same
   Student with a new Admission, and `studentCode` is unchanged.

## 28.2 What each operation touches

| Operation | Student | Admission | Enrollment | `studentCode` | `rollNumber` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Promotion | — | — | old `PROMOTED`, new row | — | new |
| Repeat | — | — | old `DETAINED`, new row (same unit) | — | new |
| Correction | — | — | old `SUPERSEDED`, new row | — | carried |
| Section transfer | — | — | old `SUPERSEDED`, new row | — | may change |
| Branch transfer | `branchId` moves | #1 `TRANSFERRED_OUT`, #2 opened | old `TRANSFERRED`, new row | **unchanged** | new |
| Readmission | status → `ACTIVE` | #2 opened, `previousAdmissionId` | new row | **unchanged** | new |
| Withdrawal | → `WITHDRAWN` | → `CANCELLED` + exit pair | → `DROPPED_OUT` + exit pair | **unchanged** | frozen |
| Suspension | → `SUSPENDED` | — | **stays `ACTIVE`** | **unchanged** | unchanged |
| Completion / graduation | → `GRADUATED` | → `COMPLETED` + `GRADUATED` | → `COMPLETED` | **unchanged** | frozen |
| Expulsion | → `EXPELLED` | → `CANCELLED` + `EXPELLED` | closed | **unchanged** | frozen |
| Archive | → `ARCHIVED` | frozen | frozen | **unchanged** | frozen |
| Erasure (DPDP) | row survives, ciphertext nulled | untouched | untouched | **unchanged** | unchanged |

## 28.3 Retention versus erasure

Two separable things, and conflating them is a legal problem — the DPDP Act 2023
grants a right to erasure and imposes heightened obligations on children's data,
which is the entire user base.

| | Retained | Erasable |
| :--- | :--- | :--- |
| **The academic record** — enrollments, results, receipts, certificates | ✅ statutory, often 7+ years | ❌ |
| **Personal data** — Aadhaar, photographs, health notes, contact details | | ✅ **crypto-erasure** |

Erasure nulls sensitive ciphertext. It does **not** delete the Student row, does
not delete enrollments, and **does not break a single foreign key**. `Person` is
never deleted at all — historical records point at it, and a Person whose
sensitive data has been erased **still deduplicates**, which is what stops an
erased subject re-enrolling as a stranger. `DECIDED` · the operation is
`DEFERRED`.

---

# 29. ID survival matrix

| Identifier | Created | Owner | Lifetime | Changes? | Used by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`personId`** | At applicant **SUBMIT** (or first guardian/employee resolution) | Identity › Person | **Forever.** Never deleted, even after erasure | ❌ — except a merge tombstone redirects to a survivor | `Applicant.personId`, `Student.personId`, `Guardianship` (both ends, *once built*), `PersonAddress` (*once built*), documents owned by `PERSON` |
| **`applicantId`** | At applicant registration (`DRAFT`) | Admissions › Applicant | Until terminal, then **retained forever as evidence** | ❌ | `Student.sourceApplicantId`, `Admission.sourceApplicantId`, `Enrollment.applicantId` (**`Restrict`** — an application a career descends from is not deletable), `ApplicantGuardianMapping`, `WorkflowHistory` |
| **`applicationNo`** | At registration, `APPLICATION` seq (branch + year, `MONOTONIC`) | Numbering allocates · Applicant owns | Life of the application | ❌ | Human reference, lookup, correspondence. **Never an FK** |
| **`admissionFormNo`** | At registration, `ADMISSION_FORM` seq (branch + year) | Numbering · Applicant | Life of the application | ❌ | The physical form. **Never an FK** |
| **`studentId`** | At `admit()` | Identity › Student | **Forever** | ❌ | **The preferred FK target.** Admission, Enrollment, and every future module holding a person-scoped fact |
| **`studentCode`** | At `admit()`, `STUDENT_CODE` seq (org, `NEVER` reset, `MONOTONIC`) | Numbering allocates · Student owns | **Forever** | ❌ — one audited `SUPER_ADMIN` break-glass correction before any certificate (*not built*) | Display, search, export, print, import, ID cards, integrations. **NEVER an FK** |
| **`admissionId`** | At `admit()` / transfer / readmission | Admissions › Admission | Entry → exit, then retained | ❌ | `Enrollment.admissionId` (composite), TC, admission register, character certificate |
| **`admissionNo`** | At `admit()`, `ADMISSION_NO` seq (**branch**, `YEARLY` reset, `MONOTONIC`) | Numbering · Admission | Life of the admission | ❌ | Human reference. A transfer or readmission yields a **second** one. **Never an FK** |
| **`enrollmentId`** | At `admit()` / promotion / repeat / correction / transfer / readmission | Enrollment | **One academic year** | ❌ — a change **supersedes**, producing a new id | Attendance, examination, year-scoped fees, timetable, marksheet, bonafide |
| **`rollNumber`** | Assigned manually after placement; **null at `admit()`** | Enrollment | **One year** | ✅ **until the class list locks**; regenerated wholesale under `ALPHABETICAL_ON_LOCK` | Class register, display. **Never an FK, never identity** |
| **guardian `personId`** | At guardian resolution *(target model)* | Identity › Person | **Forever** | ❌ | `Guardianship.guardianPersonId`, parent portal, fee dunning, emergency contact |
| `guardianId` *(as implemented)* | At guardian creation | Admissions › Guardian | Until soft-deleted | ❌ | `ApplicantGuardianMapping` **only** — **does not survive conversion** |
| `personSensitiveId` | With the first government identifier | Identity | Forever; the value is erasable, the row is not | ❌ | Internal only |
| `outboxEvent.eventId` | At enqueue | Infrastructure | Until pruned | ❌ | `AuditLog.eventId` (unique — deduplicates at-least-once delivery) |

## 29.1 Which id survives the conversion

```
BEFORE admit()                       AFTER admit()
─────────────────────────────────    ─────────────────────────────────────────
personId          019f…a1            personId       019f…a1   ← SAME
applicantId       019f…b2            applicantId    019f…b2   ← SAME, retained
applicationNo     APP-2026-00042     applicationNo  unchanged
admissionFormNo   FRM-2026-00042     admissionFormNo unchanged
—                                    studentId      019f…c3   ← NEW
—                                    studentCode    STU0000000123  ← NEW
—                                    admissionId    019f…d4   ← NEW
—                                    admissionNo    AD-2026-00007  ← NEW
—                                    enrollmentId   019f…e5   ← NEW
—                                    rollNumber     null      ← NOT ASSIGNED
guardianId        019f…f6            guardianId     019f…f6   ← survives as a ROW,
                                                                 STRANDED on the applicant
address           inline on Applicant  address      unchanged; the Student has none
documents         —                    documents    —
```

`VERIFIED` — the two shaded rows are the §8 and §10 gaps.

---

# 30. Field ownership matrix

## 30.1 The authoritative matrix

| Business fact | Owner | Never duplicate into | Status |
| :--- | :--- | :--- | :--- |
| Human identity ("same human?") | **Person** | Student, Applicant, Guardian | `IMPLEMENTED` |
| Government identifier (Aadhaar) | **PersonSensitive** | Student, Admission, Enrollment | `IMPLEMENTED` for Student/Admission/Enrollment · **violated by `Applicant.aadhaarNo` and `Guardian.aadhaarNo`** |
| Blind-index matching keys | **Person** | anywhere | `IMPLEMENTED` |
| Application declaration (as filed) | **Applicant** | Student | `IMPLEMENTED` |
| Declared address (as filed) | **Applicant** | Student, Person | `IMPLEMENTED` |
| Previous education | **Applicant** | Student | `IMPLEMENTED` |
| Programme applied for | **Applicant** | Admission (which records what was *entered*) | `IMPLEMENTED` |
| Preference ranking | **ApplicantProgramPreference** | Applicant, Admission | `IMPLEMENTED` |
| Application workflow state | **Applicant** (writable only by the engine) | Student, Admission | `IMPLEMENTED` |
| Permanent learner identifier | **Student** | Enrollment, Admission | `IMPLEMENTED` |
| Current official demographics | **Student** | Enrollment, Admission | `IMPLEMENTED` |
| Student's own contact | **Student** | Enrollment | `IMPLEMENTED` |
| Institutional identifiers (APAAR/ABC/PEN/Saral/UDISE) | **Student** | Enrollment, Admission | `IMPLEMENTED` |
| Learner standing (`ACTIVE`…`ARCHIVED`) | **Student** | Enrollment | `IMPLEMENTED` (column) · lifecycle `DEFERRED` |
| **Study spell** (entry, exit, quota, entry level) | **Admission** | Student, Enrollment | `IMPLEMENTED` |
| Human reference for a spell | **Admission.admissionNo** | Student | `IMPLEMENTED` |
| **Academic placement** (year, programme, unit) | **Enrollment** | Student, Admission | `IMPLEMENTED` |
| Class-register position | **Enrollment.rollNumber** | Student, Admission | `IMPLEMENTED` |
| Placement provenance | **Enrollment** (`originType`, `previousEnrollmentId`, `supersededById`, `changeReason`) | anywhere | `IMPLEMENTED` |
| Year result outcome | **Examination** decides · Enrollment stores the column | Student, Admission | `IMPLEMENTED` (column) · producer `DEFERRED` |
| **Guardian relationship** | **Guardianship** (Person↔Person) | Student, Applicant | ❌ **owned by `ApplicantGuardianMapping` today** |
| Guardian's role facts (occupation, income) | **Guardian** | Person, Student | `IMPLEMENTED` |
| Guardian's identity | **Person** | Guardian | ❌ **`Guardian` holds its own names and Aadhaar** |
| Guardian's address | **Person / PersonAddress** | Guardian, Student | ❌ **inline on `Guardian`** |
| **Residence address** | **Person / PersonAddress** | Student, Guardian | `DEFERRED` (S2) |
| Address history | **PersonAddress** (append-only) | Address | `DEFERRED` (S2) |
| The place itself | **Address** (immutable value object) | anywhere | `DEFERRED` (S2) |
| Identity documents | **Document** `ownerType: PERSON` | Student, Applicant | `DEFERRED` (S3) |
| Application evidence | **Document** `ownerType: APPLICANT` | Student | `DEFERRED` (S3) |
| Transfer / character certificate | **Document** `ownerType: ADMISSION` | Student | `DEFERRED` (S3) |
| Marksheet, bonafide | **Document** `ownerType: ENROLLMENT` | Student | `DEFERRED` (S3) |
| Health record | **Document** `ownerType: STUDENT` | Person | `DEFERRED` (S3) |
| Document requirement rules | **DocumentRequirement** | Applicant, workflow code | `DEFERRED` (S3) |
| Marks | **Examination** | Student, Enrollment (beyond `resultOutcome`) | `DEFERRED` |
| Attendance | **Attendance + Enrollment** | Student | `DEFERRED` |
| Fee liability | **Fees**, keyed on `enrollmentId` | Student, Enrollment | `DEFERRED` |
| Fee ledger / receipts | **Fees**, keyed on `studentId` | Enrollment | `DEFERRED` |
| Login credentials | **Auth**, via `UserIdentityLink` | Student, Person | `DEFERRED` |
| Business identifier sequences | **NumberSequenceConfig / Counter** | every consuming module | `IMPLEMENTED` |
| Institutional policy | **F2 config** (interim: two `*ConfigProvider`s) | entity columns, `process.env`, call sites | interim `IMPLEMENTED` |
| Seat capacity | **AcademicUnit** (proposed) | Program, AcademicYear, Enrollment | `PROPOSED` |

## 30.2 The four tests that generalise it

> 1. **What does this fact vary with?** The year → Enrollment. The spell →
>    Admission. The human, forever → Student or Person.
> 2. **Would it have to be copied on promotion?** Then it is in the wrong table.
> 3. **Is it a fact about the thing, or a rule about behaviour?** A fact is a
>    column; a rule is configuration.
> 4. **What does this document prove?** That is its owner.

## 30.3 Duplications that are correct, and why

Not every copy is a defect. Three are deliberate:

| Copy | Why it is right |
| :--- | :--- |
| `Applicant` demographics **and** `Student` demographics | Two different facts: *what was declared on a date* and *the institution's current official record*. They start equal and legitimately diverge. |
| `Enrollment.studentId` alongside `Enrollment.admissionId` | Denormalized so downstream modules get "this student's rows" without a three-table join — and **kept honest by the composite foreign key**, so it cannot be wrong |
| `Enrollment.academicYearId` alongside `academicUnitId` | Same: denormalized for indexing, guaranteed consistent by the four-column composite FK |

The distinguishing property is that both denormalizations are **impossible to
get wrong**. A denormalization the database cannot police is a defect; one it
can is an index.

---

# 31. Complete field dictionary

Every column of the six core models, with its owner and its rule. Derived from
`prisma/modules/**` and the service layer. `VERIFIED`

Legend — **W**: who may write it. `sys` = server-derived, no client path ·
`eng` = the workflow/lifecycle engine only · `svc` = a named service operation ·
`api` = accepted from a request DTO · `db` = database default.

## 31.1 `Person`

| Field | Type | Null | W | Rule |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid7 | no | db | Immutable |
| `organizationId` | String | no | sys | Immutable. Person never spans tenants |
| `govtIdHash` | String | **yes** | svc | `@@unique([organizationId, govtIdHash])`. Set once via `resolve` or `attachGovernmentId`; changing it is a separate audited operation |
| `phoneHash` | String | yes | svc | Weak signal, not unique |
| `dob` | DateTime | no | svc | Required — a nullable one degrades every match |
| `nameNormalized` | String | no | svc | Never rendered |
| `mergedIntoPersonId` | String | yes | svc | Tombstone; nothing writes it yet |
| `createdAt` / `updatedAt` | DateTime | no | db | |

**No `deletedAt`.** **No display name, contact, photo or address — ever.**

## 31.2 `PersonSensitive`

| Field | Type | Null | W | Rule |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid7 | no | db | |
| `personId` | String | no | svc | `@unique`, `onDelete: Cascade` |
| `organizationId` | String | no | sys | Scopes the DEK |
| `idType` | enum | no | svc | `AADHAAR` only in v1 |
| `aadhaarEnc` | Bytes | **yes** | svc | AES-256-GCM. **Nullable because crypto-erasure nulls it in place** |
| `aadhaarLast4` | String | yes | svc | Display without decrypting |
| `keyVersion` | Int | no | svc | Which DEK generation produced the ciphertext |
| `erasedAt` / `erasedBy` | — | yes | svc | The row remains so the erasure itself is evidence |

## 31.3 `Applicant` — 60 columns

| Field | Type | Null | W | Rule |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid7 | no | db | |
| `organizationId`, `branchId`, `academicYearId` | String | no | sys | From the execution context at creation. Immutable |
| `admissionFormNo` | String | no | sys | `ADMISSION_FORM` seq; `@@unique([branchId, academicYearId, …])` |
| `applicationNo` | String | no | sys | `APPLICATION` seq; `@@unique([branchId, academicYearId, …])` |
| `firstName` | String | no | api | Non-empty |
| `middleName` | String | yes | api | |
| `lastName` | String | no | api | Non-empty |
| `displayName` | String | no | sys | Derived on write |
| `dob` | DateTime | no | api | ISO date |
| `genderId` | String | no | api | Master must exist |
| `birthPlace` | String | yes | api | |
| `photoFileId` | String | yes | api | **Dangling — no target table** |
| `religionId`, `casteId`, `categoryId`, `motherTongueId`, `bloodGroupId`, `disabilityTypeId` | String | yes | api | Each validated as an existing non-deleted master |
| `disabilityStatus` | Boolean | no | api | Default `false` |
| `disabilityNotes` | String | yes | api | |
| `aadhaarNo` | String | yes | api | `/^\d{12}$/`. **Should live on `PersonSensitive`** |
| `penNo`, `apaarId` | String | yes | api | Plaintext by design; copied to Student |
| `primaryMobile` | String | **no** | api | `/^[+0-9\s-]{7,15}$/`. Feeds `Person.phoneHash` |
| `alternateMobile` | String | yes | api | Same pattern |
| `primaryEmail` | String | yes | api | `@IsEmail` |
| `currentAddressLine1` | String | no | api | **Frozen snapshot** |
| `currentAddressLine2` | String | yes | api | |
| `city`, `state`, `country` | String | no | api | |
| `district` | String | yes | api | |
| `pincode` | String | no | api | `/^[a-zA-Z0-9\s-]{3,10}$/` — deliberately permissive for non-Indian addresses |
| `previousSchoolName`, `previousBoard`, `previousClass`, `tcNumber` | String | yes | api | Snapshot; not copied to Student |
| `previousPercentage` | Float | yes | api | **Not range-validated** — see §32 |
| `personId` | String | **yes** | eng | Bound at `SUBMIT`. `applicant_person_from_submitted_check` (`NOT VALID`) |
| `programId` | String | **yes** | api | Required at `SUBMIT`. Must belong to the branch and be active. `applicant_program_from_submitted_check` (`NOT VALID`) |
| `admissionSourceId`, `quotaId` | String | yes | api | Master in scope |
| `admissionStatus` | enum | no | **eng only** | Default `DRAFT`. No route writes it directly |
| `internalRemarks`, `counsellorRemarks` | String | yes | api | Staff-facing |
| `assignedCounsellorId` | String | yes | api | **No FK, not validated** |
| `transportRequired`, `hostelRequired` | Boolean | no | api | Intent, not a booking |
| `submittedAt` … `cancelledAt` (9 columns) | DateTime | yes | eng | Stamped per the transition table |
| `approvedBy`, `rejectedBy` | String | yes | eng | Per `actorColumn` |
| `deferredFromApplicantId` | String | yes | svc | Self-FK; `<> id` CHECK |
| `customFieldData`, `checklistStatus`, `tags` | Json | yes | api | **Unvalidated client blobs** |
| `formTemplateVersion` | String | yes | api | |
| `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `deletedAt` | — | — | sys | Soft delete only from a non-frozen status |

## 31.4 `ApplicantProgramPreference`

| Field | Type | Null | W | Rule |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid7 | no | db | |
| `applicantId` | String | no | svc | `onDelete: Cascade` — preferences are part of the application |
| `programId` | String | no | api | `@@unique([applicantId, programId])` |
| `preferenceOrder` | Int | no | sys | `@@unique([applicantId, preferenceOrder])`, `>= 1` CHECK. Derived from list position |
| `status` | enum | no | db | `PENDING` default; **nothing writes any other value** |
| `remarks` | String | yes | api | |

## 31.5 `Guardian` and `ApplicantGuardianMapping` — as implemented

| Field | Type | Null | W | Rule / defect |
| :--- | :--- | :--- | :--- | :--- |
| `Guardian.id` | uuid7 | no | db | |
| `Guardian.organizationId` | String | no | sys | Set, **but never filtered on in any query** — §8 Defect 3 |
| `Guardian.branchId` | String | **no** | sys | Should be removed — S1 D2 |
| `Guardian.firstName` / `middleName` / `lastName` | String | no/yes/no | api | Should be Person's |
| `Guardian.mobilePrimary` | String | no | api | Should also feed `Person.phoneHash` |
| `Guardian.mobileSecondary`, `email` | String | yes | api | |
| `Guardian.occupation`, `income` | String / Float | yes | api | **Correctly guardian-role facts** |
| `Guardian.aadhaarNo` | String | yes | api | **Plaintext + `@@index` + substring search** — §8 Defect 4 |
| `Guardian.addressLine1/2`, `city`, `state`, `country`, `pincode` | String | yes | api | Should be S2's |
| `Guardian.deletedAt` | DateTime | yes | — | **No route sets it** |
| `Mapping.applicantId` | String | no | svc | **Should be `wardPersonId`** |
| `Mapping.guardianId` | String | no | svc | **Should be `guardianPersonId`** |
| `Mapping.relationTypeId` | String | no | api | Master |
| `Mapping.isPrimary` | Boolean | no | api | **Non-transactional exclusivity, no index** |
| `Mapping.isFinancialGuardian` | Boolean | no | api | **No exclusivity at all** |
| `Mapping.isEmergencyContact` | Boolean | no | api | Many permitted — correct |
| `Mapping.pickupAllowed` | Boolean | no | api | **No validity window** |
| `Mapping.priority` | Int | no | api | Default 1; should be `emergencyPriority` |
| — | — | — | — | **Missing: `startedAt`/`endedAt`, `isLegalGuardian`, `pickupValidFrom`/`To`** |

## 31.6 `Student` — 33 columns

| Field | Type | Null | W | Rule |
| :--- | :--- | :--- | :--- | :--- |
| `id` | uuid7 | no | db | Immutable |
| `organizationId` | String | no | sys | **Immutable** — a Student never silently moves tenants |
| `branchId` | String | no | svc (transfer) | **A mutable pointer, not identity.** `[id, branchId]` deliberately never unique |
| `personId` | String | no | sys | Immutable. `@unique` **and** `@@unique([organizationId, personId])` |
| `studentCode` | String | no | sys | `@@unique([organizationId, studentCode])`, non-blank CHECK, trigram GIN. **Persisted, never recomputed** |
| `status` | enum | no | eng | `ACTIVE` default; **no writer exists** |
| `firstName`, `middleName`, `lastName` | String | no/yes/no | svc | Correction only |
| `displayName` | String | no | sys | Derived; trigram GIN |
| `dob` | DateTime | no | svc | `student_dob_plausible_check` |
| `genderId` | String | no | svc | |
| `religionId`, `casteId`, `categoryId`, `motherTongueId`, `bloodGroupId`, `disabilityTypeId` | String | yes | svc | `onDelete: SetNull` |
| `disabilityStatus` | Boolean | no | svc | |
| `disabilityNotes` | String | yes | svc | |
| `primaryMobile` | String | yes | svc | The student's **own** — a guardian's is not copied here |
| `mobileNormalized` | String | yes | sys | Last 10 digits; indexed |
| `primaryEmail` | String | yes | svc | |
| `apaarId`, `abcId`, `penNo`, `saralId`, `udiseStudentId` | String | yes | svc | **Plaintext by design** — issued to be shared and printed |
| `photoDocumentId` | String | yes | svc | A reference, never a blob. **Deliberately no FK** |
| `createdVia` | enum | no | sys | `ADMISSION` \| `MIGRATION` |
| `sourceApplicantId` | String | yes | sys | `student_origin_check`: null only for `MIGRATION`. `student_one_per_applicant` partial unique |
| `createdBy`, `updatedBy`, `createdAt`, `updatedAt` | — | — | sys | |
| `deletedAt` | DateTime | yes | **never** | Present for schema consistency; **never set by any Student code path** |

## 31.7 `Admission` — 22 columns

Fully specified in §13.2.

## 31.8 `Enrollment` — 26 columns

Fully specified in §19.3.

## 31.9 `WorkflowHistory`

| Field | Type | Null | Rule |
| :--- | :--- | :--- | :--- |
| `id` | uuid7 | no | |
| `organizationId`, `branchId` | String | no | **Carried, not joined**, so a history read can be scoped without touching the entity |
| `entityType` | enum | no | `APPLICANT` \| `ADMISSION` \| `ENROLLMENT` \| `STUDENT` |
| `entityId` | String | no | **Polymorphic — no FK**, so history survives what it describes |
| `oldStatus` | String | yes | Null for a birth row |
| `newStatus` | String | no | |
| `actionType` | String | no | The verb, or the `originType` for a supersede |
| `remarks` | String | yes | Trimmed; null if blank |
| `actionBy` | String | yes | `'SYSTEM'` for the sweep |
| `timestamp` | DateTime | no | |

---

# 32. Validation matrix

## 32.1 Where each rule lives

Four enforcement layers, chosen deliberately per rule:

| Layer | Catches | Failure shape |
| :--- | :--- | :--- |
| **DTO** (`class-validator` + global `ValidationPipe` with `forbidNonWhitelisted`) | Shape, type, format, unknown fields | `400` with the field list |
| **Service** | Belonging, scope, state, cross-entity consistency | A **named** error code |
| **Database CHECK / partial unique / composite FK** | The invariant itself | `409`/`400`, translated |
| **Row lock + re-read** | Races | `409` naming what won |

> The service checks exist so the caller gets a good error; the database
> constraints exist so the rule holds even if a service is bypassed. **Both,
> deliberately** — one is usability, the other is truth.

## 32.2 Applicant registration

| Rule | Layer | Failure |
| :--- | :--- | :--- |
| First and last name non-empty | DTO | `400` |
| DOB is an ISO date | DTO | `400` |
| Aadhaar exactly 12 digits | DTO | `400` |
| Mobile `/^[+0-9\s-]{7,15}$/` | DTO | `400` |
| Email well-formed | DTO | `400` |
| Address line 1, city, state, country, pincode present | DTO | `400` |
| Unknown field in the body | DTO | `400` — closes mass assignment |
| Every supplied master id exists and is not deleted | Service | `404 <Master> with ID … not found` |
| Programme belongs to the branch | Service | `400 PROGRAM_OUT_OF_SCOPE` |
| Programme is active | Service | `400 PROGRAM_NOT_ACTIVE` |
| Programme exists | Service | `404 PROGRAM_NOT_FOUND` |
| Form and application numbers unique per branch+year | DB | `409` |
| **Gaps** — see §32.7 | | |

## 32.3 Workflow transitions

| Rule | Layer | Failure |
| :--- | :--- | :--- |
| The action exists | Service | `400 INVALID_TRANSITION` |
| `systemOnly` respected | Service | `403 SYSTEM_ACTION` |
| `orchestratedOnly` respected | Service | `400 ORCHESTRATED_TRANSITION` |
| Remarks non-blank when required (`.trim().length > 0`) | Service | `400 REMARKS_REQUIRED` |
| Permission held | Service | `403` |
| Applicant in scope, not deleted | **Lock + scope** | `404` |
| Current status is a legal source | **Under the lock** | `400 INVALID_TRANSITION` + `from`, `allowedFrom[]` |
| Offer not expired / expired | Guard, **read under the lock** | `400 OFFER_EXPIRED` / `400 OFFER_NOT_EXPIRED` |
| Deferment enabled | Guard (config) | `400 DEFERMENT_DISABLED` |
| Programme present at submit | Service | `400 PROGRAM_REQUIRED` |
| One live application per person/branch/year | **DB partial unique** | `409 DUPLICATE_ACTIVE_APPLICATION` |
| Offer window paired and ordered | **DB CHECK** | `400` |
| No self-deferral | **DB CHECK** | `400` |

## 32.4 Admission conversion

See §23.3 and §23.9 — thirteen pre-flight checks and five constraint classes.

## 32.5 Enrollment operations

| Rule | Layer | Failure |
| :--- | :--- | :--- |
| Reason non-blank | Service **and DB CHECK** | `400 CHANGE_REASON_REQUIRED` |
| Permission held | Service | `403` |
| In scope, not deleted | Lock + scope | `404` |
| Year not locked | Lock (`FOR SHARE`) + check | `403 ACADEMIC_YEAR_LOCKED` |
| Version matches (when stated) | Service | `409 STALE_ENROLLMENT_VERSION` |
| Placement still open | Service | `409 ENROLLMENT_CLOSED` |
| The closing status is a legal edge | Transition table | `400 INVALID_TRANSITION` |
| The replacement differs | Service | `400 PLACEMENT_UNCHANGED` |
| Roll number non-blank | Service **and DB CHECK** | `400 ROLL_NUMBER_INVALID` |
| Roll number free in the class | **DB partial unique** | `409 ROLL_NUMBER_TAKEN` |
| One live PRIMARY per admission per year | **DB partial unique** | `409 ENROLLMENT_EXISTS_FOR_YEAR` |
| Only one predecessor claims a successor | **DB unique** | `409 ENROLLMENT_ALREADY_SUPERSEDED` |
| Student/branch/unit/programme/year belong together | **DB composite FKs** | `400 ACADEMIC_UNIT_MISMATCH` |
| No result recorded before cancelling | Service | `409 ENROLLMENT_HAS_RESULT` |
| Class list unlocked for a roll-number change | Config + year lock | `403 CLASS_LIST_LOCKED` |
| Correction/transfer must supersede, not create | Service | `400 ORIGIN_REQUIRES_SUPERSEDE` |

## 32.6 Student correction

| Rule | Layer | Failure |
| :--- | :--- | :--- |
| Only whitelisted fields | **Input type** | `studentCode`, `personId`, `organizationId`, `sourceApplicantId`, `status` are unreachable |
| Plausible DOB | Service **and DB CHECK** | `400 STUDENT_DOB_INVALID` |
| Not archived | Service | `409 STUDENT_ARCHIVED` |
| Scope re-asserted on the write | `updateMany` + `count === 1` | `404` |
| Display name follows its sources | Service | derived |

## 32.7 Validation gaps found

| # | Gap | Assessment |
| :--- | :--- | :--- |
| V1 | `previousPercentage` is an unbounded `Float` | `999` or `-5` is accepted. **RECOMMENDED:** `@Min(0) @Max(100)` |
| V2 | `assignedCounsellorId` is a free string with no FK and no existence check | Can name a non-existent or another tenant's user. **RECOMMENDED:** validate against `User` in scope |
| V3 | `photoFileId` references nothing | **RECOMMENDED:** drop with S3 |
| V4 | `customFieldData`, `checklistStatus`, `tags` are unvalidated JSON | **RECOMMENDED:** stop accepting `checklistStatus`; schema-validate `customFieldData` when F2 lands |
| V5 | Applicant DOB has no plausibility bound | `Student` has one in service *and* CHECK; Applicant has neither, so a 1600 birth date reaches submission and then fails at `admit()`. **RECOMMENDED:** apply the same bound at registration, where the clerk can fix it |
| V6 | Master validation ignores `organizationId` | `assertMasterReferencesExist` checks only `deletedAt: null`, so **another tenant's master can be attached to an applicant**. `AdmissionService.assertMastersInScope` does it correctly for quota and source. **RECOMMENDED:** use the same three-tier `OR: [{organizationId: null}, {organizationId: scope.organizationId}]` filter at registration |
| V7 | Pincode pattern is permissive | Deliberate for non-Indian addresses; S2's `CHECK` will tighten it per country |
| V8 | `numbering` pre-flight ignores `isActive` | A deactivated sequence passes the `400` pre-check and then raises `500` inside the transaction. **RECOMMENDED:** add `isActive: true` |

**V6 is the most significant of these** — it is a cross-tenant reference hole of
the same class as §8 Defect 3, reached through a legitimate route.

---

# 33. Form-stage reference

Frontend-ready, but **not a UI design**. Each stage lists what the backend
accepts, requires and refuses at that point.

## 33.1 Stage 1 — Applicant registration

`POST /v1/admissions/applicants` · `admissions.create` · headers
`x-branch-id`, `x-academic-year-id` · result: `DRAFT`

| Section | Field | Input | Req | Allowed values | Validation | Depends on | Read-only |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Personal** | `firstName` | text | ✅ | — | non-empty | — | — |
| | `middleName` | text | — | — | — | — | — |
| | `lastName` | text | ✅ | — | non-empty | — | — |
| | `dob` | date | ✅ | ISO | *(add a plausible range — V5)* | — | — |
| | `genderId` | select | ✅ | `GET /masters/genders` | master exists | — | — |
| | `birthPlace` | text | — | — | — | — | — |
| | `photoFileId` | *(hidden)* | — | — | **dangling; do not surface** | S3 | — |
| **Contact** | `primaryMobile` | tel | ✅ | — | `/^[+0-9\s-]{7,15}$/` | — | — |
| | `alternateMobile` | tel | — | — | same | — | — |
| | `primaryEmail` | email | — | — | RFC | — | — |
| **Demographic** | `religionId`, `casteId`, `categoryId`, `motherTongueId`, `bloodGroupId` | select | — | the respective master | exists | — | — |
| | `disabilityStatus` | checkbox | — | bool | — | — | — |
| | `disabilityTypeId` | select | — | disability master | exists | **show only when `disabilityStatus`** | — |
| | `disabilityNotes` | textarea | — | — | — | same | — |
| **Government** | `aadhaarNo` | text | — | 12 digits | `/^\d{12}$/` | — | **write-once in practice** |
| | `penNo`, `apaarId` | text | — | — | — | — | — |
| **Address** | `currentAddressLine1` | text | ✅ | — | non-empty | — | — |
| | `currentAddressLine2` | text | — | — | — | — | — |
| | `city`, `state`, `country` | text | ✅ | — | non-empty | — | — |
| | `district` | text | — | — | — | *(auto-fill from PIN once S2 lands)* | — |
| | `pincode` | text | ✅ | — | 3–10 alnum | — | — |
| **Previous education** | `previousSchoolName`, `previousBoard`, `previousClass`, `tcNumber` | text | — | — | — | — | — |
| | `previousPercentage` | number | — | *(0–100 — V1)* | — | — | — |
| **Academic** | `programId` | select | — **at DRAFT**, ✅ **at SUBMIT** | branch's active programmes | belongs to branch, active | branch | — |
| | `quotaId` | select | — | quota master | in scope | — | — |
| | `admissionSourceId` | select | — | source master | in scope | — | — |
| | `transportRequired`, `hostelRequired` | checkbox | — | bool | — | — | — |
| **Staff** | `internalRemarks`, `counsellorRemarks` | textarea | — | — | — | — | staff only |
| | `assignedCounsellorId` | select | — | *(unvalidated — V2)* | — | — | staff only |

**After submit:** `DRAFT` created; `admissionFormNo` and `applicationNo`
allocated and returned; `applicant.created` enqueued; **duplicate matches
returned as `warnings[]`, never blocking**.

**Not part of this stage:** guardians (a separate call today — see §33.2),
documents (S3), academic unit (decided at admission), roll number, fees.

## 33.2 Stage 1b — Guardians

`POST /v1/admissions/guardians` then
`POST /v1/admissions/guardians/applicant/:applicantId/map`

| Field | Input | Req | Validation | Note |
| :--- | :--- | :--- | :--- | :--- |
| `firstName`, `lastName` | text | ✅ | non-empty | |
| `middleName` | text | — | — | |
| `mobilePrimary` | tel | ✅ | — | |
| `mobileSecondary`, `email` | tel / email | — | — | |
| `occupation` | text | — | — | Genuinely a guardian-role fact |
| `income` | number | — | — | Same |
| `aadhaarNo` | text | — | — | **Should not be collected here** — §8 |
| address ×6 | text | — | — | **Should not be collected here** — §8 |
| `relationTypeId` | select | ✅ | master | On the mapping |
| `isPrimary` | radio | — | **at most one** *(not enforced)* | |
| `isFinancialGuardian` | radio | — | **at most one** *(not enforced at all)* | |
| `isEmergencyContact` | checkbox | — | many | |
| `pickupAllowed` | checkbox | — | default `true` | |
| `priority` | number | — | default 1 | |

> **Three warnings for a frontend author.**
> 1. **Always send every flag on a re-map.** Omitting `isPrimary` silently sets
>    it to `false` (§8 Defect 5).
> 2. **Do not rely on exclusivity.** Enforce single-selection in the UI; the
>    server does not.
> 3. **These guardians will not follow the student.** Until §8 is fixed they are
>    reachable only through `sourceApplicantId`.
>
> `RECOMMENDED` — adopt the nested-write shape: accept `guardians[]` inside the
> applicant payload and resolve Person, Guardian and Guardianship **in one
> transaction**. The current three-call flow is what makes the untransacted
> toggle reachable from a client at all.

## 33.3 Stage 2 — Review

`POST /v1/admissions/applicants/:id/workflow/transition`

| Sub-stage | Action | Fields | Remarks | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Open review | `startReview` | — | optional | From `SUBMITTED` |
| Identity check | *(read)* | `personId`, duplicate candidates | — | Candidates are **advisory** |
| Request documents | `requestDocuments` | — | **required** | → `DOCUMENT_PENDING` |
| Mark received | `documentsReceived` | — | optional | Guard is a **no-op** today |
| Request fee | `requestFee` | — | optional | → `FEE_PENDING` |
| Waitlist | `waitlist` | — | **required** | `admissions.approve` |
| Reject | `reject` | — | **required** | Terminal |
| Cancel | `cancel` | — | **required** | Reopenable |
| Withdraw | `withdraw` | — | **required** | Applicant-initiated |

Editable during review: everything in Stage 1 except the workflow columns.
Frozen from `APPROVED`.

**A UI should call `actionsFrom(state)`** rather than hard-coding buttons — it
returns exactly the legal actions minus `systemOnly` ones, and it deliberately
**includes `admit`**, because that genuinely is what a registrar clicks from
`SEAT_CONFIRMED`. What the flag governs is which *endpoint* performs it.

## 33.4 Stage 3 — Offer

`action: approve` · `admissions.approve`

| Field | Direction | Value |
| :--- | :--- | :--- |
| `remarks` | in | optional |
| `approvedAt` | out | now |
| `offerIssuedAt` | out | now |
| `offerExpiresAt` | out | **server-computed** — `issuedAt + offerValidityDays` (15) |
| `approvedBy` | out | the actor |
| Programme | out | `Applicant.programId` — displayed, not chosen here |
| Academic unit | — | **not yet decided** |
| Seat information | — | **no capacity exists** (§22) |

**The expiry date is never a client input.** `applicant.offer_issued` is enqueued
for communication.

## 33.5 Stage 4 — Seat confirmation

`action: confirmSeat` · `admissions.update` · guard `OFFER_NOT_EXPIRED`

| Concern | Answer |
| :--- | :--- |
| Trigger | Normally admission-fee payment — **the fee module does not exist**, so this is a manual action today |
| Fees | **Out of scope.** No fee record is created or checked |
| Documents | Not enforced (S3 absent) |
| Expiry | Read **under the lock** — a lapsed offer cannot be confirmed even one millisecond late |
| Result | `SEAT_CONFIRMED`, `seatConfirmedAt` stamped, `applicant.seat_confirmed` enqueued |

## 33.6 Stage 5 — Admission conversion

`POST /v1/admissions/applicants/:applicantId/admit`

| Field | Input | Req | Allowed |
| :--- | :--- | :--- | :--- |
| `academicUnitId` | select | ✅ | **Units of the applicant's own branch, programme and year, active.** Fetch with those filters — a mismatch is a `400` |
| `admissionType` | select | — | `REGULAR` \| `LATERAL_ENTRY` \| `RTE` **only** |
| `admissionDate` | date | — | Defaults to now |
| `remarks` | textarea | — | ≤ 500 chars |

**Backend-controlled — a frontend supplies none of these:** `studentId`,
`studentCode`, `admissionId`, `admissionNo`, `enrollmentId`, `personId`,
`programId`, `organizationId`, `branchId`, `academicYearId`, any status.

**Response:** all six identifiers. A `409` naming an existing `studentId`/
`studentCode` should be rendered as *"already admitted"*, **not** as an error to
retry.

## 33.7 Stage 6 — Student profile

`GET /students/:id` · `PATCH /students/:id` · `student.view` / `student.update`

**Identity and profile only.** Editable: the demographic and contact block plus
the five institutional identifiers and `photoDocumentId`.
**Not editable through any route:** `studentCode`, `personId`, `organizationId`,
`sourceApplicantId`, `status`, `branchId`.
**Not present at all:** any academic placement, address or guardian field.

## 33.8 Stage 7 — Enrollment

`GET /enrollments?studentId=&academicYearId=` · `POST …/correct` · `…/transfer`
· `…/cancel` · `PATCH …/roll-number`

**Academic placement only.** Every mutation requires a **reason**; corrections
and transfers produce a *new row* and close the old one, so a UI must render
both and not treat the change as an edit. Roll number is the only in-place
change.

## 33.9 What a frontend must never do

1. Send a status field to any endpoint — statuses move through named actions.
2. Compute `offerExpiresAt`, `studentCode`, `admissionNo` or any timestamp.
3. Send `studentId`/`admissionId`/`enrollmentId` to `admit()`.
4. Assume a roll number exists after admission — it is **null**.
5. Assume a guardian follows the student — it does not (§8).
6. Treat a duplicate warning as a block.
7. Rely on the document checklist — it passes unconditionally.
8. Show a seat count — none exists.
9. Put a `studentId` in a **parent- or student-facing** path.
10. Display a full Aadhaar — only `XXXX XXXX 1234` from `aadhaarLast4`.

---

# 34. Configuration matrix

## 34.1 The boundary test

> **A fact _about_ the thing is a column. A rule about _how the system behaves_
> is configuration.** `DECIDED`

`Branch.code` is a fact — a column. *"How many days an offer stays open"* is a
rule — configuration. Without this test a configuration engine becomes the place
everything lands, and then every read needs it.

## 34.2 Core invariant versus configurable

| Rule | Core | Config | Why |
| :--- | :---: | :---: | :--- |
| Student UUID is v7 and permanent | ✅ | ❌ | Technical identity |
| `studentCode` unique per organization | ✅ | ❌ | Identity invariant. Its **scope** is not a customer choice |
| **`studentCode` prefix and width** | | ✅ **at provisioning, then frozen** | Genuine institutional variation |
| `studentCode` immutable after assignment | ✅ | ❌ | Every printed artefact depends on it |
| Student is **not** year-scoped | ✅ | ❌ | The central premise |
| Enrollment **is** year-scoped | ✅ | ❌ | Same |
| One Student per Person per organization | ✅ | ❌ | Identity invariant |
| One `ACTIVE` Admission per Student | ✅ | ❌ | A student cannot be admitted twice at once |
| One live `PRIMARY` Enrollment per admission per year | ✅ | ❌ | Otherwise "duplicate enrollment" has no meaning |
| Student ≠ User | ✅ | ❌ | One human, many roles |
| No hard delete | ✅ | ❌ | |
| Supersede-never-edit | ✅ | ❌ | Audit integrity |
| Roll numbers immutable after the class list locks | ✅ | ❌ | Otherwise "lock" means nothing |
| Numbering allocation mode per purpose | ✅ | ❌ | **Gaplessness is a statutory property, not a preference** |
| **The 13 states and the transition graph** | ✅ | ❌ | Core semantics — a configurable graph is a rules engine |
| **Which states an institution uses** | | ✅ | Skipping `FEE_PENDING` is policy: simply never issue that action |
| Which transitions require remarks | | ✅ | Institutional rigour differs |
| Offer validity period | | ✅ | |
| Deferment allowed; seat held during it | | ✅ | |
| Readmission requires a fresh application | | ✅ | |
| Branch-transfer approval level | | ✅ | |
| Branch transfer blocked by open workflows | | ✅ | |
| Roll-number policy | | ✅ | |
| Document requirements | | ✅ | Institutions run their own admission policy |
| Primary guardian required below age N | | ✅ | An adult learner may have none |
| Archive after N years | | ✅ | |
| Capacity enforcement mode | | ✅ | The *number* is a column; the *rule* is config |

## 34.3 The key registry

| Key | Type | Scope | Default | Effective-dated | Editable | Lock condition | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `admissions.offer_validity_days` | INT | SYS→ORG→BRANCH | **15** | ✅ | ✅ | — | **`IMPLEMENTED`** via `AdmissionConfigProvider` |
| `admissions.deferment_enabled` | BOOL | SYS→ORG→BRANCH | **false** | ✅ | ✅ | — | **`IMPLEMENTED`** via `AdmissionConfigProvider` |
| `enrollment.roll_number_policy` | ENUM | SYS→ORG→BRANCH | **`MANUAL`** | ✅ | ✅ | — | **`IMPLEMENTED`** via `EnrollmentConfigProvider` |
| `enrollment.class_list_locked` | BOOL | per class list | **derives from `AcademicYear.isLocked`** | — | — | — | **interim `IMPLEMENTED`** |
| `admissions.readmission.requires_application` | ENUM | ORG→BRANCH | `AFTER_GAP_YEARS` | ✅ | ✅ | — | `PROPOSED` |
| `admissions.readmission.gap_years_threshold` | INT | ORG→BRANCH | `1` | ✅ | ✅ | — | `PROPOSED` |
| `admissions.deferment.seat_held` | BOOL | ORG→BRANCH | `true` | ✅ | ✅ | — | `PROPOSED` |
| `admissions.states_enabled` | ENUM[] | ORG→BRANCH | all 13 | ❌ | ✅ | — | `PROPOSED` |
| `admissions.transition_remarks_required` | JSON | ORG→BRANCH | the table's policy | ✅ | ✅ | — | `PROPOSED` |
| `admissions.capacity.enforcement` | ENUM | ORG→BRANCH | `OFF` | ✅ | ✅ | — | `PROPOSED` |
| `admissions.late_admission_allowed` | BOOL | BRANCH | `false` | ✅ | ✅ | year lock | `PROPOSED` |
| `student.transfer.approval_role` | ENUM | ORG | `ORG_ADMIN` | ❌ | ✅ | — | `PROPOSED` |
| `student.transfer.block_on_open_workflows` | BOOL | ORG | `true` | ❌ | ✅ | — | `PROPOSED` |
| `student.archive_after_years` | INT | ORG | `7` | ✅ | ✅ | — | `PROPOSED` |
| `student.account.min_age` | INT | ORG | — | ✅ | ✅ | — | `PROPOSED` |
| `guardian.primary_required_below_age` | INT | ORG→BRANCH | — | ✅ | ✅ | — | `PROPOSED` |
| `documents.requirements` | table | ORG→BRANCH | — | ❌ | ✅ | — | `DEFERRED` (S3) |
| `address.verification_required` | BOOL | ORG | `false` | ✅ | ✅ | — | `DEFERRED` (S2) |
| **`STUDENT_CODE` prefix / padding** | — | **ORGANIZATION** | `STU` / 10 | ❌ | **✅ until the first allocation** | **frozen after allocation** | **`IMPLEMENTED`** — `NumberSequenceConfig` |
| **`ADMISSION_NO` format** | — | **BRANCH** | — | ❌ | ✅ | must render `{year}` | **`IMPLEMENTED`** |
| **`APPLICATION` / `ADMISSION_FORM` format** | — | **BRANCH** | — | ❌ | ✅ | must render `{sequence}` and `{year}` | **`IMPLEMENTED`** |

## 34.4 The existing mechanism — do not invent a second one

F2 is not built. Rather than scatter `process.env` reads or add settings columns
to `Branch` — either of which would have to be unpicked — **every policy read
goes through one provider interface with architectural defaults behind it.**
When F2 lands the implementation is swapped and **no call site changes**.

Two providers exist: `AdmissionConfigProvider` and `EnrollmentConfigProvider`.
`IMPLEMENTED` `VERIFIED`

**Explicitly not acceptable:** `process.env` reads for policy, settings columns
on `Branch`, or values hard-coded inline at their call sites.

> One instance to note: `OFFER_EXPIRY_JOB_DISABLED` is read from the environment
> — but it is **operational** (is the sweep running here?) rather than policy
> (how long is an offer valid?), so it is on the right side of the line.

## 34.5 `asOf` is not decoration

Every provider method already takes `asOf`. A policy read must answer *"what was
the rule when this decision was made?"*, not *"what is the rule now"*:

> A branch changes its refund percentage from 80% to 50% on 1 November. A refund
> was requested on 20 October and is approved on 5 December. **October's 80%
> applies.** A system that reads the current value gets this wrong, silently,
> and cannot even show that it did.

The same applies here: an offer issued under a 15-day window must not silently
become a 7-day window because an administrator edited the setting this morning.
Taking the parameter now means the call sites are **already correct** when F2
arrives. `IMPLEMENTED` `VERIFIED`

**Long-running jobs bind a config version at start** — a promotion over 2,000
students that reads config per student can otherwise behave differently for
student 1 and student 2,000. `RECOMMENDED`

## 34.6 Configuration changed after records exist

| Change | Effect on existing records |
| :--- | :--- |
| `studentCode` prefix/width | **Refused** after the first allocation — `400 SEQUENCE_WIDTH_IMMUTABLE` |
| Any numbering `format` | **Existing values are persisted and never recomputed.** Only future allocations change |
| Offer validity | Existing `offerExpiresAt` values are **stamped columns** and do not move |
| Deferment disabled | Existing `DEFERRED` applicants stay; new defer attempts fail |
| Roll-number policy | Existing numbers stand; the new policy governs future assignment |
| Document requirements | The checklist recomputes; an already-`ADMITTED` applicant is unaffected |
| Master deactivated (`isActive: false`) | Existing references keep resolving; **new** references are refused |
| Master soft-deleted | `onDelete: SetNull` on Student's optional demographics; **existing Applicant references are not nulled** — an asymmetry worth knowing |
| Academic year locked | All placement writes refused; reads unaffected |

---

# 35. Permissions

## 35.1 The mandatory access rule

```
   ✅  resource lookup  =  identifier  +  execution scope  +  permission
   ❌  resource lookup  =  identifier
```

| Rule | Detail | Status |
| :--- | :--- | :--- |
| `findUnique({ where: { id } })` is banned | Every read is `findFirst({ id, organizationId, …branchScope, deletedAt: null })` | `IMPLEMENTED` — **except every guardian read** |
| **A scope miss is `404`, never `403`** | A `403` confirms the row exists — an enumeration oracle | `IMPLEMENTED` `VERIFIED` |
| Writes re-assert scope in the `WHERE` | `updateMany({ where: { id, organizationId, branchId } })` + assert `count === 1` | `IMPLEMENTED` — **except guardian writes** |
| Parent lineage validated, not assumed | Creating a placement validates the **admission's** branch, and does not stamp the caller's context | `IMPLEMENTED` `VERIFIED` |
| Org-wide reads are opt-in by permission | `student.view.organization` widens branch → organization | `IMPLEMENTED` `VERIFIED` |

## 35.2 Operation → permission map

| Operation | Route | Roles | Permission | Scope |
| :--- | :--- | :--- | :--- | :--- |
| Create applicant | `POST /admissions/applicants` | SA, OA, BA, STAFF | `admissions.create` | branch + year |
| Check duplicates | `POST …/check-duplicates` | SA, OA, BA, STAFF | `admissions.view` | branch |
| List / read applicants | `GET …`, `GET …/:id` | SA, OA, BA, STAFF | `admissions.view` | branch (+ year on list) |
| Edit applicant | `PATCH …/:id` | SA, OA, BA, STAFF | `admissions.update` | branch |
| Soft-delete applicant | `DELETE …/:id` | SA, OA, BA | `admissions.delete` | branch |
| Read / set preferences | `GET`/`POST …/:id/preferences` | SA, OA, BA (+STAFF read) | `admissions.view` / `.update` | branch |
| **Workflow transition** | `POST …/:id/workflow/transition` | SA, OA, BA, STAFF | `admissions.update` **at the route**, then the **rule's own** permission | branch |
| Workflow history | `GET …/workflow/history` | SA, OA, BA, STAFF | `admissions.view` | branch |
| Approve / waitlist / defer / cancel / reopen | *(via transition)* | — | `admissions.approve` | branch |
| Reject | *(via transition)* | — | `admissions.reject` | branch |
| Expire offer | *(job)* | — | **system** | — |
| **Admit** | `POST …/:id/admit` | SA, OA, BA | `admissions.approve` **at the route** **+ `admissions.approve` AND `student.create`** in the service | branch + year |
| Search students | `GET /students` | SA, OA, BA, STAFF | `student.search` | branch, or org with `student.view.organization` |
| Lookup by code | `GET /students/lookup` | SA, OA, BA, STAFF | `student.search` | same |
| Read student | `GET /students/:id` | SA, OA, BA, STAFF | `student.view` | branch |
| Correct student | `PATCH /students/:id` | SA, OA, BA | `student.update` | branch |
| Person match | `POST /persons/match` | SA, OA, BA, STAFF | `person.search` | organization |
| Read person | `GET /persons/:id` | SA, OA, BA, STAFF | `person.view` | organization |
| Attach government id | `POST /persons/:id/government-id` | SA, OA, BA | `person.attach_government_id` | organization |
| Record distinct | `POST /persons/match-decisions` | SA, OA, BA | `person.correct` | organization |
| List / read enrollment | `GET /enrollments…` | SA, OA, BA, STAFF | `enrollment.view` | branch |
| Correct / transfer placement | `POST …/correct`, `…/transfer` | SA, OA, BA | `enrollment.correct` | branch |
| Cancel placement | `POST …/cancel` | SA, OA, BA | `enrollment.cancel` | branch |
| Assign roll number | `PATCH …/roll-number` | SA, OA, BA, **STAFF** | `enrollment.rollnumber.manage` | branch |
| **Guardian — every route** | `/admissions/guardians/**` | SA, OA, BA (+STAFF read) | **NONE** | **NONE** |

SA = `SUPER_ADMIN`, OA = `ORG_ADMIN`, BA = `BRANCH_ADMIN`. `VERIFIED`

## 35.3 Forbidden actions — what no permission grants

| Action | Why it is impossible |
| :--- | :--- |
| Create a Student over HTTP | No route. `createControlled` is code-only |
| Create an Admission over HTTP | No controller at all |
| Create an Enrollment over HTTP | No `POST /enrollments` |
| Delete a Student, Admission or Enrollment | No delete path anywhere |
| Set `admissionStatus` directly | Only the engine writes it |
| Reach `ADMITTED` without a Student | `orchestratedOnly`, and no DTO field sets the flag |
| Change `studentCode`, `personId`, `sourceApplicantId`, `organizationId` | Absent from every input type |
| Change `Student.status` | Absent from the correction input; no lifecycle route |
| Move a placement to another branch | The replacement's branch is copied from the original |
| Write `resultOutcome` | No route, no service method |
| Invent a number | `NUMBERING_NOT_PROVISIONED` rather than a default |

## 35.4 Missing permissions

| Documented | Present? | For |
| :--- | :--- | :--- |
| `student.view.organization` | ✅ | Cross-branch search |
| `student.lifecycle` | ❌ | Withdraw / graduate / suspend / reinstate |
| `student.transfer` | ❌ | Branch transfer |
| `student.code.correct` | ❌ | Break-glass code correction |
| `student.sensitive.read` | ❌ | Revealing a full identifier — **deliberately withheld** until the access log that records who read what exists |
| `student.delete` | ✅ **but should gate *archive*** | There is no delete — C-10 |
| `enrollment.create`, `.promote`, `.export` | ✅ declared | No operation uses them yet |
| `guardian.*` / `guardianship.*` | ❌ | **Every guardian route is unpermissioned** |

`VERIFIED` · the first four are `DEFERRED` with their operations; the guardian
ones are **BLOCKING**.

## 35.5 The 404-not-403 rule

Preserved everywhere it has been established. `VERIFIED`

| Situation | Response |
| :--- | :--- |
| Applicant in another branch | `404 Applicant not found` |
| Student in another branch | `404 Student not found` |
| Enrollment in another branch | `404 Enrollment not found` |
| Person in another organization | `404 Person not found` |
| Academic year in another branch | `404 Academic year not found` |
| **A locked academic year** | **`403 ACADEMIC_YEAR_LOCKED`** — correctly a 403: the caller is entitled to know the resource exists and is closed |
| Missing permission on an in-scope resource | `403` |

The distinction is exact: **`404` hides existence; `403` reports a state the
caller is entitled to know.**

## 35.6 Escape vectors

| Vector | Closed by | Status |
| :--- | :--- | :--- |
| Tenant escape by UUID | `organizationId` in every `WHERE`; `404` | ✅ **except guardians** |
| Branch escape (read) | Branch scope unless `student.view.organization` | ✅ **except guardians** |
| Branch escape (write) | Parent lineage validated + composite FKs | ✅ |
| Academic-year escape | `academicYearId` from the resource; `isLocked` checked under a lock | ✅ |
| UUID enumeration | Scope filtering ⇒ guessing yields `404` | ✅ **except guardians** |
| Mass assignment | Global `ValidationPipe` with `forbidNonWhitelisted`; identity fields absent from every DTO | ✅ |
| Status write | No endpoint accepts `status` | ✅ |
| Header spoofing | `ExecutionContextGuard` validates every supplied scope id against the caller's grants | ✅ |
| **Cross-tenant master reference** | — | ❌ **V6** |
| **Aadhaar substring probe** | — | ❌ **§8 Defect 4** |
| Exfiltration via export | `student.export` separately permissioned **and separately audited** | `PROPOSED` — no export route exists yet |

---

# 36. Security & privacy

## 36.1 Field-level sensitivity matrix

| Field | Where stored | Encrypted | Blind index | Masked | In API response | Searchable | In logs | In events | In audit | Exportable |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **Aadhaar** — canonical | `PersonSensitive.aadhaarEnc` | ✅ AES-256-GCM | ✅ `Person.govtIdHash` | `XXXX XXXX 1234` | **last4 only** | by exact digest | ❌ | ❌ | ❌ | ❌ |
| **Aadhaar** — `Applicant.aadhaarNo` | plaintext column | ❌ | ❌ | — | **not returned** | ⚠️ `checkDuplicates` exact | ❌ | ❌ | ❌ | ⚠️ |
| **Aadhaar** — `Guardian.aadhaarNo` | plaintext column | ❌ | ❌ | — | ⚠️ **returned in full** by `GET /guardians/:id` | ⚠️ **substring `contains`** | ❌ | ❌ | ❌ | ⚠️ |
| APAAR / ABC / PEN / Saral / UDISE | `Student`, `Applicant` | ❌ **by design** | ❌ | — | ✅ | ✅ | ❌ | ❌ | ⚠️ | ✅ |
| **Mobile** | `Student.primaryMobile`, `Applicant.primaryMobile`, `Guardian.mobilePrimary` | ❌ | ✅ `Person.phoneHash` | `******3210` available | ✅ | ✅ normalized | ❌ | ⚠️ **`applicant.created` and `guardian.created` carry it** | ⚠️ **lands in `AuditLog`** | ✅ |
| **Email** | same three | ❌ | ❌ | `a***@example.com` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **DOB** | `Person.dob`, `Student.dob`, `Applicant.dob` | ❌ **cannot be** — it is a matching key | ❌ | — | ✅ | ✅ exact | ❌ | ❌ | ⚠️ diffs | ✅ |
| Name | `Applicant`, `Student`, `Guardian`; normalized on Person | ❌ | ✅ `nameNormalized` | — | ✅ | ✅ trigram | ⚠️ | ⚠️ `applicant.created`, `guardian.created` | ⚠️ | ✅ |
| **Caste / category / religion** | `Applicant`, `Student` (FK) | ❌ | ❌ | — | ✅ | ❌ | ❌ | ❌ | ⚠️ diffs | ✅ |
| **Disability** | `Applicant`, `Student` | ❌ | ❌ | — | ✅ | ❌ | ❌ | ❌ | ⚠️ diffs | ✅ |
| Address | `Applicant`, `Guardian` inline | ❌ | ❌ | — | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Guardian income / occupation | `Guardian` | ❌ | ❌ | — | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `studentCode` / `admissionNo` / `applicationNo` | their owners | ❌ | ❌ | — | ✅ **designed to be printed** | ✅ | ✅ | ✅ | ✅ | ✅ |
| UUIDs | everywhere | ❌ | ❌ | — | ✅ internal clients | — | ✅ | ✅ | ✅ | ⚠️ |
| DEK / pepper / `ENCRYPTION_KEY` | env + `OrganizationDataKey` | wrapped | — | `[REDACTED]` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

⚠️ = a finding. `VERIFIED`

## 36.2 The rules, and where each holds

| Rule | Status |
| :--- | :--- |
| One masking implementation used everywhere (`maskAadhaar`, `maskTail`, `maskPhone`, `maskEmail`, `redact`) | ✅ `IMPLEMENTED` — *"separate rules in the controller, the logger and the exporter is how a value ends up masked on three screens and printed in full on the fourth"* |
| An error message never echoes the identifier back | ✅ `VERIFIED` — `GOVERNMENT_ID_INVALID` deliberately says nothing about the value |
| A conflict never names the other party | ✅ `VERIFIED` — `GOVERNMENT_ID_ALREADY_ASSOCIATED` names no identifier and no person |
| The government identifier is never logged | ✅ `VERIFIED` — the degradation path logs *"stored government identifier failed validation"* with no value |
| `Student`, `Admission`, `Enrollment` carry no sensitive identifier | ✅ **asserted by test** |
| No event or audit payload carries an Aadhaar | ✅ **asserted by test** |
| **No event payload carries any contact detail** | ❌ **`applicant.created` carries `primaryMobile`; `guardian.created` carries `firstName`, `lastName`, `mobilePrimary`** |
| Revealing a full identifier requires a per-user grant **and** an access log | ✅ by absence — the capability is deliberately not built until the log exists |
| Crypto-erasure keeps the row and the blind index | ✅ primitive exists; no operation invokes it |
| Tenant offboarding is a key shred, not a table scan | ✅ `OrganizationDataKey.shreddedAt` |

## 36.3 Findings

| # | Finding | Severity | Recommendation |
| :--- | :--- | :--- | :--- |
| S1 | `GET /guardians/:id` returns a **full plaintext Aadhaar** to any authenticated user of any tenant | **CRITICAL** | Scope the query (§8 Defect 3) **and** stop returning the value; move it to `PersonSensitive` |
| S2 | Guardian search matches Aadhaar by **substring** | **HIGH** | Hash-and-compare, as Person already does |
| S3 | `applicant.created` and `guardian.created` carry contact details into `AuditLog.payload` | **MEDIUM** | Reduce both payloads to identifiers. The audit row already carries actor and scope from `RequestContext`; the payload should carry **what happened**, not **who it is about** |
| S4 | `Applicant.aadhaarNo` and `Guardian.aadhaarNo` are plaintext | **MEDIUM** | Migrate with the Guardian work — already a named carry-forward |
| S5 | Student demographic diffs put caste, category and religion into `AuditLog.changes` | **LOW–MEDIUM** | Correct in principle — a caste correction is exactly what audit is for — but these are special-category data. **RECOMMENDED:** confirm audit retention and access are appropriate for them |
| S6 | `Applicant` masters are not tenant-filtered (V6) | **MEDIUM** | Apply three-tier filtering |
| S7 | UUID v7 leaks a creation timestamp | **LOW** | Already bounded by the §17.2 exposure rule; enforce it when the portal is built |

## 36.4 DPDP considerations

The user base is **children**, which triggers heightened obligations.

| Obligation | Position |
| :--- | :--- |
| Right to erasure | Crypto-erasure designed; the operation is `DEFERRED` |
| Data minimisation | Person holds matching keys only ✅; Guardian holds far more than it needs ❌ |
| Purpose limitation | Applicant snapshot vs Student current record is exactly this distinction ✅ |
| Retention | `student.archive_after_years` is `PROPOSED`; nothing prunes today |
| Consent | `ConsentRecord` is F1's, not built |
| Breach blast radius | One tenant per DEK ✅ |
| Third-party processing | **Open** — DQ1: a cloud virus scanner would send student documents to a third party |

---

# 37. Audit

## 37.1 The rule

> **Business modules never import `AuditService`.** Audit is a **consumer of
> domain events**, not a dependency of the code that produces them. `DECIDED`

```
service → outbox.enqueue(event, tx) → COMMIT
                                        │
                             OutboxRelay (timer)
                                        │
                                   EventBus.publish
                                        │
                        ┌───────────────┴───────────────┐
                   AuditListener                  other consumers
                        │
              AuditEventMapper → AuditRepository → AuditLog
```

`IMPLEMENTED` `VERIFIED` — no business service imports the audit module.

## 37.2 What an audit row carries

| Field | Source |
| :--- | :--- |
| `eventId` | The event — **`@unique`, which is what deduplicates at-least-once delivery** |
| `eventName`, `aggregateType`, `aggregateId`, `timestamp` | The event |
| `action`, `module` | Inferred from `module.action` naming, overridable via `metadata` |
| `userId`, `userEmail`, `role` | `RequestContext`, or the outbox's `contextSnapshot` |
| `organizationId`, `branchId`, `academicYearId` | Same |
| `requestId`, `correlationId`, `ipAddress`, `userAgent`, `httpMethod`, `route` | Same |
| `changes` | Field-level diffs where the producer supplies them |

**The context snapshot is load-bearing.** `AuditEventMapper` reads the actor from
`RequestContextService`, backed by AsyncLocalStorage. The relay runs on a timer,
**outside any request**, so that store is empty — without the snapshot captured
at enqueue time, every replayed audit row would be attributed to nobody.
`IMPLEMENTED` `VERIFIED`

## 37.3 Coverage by operation

| Operation | Event | Level | Old → new | Reason | Sensitive excluded |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Applicant created | `applicant.created` | INFO | — | — | ❌ **carries `primaryMobile`** |
| Applicant updated | `applicant.updated` | INFO | ❌ **no diffs** | — | ✅ |
| Applicant deleted | `applicant.deleted` | INFO | — | — | ✅ |
| Every workflow transition | `applicant.<action>` (14 names) | INFO / **WARN** on reopen | ✅ `fromStatus` → `toStatus` | ✅ remarks | ✅ |
| Person created | `person.created` | INFO | — | — | ✅ only `hasGovernmentId` |
| Government id attached | `person.government_id_attached` | INFO | — | — | ✅ only `idType` |
| Match reviewed | `person.match_reviewed` | INFO | — | ✅ mandatory | ✅ |
| Sensitive erased | `person.sensitive_erased` | INFO | — | — | **no producer** |
| Student created | `student.created` | INFO | — | — | ✅ identifiers only |
| Code assigned | `student.code_assigned` | INFO | — | — | ✅ |
| Student corrected | `student.updated` | INFO | ✅ **full field diffs** | — | ⚠️ demographic values by nature |
| Admission created | `admission.created` | INFO | — | — | ✅ |
| Enrollment created | `enrollment.created` | INFO | — | — | ✅ |
| Enrollment superseded | `enrollment.superseded` | INFO | ✅ old → new id | ✅ mandatory | ✅ |
| Enrollment status changed | `enrollment.status_changed` | INFO | ✅ | ✅ | ✅ |
| Roll number changed | `enrollment.roll_number_changed` | INFO | ✅ from → to | — | ✅ |
| Numbering config created | `numbering_config.created` | INFO | — | — | ✅ |
| **Guardian created / updated / mapped / unmapped** | `guardian.*` | INFO | ❌ | ❌ | ❌ **carries name and mobile** |
| **Numbering config *updated*** | — | — | — | — | **no event — see below** |
| Capacity override | — | — | — | — | `PROPOSED` |

`VERIFIED`

## 37.4 Audit gaps

| # | Gap | Severity | Recommendation |
| :--- | :--- | :--- | :--- |
| A1 | `student.deleted` is still in the allowlist with **no producer and no delete path** | LOW | Remove — a dead allowlist entry invites someone to make it live |
| A2 | **`numbering_config.updated` has no event**, though `createConfig` publishes one. Editing a format silently alters every future identifier | **MEDIUM** | Publish it. *"The event that matters is the configuration change"* |
| A3 | `applicant.updated` carries no field diffs, while `student.updated` does | MEDIUM | Add diffs — an application is a legal declaration and *who changed the date of birth, and from what* is exactly the audit question |
| A4 | Guardian events bypass the outbox | MEDIUM | Route through `outbox.enqueue` |
| A5 | Contact details in `applicant.created` / `guardian.created` payloads | MEDIUM | Reduce to identifiers |
| A6 | No audit for **reads** of sensitive data | — | Correct today (no reveal exists); the reveal must ship **with** its access log |
| A7 | No export audit | — | `PROPOSED` — bulk export is the highest-risk action in the system |

## 37.5 Three streams, not one

| Stream | Contents | Retention |
| :--- | :--- | :--- |
| **Audit log** | Business mutations, actor, before/after | Long — statutory |
| **Workflow history** | Lifecycle transitions per entity, user-visible | With the entity |
| **Request log** | HTTP, latency, correlation ids | Short |

`AuditListener` swallows and logs its own errors, so **an audit failure never
fails the business operation**. The event row survives in the outbox regardless.
`IMPLEMENTED` `VERIFIED`

---

# 38. Events

## 38.1 The catalogue as implemented

Every event carries an auto-generated UUID v7 `eventId`, `eventName`,
`occurredAt`, `aggregateId`, `aggregateType`. **The payload carries *what*
happened; `RequestContext` supplies *who*** — actor and tenant identity are not
duplicated into payloads. `DECIDED`

| Event | Producer | Aggregate | Payload | Outbox | Registered for audit |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `applicant.created` | `ApplicantService` | Applicant | `applicantId`, `displayName`, `admissionFormNo`, `applicationNo`, ⚠️`primaryMobile` | ✅ | ✅ |
| `applicant.updated` | `ApplicantService` | Applicant | `applicantId`, `displayName` | ✅ | ✅ |
| `applicant.deleted` | `ApplicantService` | Applicant | `applicantId` | ✅ | ✅ |
| `applicant.submitted` … `applicant.admitted` (14) | `WorkflowService` | Applicant | `applicantId`, `organizationId`, `branchId`, `action`, `fromStatus`, `toStatus` | ✅ | ✅ all 14 |
| `person.created` | `PersonService` | Person | `personId`, `organizationId`, `hasGovernmentId` | ✅ | ✅ |
| `person.government_id_attached` | `PersonService` | Person | `personId`, `organizationId`, `idType` | ✅ | ✅ |
| `person.match_reviewed` | `PersonService` | Person | pair + `decision` | ✅ | ✅ |
| `person.sensitive_erased` | **none** | Person | — | — | ✅ |
| `student.created` | `StudentService` | Student | `studentId`, `organizationId`, `branchId`, `personId`, `studentCode`, `createdVia`, `sourceApplicantId` | ✅ | ✅ |
| `student.code_assigned` | `StudentService` | Student | `studentId`, `organizationId`, `studentCode` | ✅ | ✅ |
| `student.updated` | `StudentService` | Student | `studentId`, `changedFields[]` + `metadata.changes[]` | ✅ | ✅ |
| `admission.created` | `AdmissionService` | Admission | `admissionId`, scope, `studentId`, `admissionNo`, type, date, entry programme/unit, `previousAdmissionId`, `sourceApplicantId` | ✅ | ✅ |
| `enrollment.created` | `EnrollmentService` | Enrollment | `enrollmentId`, scope, `studentId`, `admissionId`, `programId`, `academicUnitId`, `enrollmentKind`, `originType`, `previousEnrollmentId` | ✅ | ✅ |
| `enrollment.superseded` | `EnrollmentService` | Enrollment | `oldEnrollmentId`, `newEnrollmentId`, scope, `studentId`, `originType`, `changeReason` | ✅ | ✅ |
| `enrollment.status_changed` | `EnrollmentService` | Enrollment | `enrollmentId`, scope, `from`, `to`, `reason` | ✅ | ✅ |
| `enrollment.roll_number_changed` | `EnrollmentService` | Enrollment | `enrollmentId`, scope, `academicUnitId`, `studentId`, `from`, `to` | ✅ | ✅ |
| `numbering_config.created` | `NumberingService` | Config | `configId`, `purpose`, `format` | ❌ direct | ✅ |
| `guardian.created/updated/mapped/unmapped` | `GuardiansService` | Guardian | ⚠️ names and mobile | ❌ **direct** | ✅ |

`VERIFIED`

## 38.2 Declared but not produced

| Event | Why | Status |
| :--- | :--- | :--- |
| `person.sensitive_erased` | The erase operation is not built | `DEFERRED` |
| `student.deleted` | **There is no delete** | **Remove from the allowlist** |
| `applicant.person_resolved` | Documented in §35 and I2 §8; `WorkflowService` only logs | `RECOMMENDED` — publish it; binding a human to an application is exactly the kind of thing an identity audit needs |
| `admission.closed` | No close operation | `DEFERRED` — *"declaring it now would leave a name nothing publishes"* |
| `student.status_changed`, `.branch_transferred`, `.archived`, `.code_corrected` | Phase 6 | `DEFERRED` |
| `enrollment.bulk_promoted`, `.rollnumbers_assigned` | Phase 6 | `DEFERRED` |
| `guardianship.created/ended/primary_changed/financial_changed` | Guardianship not built | **BLOCKING** with §8 |
| `address.assigned`, `.verified` | S2 | `DEFERRED` |
| `document.*` | S3 | `DEFERRED` |

## 38.3 Deliberately not created

| Rejected | Why |
| :--- | :--- |
| `student.viewed` | Read volume would swamp the log. Reads are covered by request logging; **exports** are audited separately because that is the risky one |
| `numbering.allocated` | Thousands a day, inside other operations, and the number is already visible on the record. The event that matters is the **configuration** change |
| One event per student in a bulk promotion, **for audit** | One `enrollment.bulk_promoted` with counts. Individual `enrollment.created` rows still go to the outbox for downstream *state* |
| A separate `student.promoted` | Promotion is an **Enrollment** fact. Naming it after Student would imply Student changed — the exact misconception this design fights |

## 38.4 Naming and registration rules

1. All events live in `src/common/events/`, exported through `index.ts`.
   Module-local `events/` directories are **prohibited**. `VERIFIED`
2. Naming is `module.action` in `snake_case`, matching `AuditEventMapper`'s
   inference; where inference would be wrong, supply `metadata.action` and
   `metadata.module` explicitly.
3. **Every new event name must be added to `registeredEventNames` in
   `audit.listener.ts`. An unregistered event bypasses audit silently** — this
   is the most likely omission during implementation, and it has already
   happened once: `applicant.rejected` and `applicant.withdrawn` were declared
   in Phase 3 and not registered until Phase 5. `VERIFIED`

> **RECOMMENDED:** add a test that fails when a `DomainEvent` subclass's
> `EVENT_NAME` is absent from the allowlist. The failure mode is silent, the
> check is mechanical, and it has already caught two events the hard way.

---

# 39. Outbox

## 39.1 The problem it solves

> Publishing after a commit and hoping is fine for an annoyance and **fatal for
> `student.created`**: an in-process bus loses the event if the process dies
> between COMMIT and publish, leaving a Student no downstream module ever heard
> about — no fee schedule, no library membership, no portal account, and no way
> to discover the omission except by reconciliation.

## 39.2 The mechanism

```
eventBus.publish(event)       — fire and forget, lost on a crash
outbox.enqueue(event, tx)     — commits WITH the data, always delivered
```

> **The rule for choosing:** *if the event describes something a transaction
> just committed, it goes in the outbox; otherwise it publishes directly.* A
> login event has no transaction to attach to and gains nothing from the round
> trip. `DECIDED` `VERIFIED`

The outbox sits **behind** the `EventBus` abstraction, so **no consumer
changed** when it was introduced.

## 39.3 `OutboxEvent`

| Field | Purpose |
| :--- | :--- |
| `eventId` **@unique** | A relay retry cannot enqueue twice; consumers deduplicate on it |
| `eventName`, `aggregateType`, `aggregateId`, `occurredAt` | Identity of the event |
| `payload`, `metadata` | Stored separately so the relay rebuilds an event **faithful to what the producer published** |
| `contextSnapshot` | Actor and scope captured at write time — the relay has no request context |
| `organizationId` | Scoped querying |
| `status`, `attempts`, `nextAttemptAt`, `lastError` | Retry with backoff |
| `createdAt`, `publishedAt` | |
| `@@index([status, nextAttemptAt])` | The relay's only query |

`IMPLEMENTED` `VERIFIED`

## 39.4 Why the transaction client is explicit

`enqueue(event, tx)` takes the client **explicitly rather than discovering it
from AsyncLocalStorage**:

> Implicit discovery reads well until the day an event is silently written
> outside the transaction it was supposed to be part of, and nothing about the
> call site shows it.

## 39.5 Delivery semantics

**At least once.** Consequences that must be respected:

| Consumer | Requirement |
| :--- | :--- |
| Audit | `AuditLog.eventId @unique` — a duplicate publish cannot create a duplicate row `VERIFIED` |
| Communication | Must deduplicate, or a parent gets two welcome messages |
| Any future consumer | **Must be idempotent.** This is a contract, not a suggestion |

## 39.6 What does not go through the outbox

| Case | Mechanism | Correct? |
| :--- | :--- | :--- |
| `user.logged_in` | Direct | ✅ — no transaction to attach to |
| Context violations | Direct | ✅ |
| `numbering_config.created` | Direct | ⚠️ borderline — it *is* a committed write. Low volume, low consequence |
| **`guardian.*`** | Direct | ❌ **inconsistent with every other Phase 1–5 module** |

---

# 40. Error contract

## 40.1 The envelope

Every error is the canonical response envelope carrying `error` (a stable code),
`message` (safe for display) and optional structured details. **The core
lifecycle introduces no second envelope.** `DECIDED`

## 40.2 The complete matrix

`R?` = retryable · `Sens?` = could the details leak personal data?

| HTTP | Code | Meaning | Raised when | Safe message | R? | Details | Sens? |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| 400 | `INVALID_TRANSITION` | The edge is illegal from here | Workflow / enrollment | "Cannot `<action>` an application in state `<X>`." | ❌ | `from`, `action`, `allowedFrom[]` | no |
| 400 | `REMARKS_REQUIRED` | Blank is not a reason | A `REQUIRED` transition | "A reason is required to `<action>` an application." | after fixing | `action` | no |
| 400 | `CHANGE_REASON_REQUIRED` | Same, for placement | Supersede / cancel | "A reason is required to change a placement." | after fixing | — | no |
| 400 | `ORCHESTRATED_TRANSITION` | Not a status change | `admit` via the generic endpoint | "Admission is not a status change… use the admit operation." | ❌ | `action` | no |
| 400 | `PROGRAM_REQUIRED` | No programme | Submit / admit | "A programme must be selected…" | after fixing | — | no |
| 400 | `PROGRAM_OUT_OF_SCOPE` | Another branch's programme | Applicant create/update, admission | "The selected programme belongs to another branch." | ❌ | — | no |
| 400 | `PROGRAM_NOT_ACTIVE` | Inactive programme | Same | "The selected programme is not active." | ❌ | — | no |
| 400 | `ACADEMIC_UNIT_MISMATCH` | Unit ≠ branch/programme/year | Admit, enrollment FK | "The academic unit does not belong to…" | ❌ | — | no |
| 400 | `ACADEMIC_UNIT_INACTIVE` | Inactive unit | Admit | "The academic unit is not active." | ❌ | — | no |
| 400 | `ADMISSION_TYPE_NOT_A_FIRST_ENTRY` | Readmission/transfer type at `admit()` | Admit | "`<T>` begins from an existing student…" | ❌ | `allowed[]` | no |
| 400 | `NUMBERING_NOT_PROVISIONED` | Sequence missing (pre-flight) | Admit | "…Configure the sequences before admitting." | ❌ | `missing[]` | no |
| 400 | `NUMBERING_FORMAT_INVALID` | No `{sequence}` | Config create/update | "A sequence format must contain `{sequence}`…" | after fixing | — | no |
| 400 | `NUMBERING_FORMAT_MISSING_YEAR` | Yearly reset without `{year}` | Config create/update | "…must contain `{year}`." | after fixing | `purpose` | no |
| 400 | `NUMBERING_ACADEMIC_YEAR_REQUIRED` | Yearly sequence, no year | Allocate | "Sequence `<P>` resets yearly and requires an academic year." | ❌ | `purpose` | no |
| 400 | `SEQUENCE_WIDTH_IMMUTABLE` | Prefix/padding change after allocation | Config update | "…Its prefix and padding are frozen…" | ❌ | `purpose` | no |
| 400 | `OFFER_EXPIRED` | Lapsed offer | Confirm seat | "The offer has expired…" | ❌ | `offerExpiresAt` | no |
| 400 | `OFFER_NOT_EXPIRED` | Still live | Expiry sweep | "The offer has not expired." | ✅ later | — | no |
| 400 | `DEFERMENT_DISABLED` | Not enabled | Defer | "Deferment is not enabled for this institution." | ❌ | — | no |
| 400 | `STUDENT_DOB_INVALID` | Implausible date | Create / correct | "The date of birth is outside the plausible range." | after fixing | — | no |
| 400 | `STUDENT_SOURCE_APPLICANT_REQUIRED` | `ADMISSION` without a source | Create | "A student created through admission must record the application…" | ❌ | — | no |
| 400 | `PERSON_NAME_REQUIRED` | Empty normalized name | Resolve | "A name is required to resolve an identity." | after fixing | — | no |
| 400 | `GOVERNMENT_ID_INVALID` | Malformed identifier | Resolve / attach | "The supplied government identifier is not valid." | after fixing | **none — never echoes the value** | no |
| 400 | `GOVERNMENT_ID_TYPE_UNSUPPORTED` | Unsupported type | Attach | "That government identifier type is not supported." | ❌ | — | no |
| 400 | `MATCH_DECISION_SELF` / `_REASON_REQUIRED` | Bad match decision | Record distinct | — | after fixing | — | no |
| 400 | `ROLL_NUMBER_INVALID` | Blank roll number | Assign | "A roll number cannot be blank. Send null to clear it." | after fixing | — | no |
| 400 | `PLACEMENT_UNCHANGED` | No-op correction | Supersede | "The replacement placement is identical…" | ❌ | — | no |
| 400 | `ORIGIN_REQUIRES_SUPERSEDE` | Correction/transfer via create | Create initial | "…must go through the supersede operation." | ❌ | — | no |
| 400 | `PREFERENCES_EMPTY` / `PREFERENCE_DUPLICATE_PROGRAM` | Bad preference list | Replace | — | after fixing | — | no |
| 400 | `ADMISSION_INVALID` / `ENROLLMENT_INVALID` | A CHECK fired | Any write | "…violates an integrity rule." | ❌ | — | no |
| 400 | `ADMISSION_BRANCH_MISMATCH` | Student is elsewhere | Create admission | "The admission branch does not match…" | ❌ | — | no |
| 400 | `QUOTA_OUT_OF_SCOPE` / `ADMISSION_SOURCE_OUT_OF_SCOPE` | Foreign master | Create admission | "…not available to this organization." | ❌ | — | no |
| **403** | `ForbiddenException` | Missing permission / unauthenticated | Everywhere | "You do not have permission…" | ❌ | — | no |
| 403 | `SYSTEM_ACTION` | A human tried a system edge | Expire offer | "That action is performed by the system, not by a user." | ❌ | — | no |
| 403 | `ACADEMIC_YEAR_LOCKED` | Closed year | Admit, any placement write | "The academic year is locked…" | ❌ | `academicYearId` | no |
| 403 | `CLASS_LIST_LOCKED` | Register frozen | Assign roll number | "The class list is locked…" | ❌ | `academicUnitId` | no |
| 403 | *(plain)* | Editing a frozen applicant | Update / delete | "Cannot modify applicant in status `<X>`." | ❌ | — | no |
| **404** | `NotFoundException` | **Absent or out of scope — indistinguishable** | Every read and scoped write | "`<Entity>` not found" | ❌ | **none** | no |
| 404 | `ACADEMIC_UNIT_NOT_FOUND` / `PROGRAM_NOT_FOUND` | Missing structure | Admit, applicant | — | ❌ | — | no |
| **409** | `APPLICANT_NOT_SEAT_CONFIRMED` | Wrong state | Admit | "An application must have a confirmed seat…" | ❌ | `currentStatus` | no |
| 409 | `APPLICANT_ALREADY_ADMITTED` | Already converted | Admit | "This application has already been converted to a student." | **treat as success** | `studentId`, `studentCode` | no — **identifiers only** |
| 409 | `STUDENT_ALREADY_EXISTS` | Person is already a student | Admit | "…Returning students are readmitted… a separate operation." | ❌ until readmission | `studentId`, `studentCode`, `studentStatus` | no |
| 409 | `DUPLICATE_ACTIVE_APPLICATION` | One live application per person/branch/year | Submit | "This person already has a live application…" | ❌ | **none** | no |
| 409 | `ACTIVE_ADMISSION_EXISTS` | Second live spell | Create admission | "…Close it before opening another." | ❌ | `studentId` | no |
| 409 | `ENROLLMENT_EXISTS_FOR_YEAR` | Second live placement | Create / supersede | "This admission already has a live placement for that year." | ❌ | — | no |
| 409 | `ROLL_NUMBER_TAKEN` | Position occupied | Assign / supersede | "That roll number is already used in this class this year." | ✅ with another | — | no |
| 409 | `ENROLLMENT_CLOSED` | Historical row | Supersede / cancel / roll | "A placement in state `<X>` is history…" | ❌ | `enrollmentStatus` | no |
| 409 | `ENROLLMENT_ALREADY_SUPERSEDED` | Concurrent double correction | Supersede | "This placement has already been replaced." | ❌ | — | no |
| 409 | `ENROLLMENT_HAS_RESULT` | Examined year | Cancel | "A result has been recorded…" | ❌ | — | no |
| 409 | `STALE_ENROLLMENT_VERSION` | Optimistic conflict | Any enrollment write | "This placement changed after it was read. Reload it and try again." | **✅ after reload** | `expectedVersion`, `currentVersion` | no |
| 409 | `STUDENT_ARCHIVED` | Read-only | Correct | "An archived student is read-only…" | ❌ | — | no |
| 409 | `STUDENT_CODE_ALREADY_EXISTS` | **Generator fault** | Create | "The allocated student code is already in use." | ❌ | — | no — **and logged as a sequence misconfiguration** |
| 409 | `ADMISSION_NO_ALREADY_EXISTS` | Same, for admissions | Create | — | ❌ | — | no |
| 409 | `GOVERNMENT_ID_ALREADY_SET` | Already bound | Attach | "…Correcting it is a separate, audited operation." | ❌ | — | no |
| 409 | `GOVERNMENT_ID_ALREADY_ASSOCIATED` | Taken by another identity | Attach | "…already associated with another identity." | ❌ | **none — names no person** | no |
| 409 | `NUMBERING_CONFIG_EXISTS` | Duplicate sequence | Create config | — | ❌ | `configId` | no |
| 409 | `APPLICANT_FROZEN` | Frozen application | Replace preferences | — | ❌ | — | no |
| **500** | `NUMBERING_NOT_PROVISIONED` | Sequence missing at allocation | Allocate | "No active `<P>` sequence is provisioned…" | ❌ | `purpose`, `scope` | no |
| 500 | `NUMBERING_ALLOCATION_FAILED` | Allocation returned nothing | Allocate | — | ✅ | — | no |
| 500 | `NUMBERING_API_REMOVED` | A caller on the removed API | — | — | ❌ | — | no |

`IMPLEMENTED` `VERIFIED`

## 40.3 Proposed future errors

`PROPOSED` — clearly marked as not existing:

| HTTP | Code | For |
| :--- | :--- | :--- |
| 409 | `DOCUMENTS_INCOMPLETE` | Unsatisfied mandatory requirements at the stage (S3) |
| 409 | `CAPACITY_EXCEEDED` | Section full (§22) |
| 409 | `TRANSFER_BLOCKED` | Open workflows at the source branch — with `blockers[]` |
| 409 | `READMISSION_REQUIRES_CLOSED_ADMISSION` | Previous spell still `ACTIVE` |
| 403 | `EXPELLED_READMISSION_REQUIRES_ELEVATION` | Readmitting an expelled student |
| 409 | `STUDENT_CODE_CORRECTION_WINDOW_CLOSED` | Certificates already issued |
| 409 | `SECOND_PRIMARY_GUARDIAN` / `SECOND_FINANCIAL_GUARDIAN` | Guardianship exclusivity |
| 400 | `GUARDIAN_IS_WARD` | Self-guardianship |
| 409 | `DUPLICATE_GUARDIANSHIP` | Pair already linked |

## 40.4 Contract rules

1. **A scope miss is always `404`.** Never `403`.
2. **An error never echoes a sensitive value back.** The caller already knows
   what it sent.
3. **A conflict names identifiers, never people.** `studentId` and `studentCode`
   are safe — a code is designed to be printed. A name or a mobile is not.
4. **A constraint violation is always translated.** A raw `P2002` naming an index
   the caller has never heard of is not a contract.
5. **`409` is informative.** It tells the client what exists so a duplicate
   submission can be treated as the completed operation it is.

---

# 41. Cross-module contract

## 41.1 The rule, stated as a rule

> **Consumers depend inward on Person, Student, Admission and Enrollment. None
> of those four ever imports a consumer.**
>
> Adding Attendance in 2027 or Alumni in 2031 touches Student's schema **zero
> times**. That is the property this whole design exists to guarantee.

```
                    ┌──────────┐
                    │  Person  │  ← identity
                    └────┬─────┘
                    ┌────▼─────┐
                    │ Student  │  ← permanent learner
                    └────┬─────┘
                    ┌────▼─────┐
                    │Admission │  ← spell of study
                    └────┬─────┘
                    ┌────▼─────┐
                    │Enrollment│  ← year placement
                    └────▲─────┘
        ┌────────┬───────┼────────┬─────────┬──────────┐
   Attendance  Exams   Fees   Timetable  Certificates  …
        └────────┴───────┴────────┴─────────┴──────────┘
                  every arrow points UP
```

## 41.2 Which id to reference

| Module | `studentId` | `enrollmentId` | `admissionId` | `personId` | Why |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Attendance** | ✅ denormalized | ✅ **primary** | | | Attendance is a fact about a *placement in a year*. `enrollmentId` makes year-scoping automatic and stops Std 9 attendance leaking into Std 10 |
| **Examination / marks** | ✅ denormalized | ✅ **primary** | | | A student who **repeats** Std 9 has two enrollments and two independent result sets — impossible on `studentId` alone |
| **Fees — invoice / demand** | | ✅ **primary** | | | The liability arises from a year's placement; fee structures are branch-and-year scoped |
| **Fees — receipt / ledger / credit note** | ✅ **primary** | ⚠️ optional | | | Money is held against the *person's account*, and a credit from 2026 must be usable in 2027. Splitting the ledger by year makes carry-forward impossible |
| **Library** | ✅ **primary** | | | | A book borrowed in Std 9 and returned in Std 10 must not straddle two enrollments |
| **Transport** | ✅ **primary** + `academicYearId` + validity window | ❌ | | | A student on a **superseded** enrollment must not lose their bus seat |
| **Hostel** | ✅ **primary** + year + window | ❌ | | | Same |
| **Communication** | ✅ *about whom* | | | ✅ *to whom* | Recipients are **Persons** (guardians are Persons). Audience *selection* queries Enrollment ("all of Std 9-A"); the delivery record targets a Person |
| **Certificates — TC** | | | ✅ **primary** | | A TC certifies a **spell of study** — entry, exit, reason |
| **Certificates — bonafide, marksheet** | | ✅ **primary** | | | Certifies a placement in a year |
| **Certificates — character** | | | ✅ **primary** | | Covers the whole spell |
| **Documents** | ✅ or | ✅ or | ✅ or | ✅ | Polymorphic owner, per §11.3 |
| **Parent portal** | ✅ via Guardianship | ✅ current year | | ✅ | Resolves from the **authenticated principal**, never a path parameter |
| **Alumni** | ✅ **primary** | | ⚠️ which spell | | An alumnus is a person who **was** a student |
| **Discipline** | ✅ **primary** | ⚠️ context | | | Follows the student across years |
| **Health records** | ✅ **primary** | | | | A student-role fact |
| **Reports / analytics** | ✅ | ✅ | ✅ | ✅ | Reads everything; **writes nothing** |

## 41.3 The rule that generalises it

> **Store `enrollmentId`** when the fact would be wrong if attached to a
> different academic year.
> **Store `studentId`** when the fact would be wrong if it disappeared at
> promotion.
> **Store `admissionId`** when the fact is about a spell of study.
> **Store `personId`** when the fact is about the human regardless of role.

Most academic modules attach to **Enrollment**, and that is what makes
year-scoping automatic rather than something every query has to remember.

## 41.4 Forbidden edges

| Forbidden | Prevented by |
| :--- | :--- |
| `enrollment → admissions` | **No import exists.** The schema holds `admissionId`; the module holds no reference `VERIFIED` |
| `student → document` | `photoDocumentId` is a plain `String?` with **no foreign key** `VERIFIED` |
| `student → guardian` | No relation. *(Correct — but for the wrong reason today: the relation should exist via Person)* |
| `identity → admissions` | `PersonService` and `StudentService` import nothing from admissions `VERIFIED` |
| Any business module → `AuditService` | Audit consumes events `VERIFIED` |
| Any module → a second numbering generator | One engine, one `SequencePurpose` enum `VERIFIED` |
| A consumer requiring a column on Student | §41.2 gives every module a reference target; **none needs one** |

## 41.5 What a consumer may rely on

| Guarantee | Backed by |
| :--- | :--- |
| `studentId` never changes and is never reused | No update path; no delete |
| `studentCode` is stable and printable | §18.5 |
| `enrollmentId` identifies exactly one placement in one year | `enrollment_one_primary_per_year` |
| An enrolment's `studentId` always matches its admission's | Composite FK |
| An enrolment's unit always belongs to its branch, programme and year | Composite FK |
| `student.created`, `admission.created` and `enrollment.created` are **never lost** | Transactional outbox |
| A superseded enrolment always names its successor | `enrollment_supersede_check` + `enrollment.superseded` event |
| Academic history is never deleted | No delete path anywhere |
| A row outside your scope reads as absent | 404-not-403 |

## 41.6 What a consumer must do

1. **Be idempotent.** Delivery is at least once.
2. **Consume `enrollment.superseded`** if you hold rows against an
   `enrollmentId` — attendance and marks hold references to the **old** id, and
   a create event alone would tell them a new row exists but not that their own
   reference has been retired.
3. **Never write to a core table.** Reference inward.
4. **Never treat `studentCode` as a key.**
5. **Never assume a guardian, address or document exists** — today none of the
   three is reachable from a Student.

---

# 42. Edge cases

Thirty-six cases, each with its **expected business result** and whether the
system produces it today.

| # | Case | Expected business result | Today |
| :--- | :--- | :--- | :--- |
| 1 | **Duplicate Person** — same human, two rows | Only possible when neither row has a government identifier. Both remain; a `LOW`/`MEDIUM` candidate warning is raised; a merge later collapses them. `resolve()` on a shared identifier always returns one row. | ✅ prevented where an identifier exists; merge `DEFERRED` |
| 2 | **Duplicate Applicant** — same person, same branch, same year | The **second submission** fails: `409 DUPLICATE_ACTIVE_APPLICATION`. Two *drafts* are permitted — a draft has no `personId`. | ✅ `applicant_one_active` |
| 3 | **Twins** | **Both are admitted, as two Students.** Demographic matching never merges; the second gets a warning naming the first, which staff dismiss once and `PersonMatchDecision` remembers. | ✅ |
| 4 | **Same guardian for siblings** | One guardian Person, two guardianships, both children under one login | ❌ **two `Guardian` rows, no dedup, no login** — §8 |
| 5 | **Same guardian across branches** | Both children visible to one guardian | ❌ **impossible** — `Guardian.branchId` is required |
| 6 | **Guardian duplicate** | Resolved to one Person on the government identifier | ❌ no Person link |
| 7 | **No guardian** | Permitted for an adult learner; required below a configurable age | ⚠️ **always permitted, nothing checks** |
| 8 | **Two primary guardians** | `409` | ❌ **silently allowed**, and the toggle can leave **zero** |
| 9 | **Two financial guardians** | `409` | ❌ **silently allowed** — billing becomes non-deterministic |
| 10 | **Missing mandatory document** | `approve` refused; the applicant sits in `DOCUMENT_PENDING` | ⚠️ **guard passes unconditionally** |
| 11 | **Document rejected** | Requirement unsatisfied; a new version resets verification to `PENDING` | `DEFERRED` (S3) |
| 12 | **Document expired** | Flagged and notified. **The admission is unaffected** — an expired caste certificate is an administrative task | `DEFERRED` (S3) |
| 13 | **Rejected applicant reapplies** | A **new** Applicant. `REJECTED` is excluded from `applicant_one_active`, so it is permitted. Same Person, so the reviewer sees the history. The 2026 record stays readable. | ✅ |
| 14 | **Cancelled applicant reapplies** | Same as 13 — `CANCELLED` is excluded. **Or** the original is reopened by an audited `forceReopen` (`WARN`) | ✅ both paths |
| 15 | **Applicant deferred** | The 2026 row stays `DEFERRED` forever; a **new** 2027 Applicant carries `deferredFromApplicantId`; same Person; same eventual `studentCode`. `DEFERRED` is excluded from `applicant_one_active`, so the new one is permitted | ✅ shape · ⚠️ **off by default**, and the re-application helper is not built |
| 16 | **Seat confirmed but `admit()` fails** | **Everything rolls back.** The applicant stays `SEAT_CONFIRMED`, retryable. A `MONOTONIC` number is burned — a gap, acceptable | ✅ **verified by fault injection at all six steps** |
| 17 | **Concurrent admit** | One student, one admission, one enrolment, one code; every other request gets `409` naming what exists | ✅ **verified at 20× concurrency** |
| 18 | **Existing Student found during admission** | Readmission: reuse the Student, open Admission #2 | ⚠️ **`409 STUDENT_ALREADY_EXISTS`** — a deliberate, documented refusal; the Phase 6 entry point |
| 19 | **Student readmission** | New Admission with `previousAdmissionId`; same `studentId`, `studentCode`, `personId` | `DEFERRED` — **shape asserted by test** |
| 20 | **Student repeats a year** | New Enrollment, same unit, `isRepeat: true`, old row `DETAINED`; **no new Admission** | `DEFERRED` — shape ready |
| 21 | **Student promotion** | New Enrollment, next unit; old row `PROMOTED`; same Admission | `DEFERRED` — **shape asserted by test** |
| 22 | **Section transfer** | Supersede: old `SUPERSEDED` naming its successor, new row `originType: TRANSFER` | ✅ `IMPLEMENTED` |
| 23 | **Branch transfer** | Admission #1 `TRANSFERRED_OUT`, #2 opened with a **new `admissionNo`**, `Student.branchId` moves, **`studentCode` unchanged** | `DEFERRED` — **shape asserted by test** |
| 24 | **Roll collision** | `409 ROLL_NUMBER_TAKEN`. Excludes `SUPERSEDED`/`CANCELLED`, so a corrected row frees its position | ✅ |
| 25 | **Capacity reached** | Refuse, or warn, per configuration | ❌ **no capacity exists** — stated, not hidden |
| 26 | **Concurrent capacity race** (40 / 39 / two requests) | One admitted, one refused | ❌ — §22.3 gives the correct shape |
| 27 | **Capacity override** | Elevated permission, mandatory reason, `WARN` audit | `PROPOSED` |
| 28 | **Academic year locked** | Every placement write refused with `403 ACADEMIC_YEAR_LOCKED`; reads unaffected. An administrator locking a year **while a correction is in flight waits** for it and then succeeds — `FOR SHARE` | ✅ |
| 29 | **Academic unit inactive** | `400 ACADEMIC_UNIT_INACTIVE` at admit | ✅ at admit · ⚠️ **not re-checked** in `createInitialEnrollment`, which matters only for the importer |
| 30 | **Programme inactive** | `400 PROGRAM_NOT_ACTIVE` at applicant create/update and at admission | ✅ |
| 31 | **Guardian mapping failure** | The previous primary is unchanged | ❌ **the child is left with no primary guardian** |
| 32 | **Address update** | New `Address`, links closed and opened, history preserved, the applicant snapshot untouched | `DEFERRED` (S2) — today an in-place column edit on Applicant or Guardian, **losing history** |
| 33 | **Document upload failure** | Nothing stored; no partial document | `DEFERRED` (S3) |
| 34 | **Outbox failure** | **The event row is committed data.** The relay publishes on its next pass with backoff; `eventId` uniqueness makes a duplicate harmless | ✅ |
| 35 | **Audit failure** | Logged and swallowed — **an audit failure never fails the business operation**. The event row survives regardless | ✅ |
| 36 | **Configuration changed after records exist** | Stamped values do not move; numbering values are persisted, not recomputed; identity sequence width is frozen | ✅ — §34.6 |

## 42.1 Six further cases this reconciliation surfaced

| # | Case | Expected | Today |
| :--- | :--- | :--- | :--- |
| 37 | **Applicant with a government identifier, admitted at two branches simultaneously** | One Person; the second admission refused | ✅ `@@unique([organizationId, personId])` — **verified** |
| 38 | **Applicant *without* a government identifier** | One Person, bound at submit and **reused** at admit | ✅ — this was the Phase 5.5 defect, now fixed and **tested** |
| 39 | **Second academic year for one branch** | `ADMISSION_NO` restarts and **does not collide** | ✅ — the second Phase 5.5 defect: provisioning now refuses a yearly sequence whose format renders no year |
| 40 | **Deleting an applicant that produced a student** | **Refused** | ✅ — `Enrollment.applicantId` is `onDelete: Restrict`, verified even after the placement is cancelled |
| 41 | **A migrated student's guardian** | Reachable | ❌ **unreachable — `sourceApplicantId` is null and there is no other path** |
| 42 | **Cross-tenant master attached to an applicant** | Refused | ❌ **accepted** — V6 |

---

# 43. Database invariants

## 43.1 Enforced by the database

| # | Invariant | Mechanism | Table |
| :--- | :--- | :--- | :--- |
| INV-PER-001 | One Person per government identifier per organization | `@@unique([organizationId, govtIdHash])` | Person |
| INV-PER-002 | One sensitive record per Person | `PersonSensitive.personId @unique` | PersonSensitive |
| INV-PER-003 | One match decision per ordered pair | `@@unique([personAId, personBId])` | PersonMatchDecision |
| INV-APP-001 | Form number unique per branch+year | `@@unique([branchId, academicYearId, admissionFormNo])` | Applicant |
| INV-APP-002 | Application number unique per branch+year | `@@unique([branchId, academicYearId, applicationNo])` | Applicant |
| INV-APP-003 | **One live application per person per branch per year** | `applicant_one_active` partial unique, excluding `REJECTED`/`WITHDRAWN`/`CANCELLED`/`DEFERRED` | Applicant |
| INV-APP-004 | `personId` present from `SUBMITTED` | `applicant_person_from_submitted_check` — **`NOT VALID`** | Applicant |
| INV-APP-005 | `programId` present from `SUBMITTED` | `applicant_program_from_submitted_check` — **`NOT VALID`** | Applicant |
| INV-APP-006 | Offer window paired and ordered | `applicant_offer_window_check` | Applicant |
| INV-APP-007 | No self-deferral | `applicant_no_self_deferral_check` | Applicant |
| INV-APP-008 | Preference order ≥ 1 | `preference_order_positive_check` | Preference |
| INV-APP-009 | One preference per position, one per programme | two `@@unique` | Preference |
| INV-STU-001 | One Student per Person | `personId @unique` **and** `@@unique([organizationId, personId])` | Student |
| INV-STU-002 | `studentCode` unique per organization | `@@unique([organizationId, studentCode])` | Student |
| INV-STU-003 | **One Student per Applicant** | `student_one_per_applicant` partial unique | Student |
| INV-STU-004 | A non-migrated Student names its application | `student_origin_check` | Student |
| INV-STU-005 | Plausible DOB | `student_dob_plausible_check` | Student |
| INV-STU-006 | Non-blank code and display name | two CHECKs | Student |
| INV-ADM-002 | **One `ACTIVE` Admission per Student** | `admission_one_active` partial unique | Admission |
| INV-ADM-003 | `admissionNo` unique per branch | `@@unique([branchId, admissionNo])` | Admission |
| INV-ADM-004 | A closed admission carries **both** a date and a reason | `admission_exit_check` | Admission |
| INV-ADM-005 | An open admission has **neither** | `admission_open_has_no_exit_check` | Admission |
| INV-ADM-006 | Exit ≥ entry | `admission_exit_after_entry_check` | Admission |
| INV-ADM-007 | No self-chain | `admission_no_self_chain_check` | Admission |
| INV-ENR-002 | **One live `PRIMARY` placement per admission per year** | `enrollment_one_primary_per_year`, excluding `SUPERSEDED`/`CANCELLED` | Enrollment |
| INV-ENR-003/004 | An enrolment's student **and** branch are its admission's | composite FK | Enrollment |
| INV-ENR-005/006 | A superseded row names its successor **and** says why | `enrollment_supersede_check` | Enrollment |
| INV-ENR-007 | A roll number is unique in one class register in one year | `enrollment_rollno_unique` | Enrollment |
| INV-ENR-008 | A correction or transfer names what it replaces and why | `enrollment_provenance_check` | Enrollment |
| INV-ENR-009 | A replacement is claimed by at most one predecessor | `supersededById @unique` | Enrollment |
| INV-ENR-010 | The unit belongs to this branch, programme **and** year | composite FK | Enrollment |
| INV-ENR-014 | No self-chain, no self-supersede | `enrollment_no_self_chain_check` | Enrollment |
| INV-ENR-015 | Exit ≥ creation | `enrollment_exit_order_check` | Enrollment |
| INV-ENR-016 | `CANCELLED`/`DROPPED_OUT` carry a date and a reason | `enrollment_exit_pair_check` | Enrollment |
| INV-ENR-017 | A roll number is never blank | `enrollment_rollno_nonblank_check` | Enrollment |
| INV-NUM-001 | One counter per config per reset window | Functional unique index over `COALESCE(academicYearId, sentinel)` | Counter |
| INV-NUM-002 | One config per purpose per scope | Two partial unique indexes | Config |
| INV-AUD-001 | One audit row per event | `AuditLog.eventId @unique` | AuditLog |
| INV-OBX-001 | One outbox row per event | `OutboxEvent.eventId @unique` | OutboxEvent |

`IMPLEMENTED` `VERIFIED`

## 43.2 The two `NOT VALID` constraints

Both are **enforced on every insert and every update**; only the initial scan of
existing rows is skipped.

```
Reason:  one applicant reached SUBMITTED before either column existed —
         019f8f56-ece4-71d0-8b71-054cd7e234ea, SUBMITTED since 2026-07-23,
         with no person and no programme, and no Enrollment to derive one from.

Why NOT VALID rather than the alternatives:
  permanently nullable  → a temporary data problem becomes a permanent schema scar
  back-fill             → inventing a programme choice nobody made
  delete the row        → not a migration's call to make

State:   the development database still holds the row.
         The test database has ZERO violations and could be validated today.
         Validating one environment and not the other would be a divergence
         waiting to surprise a deploy, so both stay as they are.

To finish:  resolve or delete that row, then run the two VALIDATE CONSTRAINT
            statements carried in the Phase 3 migration.
```

`VERIFIED` · **REQUIRED REFINEMENT** — low risk, one row.

## 43.3 Enforced only by application code

These **cannot** be database constraints and therefore need explicit tests:

| # | Invariant | Why not a constraint | Tested |
| :--- | :--- | :--- | :--- |
| INV-ADM-001 | An admission happens where the student is | `Student.branchId` is a **mutable pointer**; a composite key on it would break every admission the moment a student transfers | ✅ |
| INV-ENR-011 | No write lands in a locked year | Spans tables | ✅ |
| INV-ENR-013 | Only Examination writes `resultOutcome` | Authorship is not expressible in SQL | ✅ by absence — no route can |
| INV-STU-007 | No hard delete | Absence of a code path | ✅ |
| INV-STU-008 | `studentCode` is never recomputed | Absence of a code path | ✅ |
| INV-GRD-001 | **At most one primary guardian per ward** | Would be a partial unique index — **the index does not exist** | ❌ |
| INV-GRD-002 | **At most one financial guardian per ward** | Same | ❌ |
| INV-GRD-003 | Nobody is their own guardian | Would be a CHECK | ❌ n/a today |
| INV-SEC-001 | Every read is scoped | Code discipline | ✅ **except guardians** |

## 43.4 Constraints the target model needs

`RECOMMENDED`:

```sql
-- Guardianship (§8)
CREATE UNIQUE INDEX guardianship_one_primary
    ON "Guardianship" ("wardPersonId")
 WHERE "isPrimary" AND "endedAt" IS NULL;

CREATE UNIQUE INDEX guardianship_one_financial
    ON "Guardianship" ("wardPersonId")
 WHERE "isFinancialGuardian" AND "endedAt" IS NULL;

ALTER TABLE "Guardianship"
  ADD CONSTRAINT guardianship_not_self
  CHECK ("guardianPersonId" <> "wardPersonId");

ALTER TABLE "Guardianship"
  ADD CONSTRAINT guardianship_pickup_window
  CHECK ("pickupValidTo" IS NULL OR "pickupValidFrom" < "pickupValidTo");

-- Preferences, WITH the allotment operation (§12.4)
CREATE UNIQUE INDEX pref_one_allotted
    ON "ApplicantProgramPreference" ("applicantId")
 WHERE "status" = 'ALLOTTED';

-- Address (§10.6), when S2 lands
CREATE UNIQUE INDEX person_address_current
    ON "PersonAddress" ("personId", "addressType")
 WHERE "validTo" IS NULL;
```

> The guardian indexes are the point of the whole refinement: **the service
> stops needing to be careful because the invalid state becomes
> unrepresentable.**

---

# 44. Concurrency

## 44.1 Isolation and the locking rule

`READ COMMITTED` everywhere. Every invariant has an **explicit lock or an
explicit constraint**, so `SERIALIZABLE` would add retries for no gain.
`DECIDED` `VERIFIED`

> **Lock first, decide second.** `findUnique` and `findFirst` take **no** lock,
> so a service that reads a status, checks it and then writes is racing every
> other caller doing the same. Under `READ COMMITTED` a blocked `FOR UPDATE`
> **re-reads after the winner commits**, which is what makes the state check
> meaningful rather than decorative.

## 44.2 `RowLockService`

| Property | Detail |
| :--- | :--- |
| Mechanism | `SELECT … FROM "<Table>" WHERE id = $1 AND <scope…> FOR UPDATE/SHARE` via `$queryRaw` — **Prisma has no row-lock API** |
| Table safety | A table name cannot be a bound parameter, so it is interpolated — behind a **compile-time allowlist** (`Applicant`, `Enrollment`, `AcademicYear`). A typo fails to compile rather than reaching the database |
| Scope | Every supplied dimension is ANDed into the `WHERE`; an out-of-scope row is **not returned**, indistinguishable from absent |
| Column read-back | Only the named columns, under the lock |
| `SHARE` mode | For a row that must be **read consistently** but not changed |
| `noWait` | Available, off by default — *"the normal case is a brief wait, and a caller that cannot wait usually wants a queue rather than an error"* |

`IMPLEMENTED` `VERIFIED`

## 44.3 Scenario matrix

| Scenario | Mechanism | Outcome |
| :--- | :--- | :--- |
| Two registrars **transition** one applicant | `FOR UPDATE` + re-read + `from` check | One wins; the other gets `400 INVALID_TRANSITION` naming the new state |
| Two registrars **admit** one applicant | `FOR UPDATE` + re-assert `SEAT_CONFIRMED` | One student; the other gets `409 APPLICANT_ALREADY_ADMITTED` **naming it** |
| 20 concurrent admits | Lock + three unique constraints | 1 success, 19 informative conflicts. **Verified** |
| **Same child admitted at two branches at once** | `@@unique([organizationId, personId])` | One Person resolves both; the second admission is refused **rather than splitting the record**. **Verified** |
| Two submissions for one person, one branch, one year | `applicant_one_active` — **at commit**, because the guard cannot see an uncommitted row | The loser gets `409 DUPLICATE_ACTIVE_APPLICATION`, not a leaked `P2002` |
| Concurrent `PersonService.resolve` on one identifier | Unique violation + **savepoint** + re-read | Both callers get the **same** Person; the loser adopts the winner's row |
| **Concurrent `resolve` inside a caller's transaction** | The savepoint | The caller's transaction stays healthy and everything it had written survives |
| Two corrections on one placement | Lock the old row **first** | The loser sees `SUPERSEDED` and fails **having written nothing** |
| Concurrent double correction slipping past the lock | `supersededById @unique` | `409 ENROLLMENT_ALREADY_SUPERSEDED` |
| Bulk promotion vs an administrator editing one placement | Row lock + optimistic `version` | The second sees `409 STALE_ENROLLMENT_VERSION` |
| Locking a year while a correction is in flight | `FOR SHARE` on `AcademicYear` | The lock **waits** for the correction, then succeeds. The correction cannot commit into a year that closed underneath it |
| Two roll-number assignments to the same position | `enrollment_rollno_unique` | `409 ROLL_NUMBER_TAKEN` — **no lock needed**, the index is the arbiter |
| Concurrent number allocation | `INSERT … ON CONFLICT … DO UPDATE … RETURNING` — **one statement** | Serialised at the counter row; no read-then-write window |
| Offer expiry vs seat confirmation at the same instant | Complementary comparisons (`<` and `>=`) + the row lock | **Exactly one can win** |
| Two capacity checks at 39/40 | — | ❌ **would both succeed** — §22.3 |

## 44.4 The numbering counter — the one shared bottleneck

```sql
INSERT INTO "NumberSequenceCounter" (id, configId, academicYearId, currentValue, updatedAt)
VALUES ($1, $2, $3, 1, now())
ON CONFLICT (configId, COALESCE(academicYearId, '000…000'))
DO UPDATE SET currentValue = currentValue + 1, updatedAt = now()
RETURNING currentValue
```

Three properties earn their place:

1. **Find-or-create and increment in one statement.** The previous
   find-then-create had a `catch` that could not work: once the `create` raised
   inside a transaction Postgres had aborted it, so the `findFirst` in the
   handler failed with *"current transaction is aborted"*. **That fired the
   first time any sequence was allocated inside a transaction — which is exactly
   what `admit()` does.**
2. **The `ON CONFLICT` target must name the identical expression as the
   functional unique index**, or inference fails and every call inserts a new
   counter. Postgres treats NULLs as distinct, so a plain
   `UNIQUE (configId, academicYearId)` would not constrain `NEVER`-reset
   counters at all — every allocation would return 1 and issue duplicates
   indefinitely.
3. **`MONOTONIC` runs on `this.prisma`, not on the caller's `tx`**, so the
   counter lock is held for microseconds rather than for the length of an
   admission. `GAPLESS` deliberately does the opposite.

**Placeholders resolve *before* the counter is touched** — every read between
the increment and the caller's commit is lock-hold time that every concurrent
allocation for that scope queues behind. `IMPLEMENTED` `VERIFIED`

## 44.5 Deadlock avoidance

**Always lock in the same order.** The established sequence:

```
Applicant  →  (Student)  →  AcademicYear (SHARE)  →  Enrollment
```

`admit()` locks the Applicant **as its first statement**. `AcademicYear` is
always taken in `SHARE` mode, so year locks never conflict with each other. A
capacity check would insert `AcademicUnit` after the Applicant and before the
Student, consistently (§22.3).

**No transaction contains network I/O** — no HTTP, no SMS, no email, no upload,
no virus scan. A transaction never publishes to `EventBus` directly; it writes
outbox rows. `DECIDED` `VERIFIED`

## 44.6 Headroom

The one shared bottleneck is the `STUDENT_CODE` counter row: one per
organization, held for microseconds. At an admission every second for eight
hours a day it is idle by three to four orders of magnitude. **No sharding, no
queue, no second engine.** `RECOMMENDED` — revisit only on measurement.

---

# 45. Testing requirements

## 45.1 The governing principle

> **Test what the database enforces by trying to break it with raw SQL.**
> Through the service layer, a test proves only that today's code is careful.

## 45.2 What exists

| Suite | Files | Covers |
| :--- | :--- | :--- |
| Unit | 40+ | Services with a mocked Prisma; the transition tables' **exhaustiveness against the enum** |
| Integration (real Postgres) | `person`, `student`, `admissions`, `admission-workflow`, `admit`, `enrollment`, `numbering`, `outbox`, `database` | Constraints, locks, transactions |
| **Pipeline** | `pipeline.integration-spec.ts` | **The whole chain as one system** |
| E2E | `admit.e2e-spec.ts` + 12 others | HTTP, guards, envelope |

`VERIFIED`

## 45.3 What the pipeline test asserts

Not a repeat of the phase suites — the **composed** invariants:

| Group | Assertions |
| :--- | :--- |
| Golden path | One of each row per admission; the student links to **the person the application already had**, with and without a government identifier |
| Traceability | Forward from the applicant, and **backwards from a student code with no demographic search** |
| History | The transition is recorded once, with its actor |
| Student code | Unique, org-scoped, **unrelated to the branch**; restarts in another organization; **survives a rollback without being reissued**; **never a foreign key anywhere** |
| Survival | The applicant a student descends from **cannot be deleted** — even after the placement is cancelled; the Person survives |
| Separation | **No academic placement on Student**; "where is this student now?" answered **without a stored pointer**; identity cryptography stays inside the Person boundary |
| Future shapes | One admission carrying a second year with no new student or code; a **returning student** opening a second spell without a new identity; a **branch move** representable without touching identity |
| References | Each future module gets **a single correct reference** |
| Reporting | The four counts stay distinct |
| Isolation | Two organizations kept apart **at every layer** |

**This is the test that found both Phase 5.5 defects**, neither of which was
reachable from any phase suite. `VERIFIED`

## 45.4 Required additional tests

`RECOMMENDED`, in priority order:

| # | Test | Why | Priority |
| :--- | :--- | :--- | :--- |
| T1 | **Raw SQL: two active primary guardians for one ward** | Must be rejected. **Fails today** | **BLOCKING** |
| T2 | **Raw SQL: two active financial guardians** | Must be rejected. **Fails today** | **BLOCKING** |
| T3 | **Primary handover fails mid-operation** | The original must **still be primary**. Fails today | **BLOCKING** |
| T4 | **Cross-tenant guardian read by UUID** | Must be `404`. Fails today | **BLOCKING** |
| T5 | Guardianship survives conversion untouched | The stated architectural property. Cannot pass today | **BLOCKING** |
| T6 | Cross-tenant master attached to an applicant | Must be refused (V6) | HIGH |
| T7 | Every `DomainEvent` subclass's `EVENT_NAME` is in the audit allowlist | A silent failure mode that has already occurred twice | HIGH |
| T8 | No event payload contains a mobile, an email or a name | Extends the existing Aadhaar assertion | HIGH |
| T9 | Raw SQL: `SUBMITTED` applicant with a null `personId`/`programId` | Proves the `NOT VALID` constraints bite | MEDIUM |
| T10 | Two guardians in one household on the same mobile | Person `phoneHash` is a weak signal — must not merge | MEDIUM |
| T11 | Sibling derivation across two branches | The org-scoping requirement | with §8 |
| T12 | Applicant DOB plausibility | V5 | LOW |
| T13 | Capacity race at 39/40 | Ahead of implementing §22 | with §22 |
| T14 | `admit()` with a **deactivated** numbering config | Should be `400`, not `500` (V8) | LOW |

## 45.5 Coverage gates

| Area | Requirement |
| :--- | :--- |
| Every database constraint in §43.1 | One **raw SQL** test proving it fires |
| Every error code in §40.2 | One test asserting status **and** code |
| Every transition edge | One test; plus exhaustiveness against the enum |
| Every service taking `tx` | A test asserting it **joins** rather than opening its own |
| Every rollback path in `admit()` | Fault injection at each step **and after the last** |
| Every concurrency scenario in §44.3 | A real-Postgres test |

---

# 46. Known defects

Ordered by severity. Every one is `VERIFIED` in the repository on 2026-08-12.

## 46.1 Blocking

| # | Defect | Location | Impact |
| :--- | :--- | :--- | :--- |
| **D1** | **Guardianship is Applicant-scoped, not Person↔Person.** Guardians do not survive conversion; a migrated student can never have one | `guardian.prisma`, `guardians.service.ts` | The parent portal, fee dunning, emergency contact, pickup authorisation and sibling derivation all rest on a relationship that evaporates at admission |
| **D2** | **No tenant or branch scoping on any guardian operation, and no permission on any guardian route.** `GET /guardians/:id` returns a **full plaintext Aadhaar** cross-tenant | `guardians.service.ts`, `guardians.controller.ts` | Cross-tenant read **and write** of personal data. The most serious security finding |
| **D3** | **Primary-guardian exclusivity is not transactional** — `updateMany` then `upsert`, no transaction | `guardians.service.ts:110-144` | A failed upsert leaves the child with **no primary guardian**, silently |
| **D4** | **`isFinancialGuardian` has no exclusivity at all** | `guardians.service.ts:132,140` | Three financial guardians; the fee module invoices arbitrarily |

## 46.2 High

| # | Defect | Location | Impact |
| :--- | :--- | :--- | :--- |
| **D5** | Guardian search matches Aadhaar by **substring** | `guardians.service.ts:81` | Any staff user can probe identifier digits branch-wide |
| **D6** | Applicant master validation ignores `organizationId` | `applicant.service.ts:405-491` | Another tenant's master can be attached to an applicant (V6) |
| **D7** | Re-mapping a guardian **silently clears** unmentioned flags | `guardians.service.ts:136-143` | Changing a relation type demotes the primary guardian |

## 46.3 Medium

| # | Defect | Location | Impact |
| :--- | :--- | :--- | :--- |
| **D8** | Guardian events bypass the outbox and **carry name and mobile** | `guardians.service.ts` | Lost events on a crash; PII in `AuditLog.payload` |
| **D9** | `applicant.created` carries `primaryMobile` | `applicant.service.ts:181` | Contact data in the audit log |
| **D10** | **No `WorkflowHistory` birth row** for Admission or Enrollment | `admission.service.ts`, `enrollment.service.ts` | `GET /enrollments/:id/history` returns `[]` for a freshly admitted student |
| **D11** | `numbering_config.updated` publishes **no event** | `numbering.service.ts:updateConfig` | Editing a format silently alters every future identifier |
| **D12** | `applicant.updated` carries no field diffs | `applicant.service.ts` | An application is a legal declaration; *who changed the DOB, and from what* is unanswerable |
| **D13** | Two CHECK constraints remain `NOT VALID` | Phase 3 migration | One grandfathered row; enforcement on new rows is unaffected |
| **D14** | `Applicant.aadhaarNo` and `Guardian.aadhaarNo` are plaintext | both models | One plaintext copy defeats encryption as thoroughly as three |
| **D15** | `student.deleted` is in the audit allowlist with no producer and no delete path | `audit.listener.ts:13` | A dead entry invites someone to make it live |
| **D16** | `applicant.person_resolved` is documented and never published | `workflow.service.ts` | Binding a human to an application leaves no dedicated audit event |

## 46.4 Low

| # | Defect | Impact |
| :--- | :--- | :--- |
| **D17** | `previousPercentage` unbounded (V1) | `999%` is storable |
| **D18** | `assignedCounsellorId` unvalidated (V2) | Can name a non-existent user |
| **D19** | `Applicant.photoFileId` dangling (V3) | A column with no target table |
| **D20** | `checklistStatus` is an accepted, unread client blob (V4) | Looks like a control and is not |
| **D21** | No DOB plausibility bound on Applicant (V5) | Fails late, at `admit()`, instead of at the counter |
| **D22** | Numbering pre-flight ignores `isActive` (V8) | `500` inside the transaction instead of a clean `400` |
| **D23** | `APPLICANT_ALREADY_ADMITTED` omits `admissionId`/`enrollmentId` | Cosmetic contract drift |
| **D24** | `NUMBERING_NOT_PROVISIONED` is `400` pre-flight and `500` in-transaction | Two statuses for one condition |
| **D25** | `createInitialEnrollment` does not re-check `AcademicUnit.isActive` | Only reachable by the future importer |
| **D26** | `pref_one_allotted` absent | Inert today — nothing writes `ALLOTTED` |
| **D27** | `Guardian.deletedAt` has no writer | Guardians cannot be retired |
| **D28** | `checkDuplicates` searches only Applicants, branch-scoped | Cannot see a returning dropout — the defect that motivated Person |

---

# 47. Required refinements

Ordered as work. Each states what changes and why the order matters.

## 47.1 Blocking — before the core is frozen

### R1 · Guardian → Person, and Guardianship

Closes **D1, D3, D4, D5, D7, D14 (half), D27**, and unblocks the parent portal,
fee dunning, emergency contact, pickup authorisation and sibling derivation.

```
1  Guardian gains personId (required); resolve a Person for every existing row,
   hashing aadhaarNo into govtIdHash and encrypting into PersonSensitive
2  Guardian drops branchId → organization-scoped
3  Guardian drops aadhaarNo and the six address columns
4  ApplicantGuardianMapping → Guardianship (guardianPersonId, wardPersonId),
   gaining startedAt/endedAt, isLegalGuardian, emergencyPriority,
   pickupValidFrom/To
5  RECONCILE existing violations, THEN create the two partial unique indexes
6  Guardian search: hash-and-compare, never substring
7  Guardian mutations: transactional, outbox events, identifiers-only payloads
8  Guardian reads/writes: scoped WHERE, 404 on miss
9  Guardian routes: @RequirePermission on every one
10 Student profile composes GuardianService.findByWard(personId) at the API layer
```

**Step 5 is the one that will surprise** — index creation will fail on any ward
that already has two financial guardians, which D4 makes possible.

### R2 · Guardian tenant scoping and permissions

**Can and should ship immediately, ahead of R1.** D2 is exploitable today; R1 is
a week of work. Adding `organizationId` to every guardian `WHERE`, `404` on
miss, and `@RequirePermission` on every route is a contained change that closes
a cross-tenant data leak without waiting for the model change.

> This is the single highest-priority item in this document.

### R3 · Cross-tenant master validation

Closes **D6**. Apply the three-tier filter
`OR: [{ organizationId: null }, { organizationId: scope.organizationId }]` in
`assertMasterReferencesExist`, exactly as `assertMastersInScope` already does.
Small, mechanical, closes a reference hole reached through a legitimate route.

## 47.2 High — before the next module builds on this

| # | Refinement | Closes |
| :--- | :--- | :--- |
| **R4** | Reduce `applicant.created` and `guardian.created` payloads to identifiers | D8, D9 |
| **R5** | Add a test asserting every `EVENT_NAME` is in the audit allowlist | T7 |
| **R6** | Write `WorkflowHistory` birth rows for Admission and Enrollment inside `admit()` | D10 |
| **R7** | Publish `numbering_config.updated` | D11 |
| **R8** | Add field-level diffs to `applicant.updated` | D12 |
| **R9** | Resolve the grandfathered applicant, then `VALIDATE CONSTRAINT` in **both** environments | D13 |
| **R10** | Publish `applicant.person_resolved` at submit | D16 |
| **R11** | Remove `student.deleted` from the allowlist | D15 |

## 47.3 Medium — hygiene

| # | Refinement | Closes |
| :--- | :--- | :--- |
| **R12** | Applicant validation: bound `previousPercentage`, validate `assignedCounsellorId`, add a DOB plausibility range, stop accepting `checklistStatus` | D17, D18, D20, D21 |
| **R13** | Numbering pre-flight: add `isActive`, and make the two `NUMBERING_NOT_PROVISIONED` paths agree on a status | D22, D24 |
| **R14** | Add `admissionId` and `enrollmentId` to `APPLICANT_ALREADY_ADMITTED` | D23 |
| **R15** | Re-check `AcademicUnit.isActive` in `createInitialEnrollment` | D25 |
| **R16** | Retire or reimplement `checkDuplicates` over Person | D28 |

## 47.4 With their owning modules

| # | Refinement | With |
| :--- | :--- | :--- |
| **R17** | Migrate `Applicant.aadhaarNo` to `PersonSensitive`; drop the column and its index | R1 |
| **R18** | Drop `Applicant.photoFileId`; treat the photograph as an ordinary document | S3 |
| **R19** | Seed a `CURRENT` `PersonAddress` at `admit()` from the application snapshot | S2 |
| **R20** | Supply the document-checklist service so the guard becomes real | S3 |
| **R21** | Add `pref_one_allotted` **with** the allotment operation | allotment |
| **R22** | Add `AcademicUnit.maxCapacity` and the unit row lock in `admit()` | capacity |

---

# 48. Deferred work

Not defects. Decisions to build later, with their entry points.

| Work | Entry point | Blocked by | Notes |
| :--- | :--- | :--- | :--- |
| **Readmission** | `assertNoExistingStudent` becomes conditional | R1 (guardians should survive it) | **The Phase 6 entry point.** The transaction is written once with the Student-creation step conditional |
| **Branch transfer** | `POST /students/:id/branch-transfer` | `student.transfer` permission | Twelve steps, one transaction (§26.2) |
| **Promotion / repeat** | `supersedeEnrollment` with a new `originType` and an `isRepeat` parameter | — | The primitive already exists |
| **Bulk promotion** | A job table + `POST /enrollments/bulk-promote` | promotion | **One transaction per student** |
| **Student lifecycle** | A lifecycle service writing `Student.status` + `WorkflowHistory` | `student.lifecycle` permission | Six statuses, each a named operation |
| **Archival** | A scheduled job + `ORG_ADMIN` override | lifecycle | A **write lock**, not a disappearance |
| **Crypto-erasure operation** | `IdentityCryptoService.erase` is built; wire a route | `person.sensitive.read`'s access log | Publish `person.sensitive_erased` |
| **Person merge execution** | `PersonMergeLog` + `mergedIntoPersonId` exist | — | Single-actor for v1, mandatory reason |
| **`studentCode` correction** | Break-glass operation | `student.code.correct` | Only while zero certificates and zero receipts exist |
| **Address (S2)** | New module | — | Do **not** migrate the applicant snapshot |
| **Documents (S3)** | New module | virus-scanning decision | Requirements are the half that gets forgotten |
| **Configuration (F2)** | Swap the two providers' implementations | — | **No call site changes** |
| **Seat capacity** | `AcademicUnit.maxCapacity` + unit lock | business decision | §22.3 |
| **Programme allotment** | An allotment operation + `pref_one_allotted` | — | Only for institutions running a round |
| **Parent portal** | `UserIdentityLink` | R1 | **Never accepts a `studentId` in a path** |
| **Export** | `student.export`, separately audited with actor, filter and row count | — | The highest-risk action in the system |
| **Org-level `ProgramTemplate`** | Academic structure | business decision | Makes cross-branch grouping possible |

---

# 49. Open decisions

## 49.1 Requires business decision

| # | Question | Options | Recommendation on file |
| :--- | :--- | :--- | :--- |
| **B1** | Must a ward have a primary guardian? | (a) required below a configurable age; (b) always optional with a warning; (c) per programme type | **(a)** via F2 — the age threshold differs by institution |
| **B2** | Is seat capacity in scope, and where? | (a) omit; (b) `AcademicUnit.capacity` + a soft warning; (c) a full seat matrix | **(a) now, (b) next.** Capacity is a fact about the unit, so it is a column |
| **B3** | Does readmission require a fresh application? | `ALWAYS` / `NEVER` / `AFTER_GAP_YEARS` | Configurable per institution |
| **B4** | Is a deferred applicant's seat held? | Held (the branch runs a place short) vs released (deferment becomes worthless) | Configurable, defaulting to **held with an expiry** |
| **B5** | What triggers a new Admission at a school→junior-college boundary within one branch? | (a) branch change only; (b) a `Program.requiresNewAdmission` flag; (c) an operator choice at promotion | **(b)** — institutions genuinely differ, and a flag is honest where a derived rule is not. `ProgramLevel` is nullable with three values and cannot carry the rule |
| **B6** | Which roll-number policy is the default? | `MANUAL` / `SEQUENTIAL_ON_ADMISSION` / `ALPHABETICAL_ON_LOCK` | **Keep `MANUAL`** until the other two exist |
| **B7** | What performs virus scanning? | ClamAV sidecar vs a cloud API (**which sends student documents to a third party**) | ClamAV — a real P5 infrastructure dependency |
| **B8** | Where are document blobs stored? | Local filesystem vs S3-compatible everywhere | One contract everywhere (MinIO on-premise) |
| **B9** | Do parents upload documents directly? | Direct vs staff-only | **Staff-only in v1** |
| **B10** | Where does India Post PIN data come from? | A seeded snapshot vs a live API | A seeded snapshot; unknown PINs warn, never block |
| **B11** | Must an address change be verified before taking effect? | Staff immediate vs portal propose-then-approve | Both, split by origin |
| **B12** | Does a Person merge need a second approver? | Single-actor vs two-person | **Single-actor for v1**, with a mandatory reason and the full merge log |
| **B13** | Should `Program` become organization-scoped or gain a template? | (a) group by name; (b) `ProgramTemplate`; (c) org-scoped `Program` | **(b)**, as academic-structure work after this build |
| **B14** | Are the 13 admission states configurable? | (a) all 13 exist, configuration selects which are *reachable*; (b) a configurable graph | **(a)** — a configurable graph is a rules engine, and one whose output is the admission lifecycle is a much larger commitment than it looks |

## 49.2 Requires R&D

| # | Question | Why measurement is needed |
| :--- | :--- | :--- |
| **RD1** | What is the minimum signal for a `MEDIUM` Person match? | Currently `phoneHash + dob`. One household mobile serves every child, so in a 1,000-student school this may fire on **every sibling admission** and become noise staff learn to dismiss. **Ship as specified, instrument the false-positive rate, tune with real data** — and accept that shipping a knowingly-noisy heuristic is the trade being made |
| **RD2** | How should `SEQUENTIAL_ON_ADMISSION` handle concurrency and rollback? | `MAX + 1` is a read-then-write race, and a burned number leaves a **visible** hole in a class register |
| **RD3** | Does the trigram GIN index on `studentCode` outperform the unique index for prefix search at scale? | Chosen because Prisma cannot round-trip a `text_pattern_ops` btree without leaving the drift gate red. Verify at volume |
| **RD4** | What happens to attendance and marks recorded against a superseded Enrollment? | **Blocks Attendance, not this build** — but the answer must exist before Attendance is designed. Recommendation: **keep history where it happened**, plus a configurable cut-off after which corrections are refused |
| **RD5** | Which Postgres version is targeted? | Nothing pins it. On 15+, `UNIQUE NULLS NOT DISTINCT` is clearer than the functional `COALESCE` index. **A version assumption living only in someone's head is a deployment surprise** |

## 49.3 Decisions this document makes

Stated so they are not re-litigated:

| # | Decision | Reasoning |
| :--- | :--- | :--- |
| **N1** | **`admit()` refusing an existing Student is correct**, not a defect | A partial readmission under another name is worse than an honest refusal |
| **N2** | **The document-checklist guard should stay a no-op** until S3 supplies the service | A fabricated check passes every time while looking like a control |
| **N3** | **Keep `MANUAL` as the roll-number default** | A default naming an unimplemented generator is a promise the code does not keep |
| **N4** | **The `ProgramPreferenceStatus` enum divergence is acceptable**, and arguably better | `REJECTED`/`WITHDRAWN` are more useful on a preference row than `OFFERED`/`DECLINED` |
| **N5** | **Add `pref_one_allotted` with the allotment operation, not before** | An index guarding an unreachable state is inert |
| **N6** | **Applicant's inline address stays, permanently** | It is the declaration, not the residence. S2 does not replace it |
| **N7** | **`Student.deletedAt` stays and is never set** | Schema consistency without a delete path |
| **N8** | **Guardian survives as a table** after R1 | Occupation, income and employer are guardian-role facts a student-only Person never has |
| **N9** | **No `Household` entity** | A mandatory join on every address and contact read, paying off only in the minority of shared cases |
| **N10** | **No sibling table** | Derived from shared guardianship; an explicit edge is a second source of truth that drifts |

---

# 50. Final recommended architecture

## 50.1 The five layers, frozen

```
┌───────────────────────────────────────────────────────────────────────┐
│ Person       "Is this the same human?"                                │
│              Matching keys only. Organization-scoped. No lifecycle,   │
│              no display attributes, no role fields. Never deleted.    │
├───────────────────────────────────────────────────────────────────────┤
│ Applicant    "What was declared, for this attempt?"                   │
│              A frozen legal snapshot. Branch + year scoped. Terminal. │
│              Never becomes a Student — a Student is created FROM it.  │
├───────────────────────────────────────────────────────────────────────┤
│ Student      "Who is this learner, permanently?"                      │
│              Identity + current official demographics. Org-scoped.    │
│              No placement, no year, no address, no guardian, no login.│
├───────────────────────────────────────────────────────────────────────┤
│ Admission    "Which spell of study?"                                  │
│              Branch-scoped, entry → exit. Spans academic years.       │
│              What a Transfer Certificate is issued against.           │
├───────────────────────────────────────────────────────────────────────┤
│ Enrollment   "Where are they placed, this year?"                      │
│              Branch + year scoped. Immutable — superseded, not edited.│
│              What attendance, exams, fees and timetable hang off.     │
└───────────────────────────────────────────────────────────────────────┘
```

## 50.2 The decisions that must not be reopened

| # | Decision | Confidence |
| :--- | :--- | :--- |
| 1 | Five layers, held apart | `DECIDED` |
| 2 | Student UUID v7, immutable, the only FK target | `DECIDED` |
| 3 | `studentCode` = `STU` + fixed width, org-scoped, permanent, **never a foreign key** | `DECIDED` |
| 4 | Prefix and width configurable **at provisioning, then frozen** | `RECOMMENDED` |
| 5 | Student is **not** year-scoped; Enrollment **is** | `DECIDED` |
| 6 | Admission is a **spell of study**, not a year | `RECOMMENDED` |
| 7 | Student, Admission and first Enrollment are written in **one transaction** | `DECIDED` |
| 8 | Student is created at `SEAT_CONFIRMED → ADMITTED`, **never earlier** | `DECIDED` |
| 9 | One Student per Person per organization | `DECIDED` |
| 10 | One Applicant produces at most one Student | `DECIDED` |
| 11 | Placement is **superseded, never edited** | `DECIDED` |
| 12 | Roll number belongs to Enrollment, is mutable until lock, and is **never identity** | `RECOMMENDED` |
| 13 | **Guardianship is Person ↔ Person** | `DECIDED` — **not yet implemented** |
| 14 | Addresses attach to Person; `Address` is immutable, `PersonAddress` append-only | `DECIDED` — `DEFERRED` |
| 15 | Documents are polymorphic, owned by **what they prove** | `DECIDED` — `DEFERRED` |
| 16 | Student ≠ User | `DECIDED` |
| 17 | No hard delete anywhere | `DECIDED` |
| 18 | Personal data is crypto-erased; the academic record survives | `RECOMMENDED` |
| 19 | **One** numbering engine, two allocation modes | `DECIDED` |
| 20 | Events go through a **transactional outbox** | `RECOMMENDED` |
| 21 | Audit is **event-driven**; business modules never import it | `DECIDED` |
| 22 | Configuration is three-tier and **effective-dated** | `RECOMMENDED` |
| 23 | Scope in every `WHERE`; **404 not 403** | `DECIDED` |
| 24 | `READ COMMITTED` + explicit locks + database constraints | `RECOMMENDED` |
| 25 | Consumers depend **inward**; Student's schema never changes for them | `DECIDED` |
| 26 | The 13-state graph is core semantics, **not** configuration | `DECIDED` |
| 27 | PostgreSQL is sufficient; **no Elasticsearch** | `RECOMMENDED` |
| 28 | One architecture for a 200-pupil school and a 50-branch group — configuration and data volume only | `DECIDED` |

## 50.3 The target state after the refinements

```
Person ────────────────────────────────┬──── PersonSensitive (encrypted)
  │                                    │
  ├── Guardianship ──▶ Person(ward) ────┤        ← R1
  ├── PersonAddress ──▶ Address         │        ← S2
  ├── Document (ownerType: PERSON)      │        ← S3
  │                                     │
  ├── Applicant[]  (snapshot, evidence, terminal)
  │        ├── ApplicantProgramPreference[]
  │        └── Document (ownerType: APPLICANT)
  │
  └── Student  (0..1)
           ├── studentCode                        permanent, org-scoped
           ├── Document (ownerType: STUDENT)      health records
           └── Admission[]                        spells of study
                    ├── admissionNo               branch-scoped
                    ├── Document (ADMISSION)      TC, character certificate
                    └── Enrollment[]              one per academic year
                             ├── rollNumber       mutable until lock
                             ├── Document (ENROLLMENT)  marksheet, bonafide
                             └── ← Attendance · Examination · Fees · Timetable
```

## 50.4 Why this survives twenty years

| Question | Answer |
| :--- | :--- |
| Ten academic years as one identity? | **Yes** — 1 Person, 1 Student, 1 Admission, 10 Enrollments, **zero demographic fields copied** |
| `studentCode` stable while placement changes? | **Yes** — it encodes nothing volatile and is persisted, not derived |
| Can a future module force a change to Student? | **No** — §41.2 gives every module a reference target; none needs a column on Student |
| Two admins admitting one applicant at once? | **One student, one clean conflict.** Verified at 20× |
| Can one branch reach another's student by guessing a UUID? | **No** — scope in every `WHERE`, `404` on miss. *(Guardians excepted, until R2)* |
| Can duplicate Students occur? | **Not through `admit()`.** Only where two Persons exist for one human with no shared identifier — which is what merge resolves, and the architecture keeps it possible |
| Can an institution customise without forking? | **Partly, and the limit is stated.** Code prefix and width, offer validity, deferment, readmission policy, roll-number policy, document requirements and which states are used are all configuration. **The 13-state graph is not** — a deliberate, recorded refusal |
| Small school today, 50 branches later? | **Yes** — identical schema and code paths; the only shared bottleneck has three to four orders of magnitude of headroom |
| Can previous years' records leak? | **No** — every year-scoped read filters on `academicYearId`. Student search is deliberately **not** year-filtered, because Student is not year-scoped |

---

# 51. Core freeze checklist

Thirty-four checks from §33 of the brief, expanded and answered against the
repository.

| # | Check | Status | Evidence |
| :--- | :--- | :---: | :--- |
| 1 | Every field has exactly one owner | ⚠️ | §30 — guardian identity and address are owned twice |
| 2 | No duplicated source of truth | ⚠️ | Three deliberate denormalizations, all FK-guarded; **guardian Aadhaar and address are undeliberate** |
| 3 | Student has no academic placement | ✅ | Asserted by test |
| 4 | Student has no `currentEnrollmentId` | ✅ | Asserted by test |
| 5 | Enrollment has placement | ✅ | |
| 6 | Enrollment has no demographic field | ✅ | |
| 7 | Admission represents a study spell, not a year | ✅ | No `academicYearId` on Admission |
| 8 | Person represents human identity only | ✅ | Matching keys only |
| 9 | **Guardian relationship survives conversion** | ❌ | **§8 — the blocking finding** |
| 10 | Address is not duplicated into Student | ✅ | Student has zero address columns |
| 11 | Addresses attach to Person | ❌ | S2 not built; they are inline on Applicant and Guardian |
| 12 | Documents have correct ownership | ⏳ | Model defined, module not built |
| 13 | `studentCode` is permanent | ✅ | Persisted, never recomputed; survives rollback |
| 14 | `studentCode` is never a foreign key | ✅ | Asserted by test |
| 15 | UUID is the internal identity | ✅ | |
| 16 | Roll number is placement-specific | ✅ | Unique per unit + year |
| 17 | Roll number is never identity | ✅ | Not an FK anywhere |
| 18 | Capacity has an explicit owner | ⚠️ | **Explicitly none.** Stated, not hidden; ownership recommended |
| 19 | Workflow is the only authority for applicant transitions | ✅ | No direct write path, including for the sweep |
| 20 | `ADMITTED` is unreachable without a Student | ✅ | `orchestratedOnly`; no DTO field sets the flag |
| 21 | Admission conversion is atomic | ✅ | Verified by fault injection at every step |
| 22 | Conversion is concurrency-safe | ✅ | Verified at 20× |
| 23 | Numbering is transaction-aware per purpose | ✅ | Two modes |
| 24 | A yearly sequence renders its year | ✅ | Refused at provisioning otherwise |
| 25 | Identity sequence width is frozen after allocation | ✅ | `SEQUENCE_WIDTH_IMMUTABLE` |
| 26 | Sensitive data never leaks into events, logs or audit | ⚠️ | Aadhaar ✅ asserted by test; **mobile and name ❌** |
| 27 | Sensitive data never leaks through an API | ❌ | **`GET /guardians/:id` returns a full Aadhaar cross-tenant** |
| 28 | Audit is event-driven | ✅ | No business module imports it |
| 29 | Events use the outbox | ⚠️ | Everywhere **except guardian events** |
| 30 | Every event is registered for audit | ✅ now | Has silently failed twice; needs T7 |
| 31 | Tenant isolation is preserved | ❌ | **Guardian routes have none; applicant masters are unfiltered** |
| 32 | Branch isolation is preserved | ⚠️ | Everywhere except guardians |
| 33 | Academic-year isolation is preserved | ✅ | Locked years refuse every placement write |
| 34 | Every database constraint has a raw-SQL test | ⚠️ | Core ✅; guardian invariants do not exist to test |

**28 of 34 pass. Six do not, and five of those six are the guardian boundary.**

---

# CORE ADMISSION LIFECYCLE STATUS

```
NOT READY TO FREEZE
```

**Narrowly, and on one axis.** The Person → Applicant → Workflow → Admission →
Student → Enrollment core is sound, verified end to end, and recommended for
freeze **once the guardian boundary is corrected**. Nothing in the core five
layers needs redesigning.

## Verified

- **Five-layer separation holds** — Person, Applicant, Student, Admission,
  Enrollment, each answering exactly one question, with no field in the wrong
  table. Zero demographic fields on Enrollment; zero placement fields on
  Student; no academic year on Admission.
- **`admit()` is atomic and concurrency-safe.** Fault injection at each of the
  six steps and after the last leaves no partial state. Twenty simultaneous
  requests produce one student, one admission, one enrolment, one code and
  nineteen informative conflicts.
- **Identity resolution is correct**, including the case that was wrong until
  Phase 5.5: an applicant with no government identifier now keeps the Person
  bound at submission rather than acquiring a second one at admission.
- **The two-branch collision resolves to one Person**, so the second admission
  is refused rather than splitting the record.
- **`studentCode` is permanent, organization-scoped, gap-tolerant, never a
  foreign key**, and survives a rollback without reissue.
- **`ADMISSION_NO` survives a second academic year** — provisioning now refuses
  a yearly sequence whose format renders no year.
- **The applicant machine has one implementation.** Thirteen states, fifteen
  edges, every one locked, validated, historied and evented. The expiry sweep
  goes through the same engine.
- **`ADMITTED` cannot be reached without a Student, an Admission and an
  Enrollment** — `orchestratedOnly`, with no request body able to assert it.
- **Placement is immutable and supersession is a single primitive** with four
  intended callers.
- **The database enforces what matters**: 40+ constraints, three composite
  foreign keys that make cross-branch and cross-year placement
  *unrepresentable*, and partial unique indexes for every one-of rule.
- **Events are durable** through a transactional outbox; audit is event-driven
  and no business module imports it.
- **404-not-403 is preserved** everywhere it was established — except guardians.

## Blocking issues

1. **Guardianship is not Person ↔ Person.** Guardians are recorded against the
   Applicant and `admit()` copies nothing, so **a student has no guardian**. A
   migrated student can never have one. The architecture's stated reason for
   `admit()` ignoring guardians — *"both ends are Persons"* — is false as built.
2. **No tenant scoping and no permission on any guardian route.**
   `GET /admissions/guardians/:id` returns a **full plaintext Aadhaar, name,
   mobile and address to any authenticated user of any tenant**, and
   `PATCH`/map/unmap are equally open. This is exploitable today.
3. **Primary-guardian exclusivity is not transactional** — a failed mapping
   leaves a child with **no primary guardian**, silently.
4. **`isFinancialGuardian` has no exclusivity at all** — a ward can have three,
   and billing address resolution and invoicing both become non-deterministic.

## Required refinements

- **R2 first, ahead of everything** — scope every guardian query, `404` on miss,
  `@RequirePermission` on every route. Contained, immediate, closes the leak.
- **R1** — Guardian gains `personId` and loses `branchId`, `aadhaarNo` and its
  address columns; `ApplicantGuardianMapping` becomes `Guardianship`
  (Person ↔ Person) with validity windows and the two partial unique indexes.
  **Reconcile existing violations before creating the indexes.**
- **R3** — three-tier tenant filtering on applicant master references.
- **R4–R11** — identifier-only event payloads; an allowlist-coverage test;
  `WorkflowHistory` birth rows for Admission and Enrollment;
  `numbering_config.updated`; field diffs on `applicant.updated`; validate the
  two `NOT VALID` constraints; publish `applicant.person_resolved`; drop
  `student.deleted`.

## Guardian/family issues

Guardianship is Applicant-scoped rather than Person-scoped; Guardian is
branch-scoped rather than organization-scoped, so **siblings in two branches
cannot share a guardian**; Guardian holds its own plaintext Aadhaar and address;
primary exclusivity is non-transactional; financial exclusivity is absent; every
route is unscoped and unpermissioned; search probes Aadhaar by substring;
re-mapping silently clears flags; events bypass the outbox and carry PII; there
are no validity windows, no `isLegalGuardian`, no `emergencyPriority`, no pickup
window, and no `endedAt`, so a guardianship can only be deleted, not ended.

## Address issues

No `Address`, `PersonAddress` or `PincodeReference` exists. **A student has no
address record at all** — only the frozen application snapshot, reachable via
`sourceApplicantId` and therefore unreachable for a migrated student. Guardian
addresses are inline columns that lose history on every edit. `BILLING`
resolution through the financial guardian is impossible for two reasons at once.
The applicant snapshot itself is **correct and must never be migrated**.

## Document issues

No `Document`, `DocumentVersion`, `DocumentType` or `DocumentRequirement`
exists. `DOCUMENT_CHECKLIST_SATISFIED` passes unconditionally — correctly so,
and wired for S3 to satisfy without a call-site change. `DOCUMENT_PENDING` means
only *"a reviewer said so"*. `Applicant.photoFileId` points at nothing and should
be dropped; `Student.photoDocumentId` is correctly a plain string with no
foreign key. `Applicant.checklistStatus` is an accepted, unread client blob.
Three infrastructure decisions are open: scanner, storage and who may upload.

## Roll/capacity issues

Roll number is correctly owned by Enrollment, correctly excluded from identity,
and correctly unique per class register per year. Only `MANUAL` is implemented;
the other two policies are named and unbuilt, and `SEQUENTIAL_ON_ADMISSION`
needs a concurrency design before it ships. The class-list lock derives from
`AcademicYear.isLocked` — coarser than the eventual rule, never weaker.
**Capacity does not exist anywhere**, by decision; §22.3 gives the correct
concurrent shape (lock the `AcademicUnit` row *before* counting) for when it is
built.

## Admission/enrollment issues

No `WorkflowHistory` birth row for either, so a new student's placement history
reads empty. `APPLICANT_ALREADY_ADMITTED` omits two documented detail fields.
`NUMBERING_NOT_PROVISIONED` is `400` on the pre-flight and `500` inside the
transaction. `createInitialEnrollment` does not re-check `AcademicUnit.isActive`
— only reachable by the future importer. `admit()` refusing an existing Student
is **correct** and is the Phase 6 entry point, not a defect. Readmission, branch
transfer, promotion, repeat and the whole Student lifecycle are unbuilt, and all
five have their shapes asserted by the pipeline test.

## Security issues

**Critical** — cross-tenant read and write of guardian records, including a full
plaintext Aadhaar. **High** — Aadhaar substring probing through guardian search;
cross-tenant master references reachable from applicant registration.
**Medium** — mobile numbers and names in `applicant.created` and `guardian.*`
event payloads, and therefore in `AuditLog`; plaintext `aadhaarNo` on Applicant
and Guardian. **Sound** — Person-level encryption, blind indexing, masking, the
404-not-403 rule, mass-assignment protection, and the deliberate withholding of
a sensitive-reveal capability until its access log exists.

## Deferred

Readmission · branch transfer · promotion · repeat · bulk promotion · Student
lifecycle and archival · crypto-erasure as an operation · Person merge execution
· `studentCode` correction · Address (S2) · Documents (S3) · Configuration (F2)
· seat capacity · programme allotment · parent portal and `UserIdentityLink` ·
export · org-level programme templates.

## Recommended next implementation step

> **Ship R2 — guardian tenant scoping and route permissions — immediately, as a
> standalone change.**
>
> It is a contained edit to one service and one controller: add
> `organizationId` (and `branchId` where appropriate) to every guardian `WHERE`,
> return `404` on a miss, and add `@RequirePermission` to all six routes. It
> closes an exploitable cross-tenant leak of children's personal data, including
> a plaintext government identifier, and it needs none of the model change.
>
> **Then R1 — Guardian → Person and `Guardianship`** — as the next full unit of
> work, sequenced before readmission so that guardianship survives the operation
> that will exercise it. Reconcile the existing exclusivity violations *before*
> creating the two partial unique indexes; that step will fail on real data, and
> discovering it during the migration rather than during planning is the
> avoidable cost.
>
> With R2 and R1 landed, and R3–R11 folded in, this specification's verdict
> becomes **READY TO FREEZE**, and Fees, Attendance, Examination, Transport,
> Library, Parent Portal and Certificates can be built against Person, Student,
> Admission and Enrollment without any of the four needing to change.

---

## Document control

| | |
| :--- | :--- |
| **Canonical location** | `backend/docs/planning/core-admission-lifecycle-specification.md` |
| **Reconciled against** | The repository at commit `9ad2acb`, 2026-08-12 |
| **Consolidates** | `student-admission-enrollment-architecture.md` (the build blueprint) · `00-foundation/01-03` · `01-identity-core/01-03` · `02-guardian-family/01` · `03-address/01` · `04-documents/01` · the Prisma schema, migrations, services, controllers, DTOs, events, permissions and tests |
| **Supersedes** | Nothing. Where it and a module spec disagree, both are stated and one is named correct |
| **Must be updated when** | Any blocking issue closes · any §49 decision is answered · a new consumer module is added to §41.2 · a core constraint changes |
| **Review trigger** | Before any Phase 6 operation is implemented, and before the core is frozen |



