# R5.1 — Core Domain Freeze v1.0 Audit

**Date:** 2026-08-15
**Scope:** Person → Applicant → Guardian/Guardianship → Address → Documents →
Admission Workflow → Student → Admission → Enrollment. Read-only audit against
actual code, Prisma schema, migrations and tests — documentation was
consulted as a starting point, never trusted blindly.

**Verdict: READY TO FREEZE.**

No BLOCKING defect was found anywhere in the audited scope. Every known
carry-forward item was re-verified against current code rather than assumed
still true from prior reports; one (`Applicant` master-reference validation)
turned out to already be closed and is removed from the open list. The
`NOT VALID` constraint row count was re-checked against the live dev database
during this audit (§20) and matches the number the Phase 3 migration
predicted exactly — no drift.

This document does not redesign anything. Nothing in Student, Admission or
Enrollment changed as a result of this audit — the freeze holds because
nothing required to move.

---

## 1. Executive Summary

CampusFlow's core admission foundation — nine phases (Phase 0 through R5) —
was audited end to end for the specific purpose of deciding whether Fees can
be built on top of it without the core ever needing to move again. It can.

The audit found:

- **Zero BLOCKING security or correctness defects** across identity, tenant
  isolation, permission coverage, encryption, event/audit payload hygiene,
  and every database invariant that matters for freeze.
- **Nine of ten previously-known carry-forward items still stand as
  correctly deferred**, each requiring either a business decision or
  infrastructure this environment doesn't have — none blocks Fees.
- **One item was found stale** and is closed: "Applicant master-reference
  validation" was flagged as an open concern in the audit brief, but
  `Applicant.programId/quotaId/categoryId/religionId/casteId/motherTongueId/`
  `bloodGroupId/disabilityTypeId/admissionSourceId` are all real, DB-enforced
  Prisma relations, not loose IDs — this was already fixed in Phase 3/R3 and
  the carry-forward list simply hadn't been updated.
- **One minor, non-blocking naming gap** in R5's own permission model
  (§8 finding 22) is documented rather than "fixed to look clean" — it does
  not create a security hole and touching it is out of this audit's
  scope-discipline.
- **Fees, roll-number, and capacity compatibility all PASS** (§17–19):
  nothing in the current Student/Enrollment shape blocks any of the three
  without a Student redesign.

No code was changed as part of this audit. Every finding below is backed by
a specific file and line examined during this pass — see the four detailed
audit sections (§4–§11) for the evidence trail.

## 2. Audited Scope

In scope: Person, Student, Applicant, Guardian, Guardianship,
ApplicantGuardianMapping, Address, PersonAddress, Document, DocumentVersion,
DocumentType, DocumentRequirement, Admission, Enrollment, the Applicant
workflow state machine, and `AdmissionConversionService.admit()`.

Out of scope, and untouched: Fees, Attendance, Examination, Transport,
Library, HR/Employee, Promotion, Repeat, Readmission, branch/organization
transfer, the capacity/seat-matrix engine, the final roll-number engine, and
the Parent Portal. Where any of these revealed a dependency on the core that
would make the core unsafe to freeze, it is called out in §17–19; none did.

## 3. Current Architecture

The lifecycle as it exists today, unchanged by this audit:

```
Person (identity, encrypted government ID, blind index)
  ├─ Student (1:1, immutable studentCode, never a FK)
  ├─ Applicant (0:N over time — one per application)
  ├─ Guardian (0:N, via Guardianship — Person↔Person, R4.5)
  └─ PersonAddress (0:N, typed, time-bounded links to immutable Address rows)

Applicant
  ├─ 13-state workflow (workflow.transitions.ts, table-driven)
  ├─ ApplicantProgramPreference (ordered choices)
  ├─ ApplicantGuardianMapping (legacy, per-application guardian working set)
  └─ Document (via OwnerResolverService, R5 — polymorphic ownership)

admit() [AdmissionConversionService, one transaction]
  Applicant (locked) → Person (resolved) → Student (created)
    → Admission (created, a "study spell") → Enrollment (created, placement)
    → Applicant.status = ADMITTED (orchestratedOnly edge)

Admission  — one study spell, no academic year, admissionNo unique per branch
Enrollment — one academic placement, references Admission + AcademicUnit,
             immutable at write time, corrected only via supersession
```

Student carries no academic-placement field and no financial field —
verified directly in the Prisma model, not inferred from documentation.

## 4. Identity Audit

**VERIFIED**, no BLOCKING findings.

- `Person` 1:1 `Student` via `Student.personId @unique` +
  `@@unique([organizationId, personId])`.
- Government ID (Aadhaar) is AES-256-GCM ciphertext on
  `PersonSensitive.aadhaarEnc`, separated from a blind index
  (`Person.govtIdHash`, HMAC-SHA256 keyed by the organization's DEK). No
  reveal endpoint exists; `PersonController.findOne` returns only a masked
  last-4.
- UUIDv7 confirmed on every identity-adjacent model
  (`@id @default(uuid(7))`), not v4/cuid.
- `studentCode` has no update path anywhere in the codebase — immutability
  is structural (no route, no service method touches it after creation), and
  it is a plain `String`, never referenced as a foreign key by any other
  model.
- Crypto erasure: the schema supports both single-person erasure (nullable
  `aadhaarEnc`/`aadhaarLast4` plus `erasedAt`/`erasedBy`) and tenant-wide DEK
  shredding (`OrganizationDataKey.shreddedAt` + `DataKeyRotationLog`). A
  callable single-person erasure *service method* was not located in this
  pass — noted as a **DISCREPANCY**, not a defect: the mechanism is real at
  the schema layer, just not yet wired to a route. Not required for freeze
  (no product requirement demands it yet).

**Carry-forward confirmed still open (not new):** plaintext `aadhaarNo` on
`Applicant`/`Guardian` — see §6 and §20 item 3/4.

## 5. Applicant Audit

**VERIFIED**, no BLOCKING findings.

- The 13-state machine is declarative and table-driven
  (`workflow.transitions.ts`); `ADMIT` is `orchestratedOnly` and
  unreachable via the generic transition endpoint.
- Duplicate handling is intentionally non-blocking: `checkDuplicates`
  returns `warnings`, never throws, matching the same "resolve, never
  prompt" philosophy `PersonService` uses.
- `PersonService.resolve()` is deterministic and idempotent — a second
  Applicant for the same human links to the same Person.
- Program preference (`ApplicantProgramPreference`) is modeled separately
  from the direct-apply `Applicant.programId`, both DB-unique-constrained.
- Master references are real FKs, checked for existence *and*
  branch-ownership *and* active status before insert
  (`assertMasterReferencesExist` / `assertProgramInBranch`) — this closes
  carry-forward item 9 (§20).
- `DOCUMENT_CHECKLIST_SATISFIED` is wired to the real R5 `ChecklistService`,
  not the historical no-op — confirmed by reading `workflow.service.ts` and
  `workflow.transitions.ts` directly, not by trusting the R5 phase's own
  report.
- Tenant/branch isolation: every read/write path scopes in the query itself
  and 404s (never 403s) on a miss.

**Minor, non-blocking gap found:** there is no explicit "reapply after
rejection" action — `REJECTED` is terminal with no outbound edge, and
reapplication today means filing an entirely new `Applicant` (which
correctly re-links to the same `Person`, but with no `deferredFromApplicantId`
-style linkage back to the rejected attempt, unlike deferrals, which *are*
modeled this way). **Classification: SAFE TO DEFER** — it's a
traceability/UX gap, not a data-integrity or security issue.

## 6. Guardian Audit

**VERIFIED**, no BLOCKING findings.

- `Guardianship` (R4.5, Person↔Person) is the durable record; the legacy
  `ApplicantGuardianMapping` (Applicant↔Guardian) is the per-application
  working set, projected into `Guardianship` at admit-time by
  `GuardianshipService.syncFromApplicantMappings`. This is confirmed as a
  real projection, not a duplicate store.
- Primary-guardian and financial-guardian exclusivity is DATABASE-enforced
  via partial unique indexes
  (`Guardianship_one_primary_per_ward_key`,
  `Guardianship_one_financial_per_ward_key`) — the service-layer "clear the
  flag on other rows first" step is explicitly documented in its own code
  comment as a UX nicety, not the actual guarantee.
- Sibling derivation is a real, correctly org-scoped raw-SQL self-join,
  computed at query time — matches the documented decision not to persist a
  `Household` concept.
- Cross-org isolation confirmed on every Guardianship read path
  (`assertPersonInScope`, 404-not-403).

**Confirmed still open, not new (carry-forward items 3–4, §20):**
`Guardian.aadhaarNo` (plaintext) and `Guardian.addressLine1/2/city/state/`
`country/pincode` (inline, bypassing `PersonAddress`) both still exist on
the legacy `Guardian` row. No backfill or migration was invented for these
during this audit, per the explicit instruction not to guess legacy data.
**REQUIRES BUSINESS DECISION.**

## 7. Address Audit

**VERIFIED**, no BLOCKING findings.

- `Address` is immutable — no update path exists, dedup by
  `@@unique([organizationId, normalizedHash])`.
- `PersonAddress` is the typed, time-bounded link (`validFrom`/`validTo`,
  four `AddressType` values), DB-enforced to have at most one open link per
  person+type (`PersonAddress_person_type_open_key` partial unique index +
  a CHECK that `validTo IS NULL OR validFrom < validTo`).
- Fallback rules match the documented behavior exactly: `COMMUNICATION` and
  `BILLING` fall back to `CURRENT` when no direct link exists; `BILLING`'s
  "resolve via financial guardian" step is explicitly stubbed, blocked on
  `Guardian.personId` being nullable — a self-documented, already-known
  deferral, not a silent gap.
- `Student` carries zero address fields — confirmed by direct model read.

**Minor gap noted, not blocking:** nothing at the database layer prevents
two *overlapping* `validFrom`/`validTo` windows of the *same* type (only the
"one open window" case is indexed). Low risk today — no concurrent-write
surface exists on Address (staff-only, sequential). **SAFE TO DEFER.**

## 8. Document Audit

**VERIFIED**, no BLOCKING findings. This section covers R5, delivered
immediately before this audit — re-verified here independently rather than
trusted from R5's own final report.

- `Document` (business identity) / `DocumentVersion` (storage detail) split
  confirmed clean — no business logic reads storage keys directly.
- Ownership resolution (`OwnerResolverService`) checks all 7 owner types
  strictly within the caller's verified scope; a bad owner id 404s.
- Versioning: "at most one current version" is structural (nullable
  **unique** FK `Document.currentVersionId`), not a runtime check that could
  be forgotten. `@@unique([documentId, versionNumber])` is DB-enforced.
- Verification lifecycle: a version that is not `CLEAN` can never become
  current and can never be downloaded, unconditionally — verified by
  reading `document.service.ts` `download()`/`verify()` directly, not
  assumed. A sensitive document type additionally refuses `STAFF` on
  download.
- No permanent or public URL is ever constructed anywhere in the module —
  every download streams decrypted bytes through the backend and is
  audited.
- Storage/Scan ports are provider-agnostic; the current adapters
  (`local` filesystem, `NullScanAdapter`) both fail loud outside production
  and fail *closed* — refuse to operate — inside it, matching the existing
  `EnvRecoveryKeyProvider` idiom rather than inventing a new pattern or a
  scanner that always reports CLEAN.
- `DOCUMENT_CHECKLIST_SATISFIED` confirmed wired for real (cross-checked
  independently in §5).

**Minor finding, NOT a security issue:** `document-type.controller.ts`'s
mutation routes (`POST`/`PATCH`/`DELETE`) reuse
`PERMISSIONS.DocumentRequirements.Manage` rather than a dedicated
`DocumentTypes.Manage` permission. Both are already gated to
`SUPER_ADMIN`/`ORG_ADMIN`/`BRANCH_ADMIN` via `@Roles`, so no unauthorized
access is possible — this only means "manage document types" and "manage
document requirements" cannot be granted independently of each other today.
**Classification: SAFE TO DEFER.** Per the audit's own instruction not to
implement a fix merely to make the audit look cleaner, this was documented
rather than patched — splitting the permission is a five-minute change
whenever the business actually needs that granularity, and doing it now
would be scope creep against an otherwise-closed R5.

## 9. Admission Audit

**VERIFIED**, no BLOCKING findings.

- `Admission` deliberately carries no `academicYearId` — a study spell spans
  years by design.
- `admissionNo` is branch-scoped and unique
  (`@@unique([branchId, admissionNo])`), never a foreign key.
- `admissionType`/`admissionSourceId` present as documented.
- Cardinality: Applicant→Admission is provenance-only (nullable,
  `onDelete: SetNull`); Student→Admission is 1:N over time with exactly one
  `ACTIVE` admission enforced by a partial unique index
  (`admission_one_active`); Admission→Enrollment is 1:N.

## 10. Enrollment Audit

**VERIFIED**, no BLOCKING findings.

- Academic placement (program, unit, year, roll number) lives entirely on
  `Enrollment`; `Student` has zero such fields — confirmed by direct model
  read, matching the model's own doc comment explaining the omission as
  deliberate.
- Enrollment→Admission and Enrollment→AcademicUnit both use **composite
  foreign keys** (`[admissionId, studentId, branchId]`,
  `[academicUnitId, branchId, programId, academicYearId]`) — a mismatched
  student/branch/program/year is structurally unrepresentable, not merely
  checked in a service.
- Supersession is real: `supersedeEnrollment()` row-locks the original,
  closes it pointing at a pre-generated successor id, inserts the
  replacement in the same transaction, and writes `WorkflowHistory` for
  both — the audit trail survives a correction.
- Cross-branch transfer is correctly unreachable from the current service
  (branch is copied from the row being replaced, never from caller input) —
  deferred, not attempted, and not needed for freeze.
- `rollNumber` uniqueness is scoped per class register
  (`(academicUnitId, rollNumber)`), not global — supports whatever numbering
  policy is chosen later without a schema change.

## 11. Conversion Audit

**VERIFIED**, no BLOCKING findings — including the one area this audit
specifically re-checked with fresh evidence rather than trusting Phase 5's
report.

- `admit()` is one Prisma `$transaction` (`READ COMMITTED`, 15s timeout)
  wrapping: row-lock the Applicant → re-assert `SEAT_CONFIRMED` under lock →
  resolve Person → refuse if a Student already exists → create Student →
  create Admission → create Enrollment → transition to `ADMIT`. All child
  services accept and honor the same transaction client — verified directly
  in `EnrollmentService.createInitialEnrollment`, which runs on the caller's
  `tx` when supplied rather than opening its own.
- Row-level locking is a real `SELECT ... FOR UPDATE` on the Applicant, not
  optimistic-only. `Student.sourceApplicantId` (partial unique) and
  `@@unique([organizationId, personId])` catch races the row lock alone
  can't see — e.g. the same person seat-confirmed at two branches
  simultaneously.
- Rollback is a single transaction boundary — any failure at any of the six
  steps rolls back everything.
- **A genuine concurrent-admission integration test exists and was
  confirmed present** — `test/integration/admit.integration-spec.ts` fires
  concurrent admit attempts via `Promise.allSettled` against real Postgres
  and asserts exactly one winner. This closes what would otherwise have
  been this audit's top open question.

## 12. Security Audit

**Cross-cutting pass across the entire audited scope. 0 BLOCKING findings,
2 NOTED (non-blocking, both safe internal patterns).**

1. **BOLA** — none exploitable. Bare-`id` operations found were all either
   already-scoped in the same `where` clause or preceded by an
   already-scoped lock/lookup earlier in the same function. NOTED, not
   BLOCKING.
2. **Cross-org/cross-branch access** — `scopedWhere`/explicit
   `organizationId`+`branchId` filters applied at every read/write across
   every audited module; every miss 404s, never 403s. **PASS.**
3. **Missing permission decorators** — none found; every route pairs
   `@Roles` with `@RequirePermission` across Person, Address, Student,
   Applicant, Guardian, Guardianship, Admission Conversion, Workflow,
   Documents, Enrollment. **PASS.**
4. **Sensitive data in logs** — checked every `logger.*` call across
   identity/admissions/documents; all interpolate only IDs, counts, or enum
   states. One log call explicitly comments "Never log the identifier
   itself." **PASS.**
5. **Sensitive data in events** — every `DomainEvent` subclass audited
   carries only IDs/enums/booleans by design and by inspection (e.g.
   `hasGovernmentId: boolean`, never the value; Document events explicitly
   forbid filename/storage-key/checksum/signed-URL fields). **PASS.**
6. **Sensitive data in audit/outbox payloads** — the outbox persists the
   event's own already-safe payload plus a `contextSnapshot` of legitimate
   request metadata (userId, IP, route) — no separate entity-diff capture
   exists that could leak PII. **PASS.**
7. **Aadhaar/government-ID leakage** — every response path masks the
   government ID before it reaches a DTO; the response DTO explicitly bans
   the encrypted/hash fields in a code comment; the blind-index hash is
   used only as an internal lookup key, never returned. **PASS.**
8. **Unsafe error details** — a single app-wide exception filter translates
   Prisma errors and pattern-matches generic errors for DB-internal
   keywords, replacing them with a safe message; stack traces are logged
   server-side only. No per-controller bypass found. **PASS.**
9. **Raw storage URLs** — confirmed absent; every document download streams
   decrypted bytes through the backend, no signed/public URL is ever
   constructed. **PASS.**
10. **Document authorization** — verified by reading the actual R5 code
    directly (not the prior phase's self-report): tenant-scoped, refuses
    any non-`CLEAN` version unconditionally, additionally refuses `STAFF`
    on sensitive types, audits every download. **PASS.**

## 13. Database Invariant Audit

Classified DATABASE / SERVICE / WORKFLOW / CONFIGURATION / ASYNC. No item
was found enforced weaker than its architecture claims — the one asymmetry
noted (below) is pre-existing and superseded, not a fresh gap.

| Invariant | Layer | Note |
| :--- | :--- | :--- |
| Person unique per (org, govtIdHash) | DATABASE | |
| Student unique per (org, personId) | DATABASE | |
| Student.studentCode immutable | DATABASE | no update path exists in code |
| Applicant → Student, at most one | DATABASE | partial unique on `sourceApplicantId` + CHECK |
| Student Code uniqueness | DATABASE | `@@unique([organizationId, studentCode])` |
| Admission number uniqueness | DATABASE | `@@unique([branchId, admissionNo])` |
| One ACTIVE admission per student | DATABASE | partial unique index |
| One live PRIMARY enrollment per admission/year | DATABASE | partial unique index |
| Enrollment↔Admission student/branch consistency | DATABASE | composite FK — structurally unrepresentable otherwise |
| Enrollment↔AcademicUnit structural consistency | DATABASE | composite FK |
| Roll number uniqueness | DATABASE | scoped per `(academicUnitId, rollNumber)`, not global |
| Tenant isolation | DATABASE (indexed) + SERVICE (query scoping) | |
| Branch isolation | DATABASE (Admission chain) / SERVICE (elsewhere, by design — branch is mutable on Student) | |
| Document version uniqueness | DATABASE | `@@unique([documentId, versionNumber])` |
| Document "at most one current version" | DATABASE | structural, nullable unique FK |
| One ACTIVE document per owner+type | DATABASE | partial unique index |
| Guardian one-primary/one-financial per ward (`Guardianship`, R4.5) | DATABASE | partial unique indexes |
| `ApplicantGuardianMapping` (legacy) exclusivity | **Weaker** — only `@@unique([applicantId, guardianId])`, no primary/financial exclusivity at DB layer | Pre-existing, already superseded by `Guardianship` for anything post-R4.5 — not a fresh defect, not fixed here (out of scope: legacy model, business decision on migration timing) |
| Address validity (one open window per person+type) | DATABASE | partial unique + CHECK |
| Address validity (no overlapping windows of the same type) | Not enforced | SAFE TO DEFER — no concurrent-write surface today |
| Document checklist gate | WORKFLOW (guard invocation) + SERVICE (evaluation) | correctly excluded from DB layer — a 13-state graph doesn't belong in a CHECK constraint |
| Sibling derivation | ASYNC | query-time, unstored, no staleness risk |

## 14. Concurrency Audit

- `admit()`: row-locked, transactional, tested under real concurrent load
  (`admit.integration-spec.ts`) — exactly one winner, rest get a named
  conflict.
- Document upload/replace: create-then-catch-`P2002`-then-retry-as-append
  for the "first version of a new document" race; a translated 409 for the
  "concurrent replace" race — both verified by unit test with a real
  `Prisma.PrismaClientKnownRequestError`.
- Guardianship primary/financial toggle: DB partial unique index is the
  actual guarantee; the service-layer pre-clear is a UX nicety only.
- No new concurrency gap was found in this audit that wasn't already known
  and already mitigated at the layer that matters.

## 15. Audit/Event/Outbox Audit

Transactional outbox (`OutboxPublisher.enqueue`) used for every event that
commits data in the same transaction; direct `EventBus.publish()` reserved
for events with nothing to attach to (e.g. a document download, which
commits no data of its own). Every `DomainEvent` subclass across Person,
Student, Guardian, Document carries only IDs/enums/booleans — verified, not
assumed, in §12 finding 5.

## 16. Configuration Audit

- `DOCUMENT_STORAGE_PROVIDER` / `DOCUMENT_STORAGE_LOCAL_ROOT`: validated,
  optional, defaulted; `StorageModule`'s factory throws a named error for
  any provider other than `local` — confirmed no silent fallback exists.
- `NODE_ENV === 'production'` gates both `NullScanAdapter` and the
  (absent) cloud storage adapter identically — fail loud in dev, fail
  closed in prod. Confirmed unchanged since R5 shipped.
- `EnrollmentConfigProvider.classListLocked()` derives from the academic
  year until F2 ships a dedicated class-list lock — a documented, coarser
  (never weaker) interim rule, not a gap.

## 17. Fees Compatibility

**PASS.** `Student` carries zero financial fields today, and `Enrollment`
is already positioned — in its own code comment — as "the spine attendance,
examination, fees and the timetable will hang off." Fees can key off
`(studentId, enrollmentId)` for year-scoped facts (tuition, term fees) or
`(studentId, admissionId)` for spell-scoped facts (one-time admission fees)
without any change to Student's identity model. Scholarships, discounts,
refunds, transport/hostel fees, late fees and concessions are all
downstream-owned facts that reference `studentId`/`enrollmentId` — none of
them require a field on Student, Admission or Enrollment beyond what
already exists.

## 18. Roll Number Compatibility

**PASS.** `Enrollment.rollNumber` is a plain nullable string, mutable until
class-list lock, uniqueness scoped to `(academicUnitId, rollNumber)` — this
supports manual, sequential, or alphabetical numbering schemes without a
schema change. Class-list locking is already gated through
`EnrollmentConfigProvider.classListLocked()`, ready to swap its current
year-derived rule for F2's real per-class-list lock without touching
Enrollment's shape.

## 19. Capacity Compatibility

**PASS.** `AcademicUnit` is already a first-class entity `Enrollment`
references via composite FK. Every Enrollment write path is
service-controlled — there is no public `POST /enrollments` — so a future
capacity/seat-allocation check is a guard insertable into
`createInitialEnrollment`/`supersedeEnrollment` without touching `Student`.
No capacity concept exists yet, correctly deferred and not attempted here.

## 20. Carry-Forward Items

Each of the ten previously-known items, re-verified against current code
during this audit (not assumed from prior reports):

| # | Item | Status | Classification |
| :-- | :--- | :--- | :--- |
| 1 | Recovery-KEK custody ceremony | `recoveryKekVersion` field exists; the Shamir/operational-ceremony design is named and deferred | **REQUIRES BUSINESS DECISION** — organizational, not technical |
| 2 | Two `NOT VALID` Applicant constraints | Re-checked live against the dev DB during this audit: **exactly 1 violating row**, `019f8f56-ece4-71d0-8b71-054cd7e234ea`, `SUBMITTED` since 2026-07-23, matching the migration's own prediction exactly — no drift, no new violations | **SAFE TO DEFER** — enforced on every insert/update going forward; resolving the one legacy row is a data decision, not a schema one |
| 3 | Legacy plaintext `aadhaarNo` on `Applicant` | Confirmed still present, still used in a live duplicate-check query (`{ aadhaarNo: data.aadhaarNo }`) | **REQUIRES BUSINESS DECISION** — target is `PersonSensitive`, migration deferred alongside Guardian work |
| 4 | Guardian legacy address/Aadhaar | Confirmed still present on the `Guardian` row (`addressLine1/2/city/state/country/pincode`, plaintext `aadhaarNo`) | **REQUIRES BUSINESS DECISION** |
| 5 | Real production ScanPort | Confirmed still fail-closed: `NullScanAdapter` refuses to mark anything CLEAN when `NODE_ENV === 'production'` | **REQUIRES INFRASTRUCTURE** |
| 6 | Production cloud StoragePort | Confirmed still gated: `StorageModule` throws for any provider other than `local` | **REQUIRES INFRASTRUCTURE** |
| 7 | DB-level enforcement of immutable Address | Confirmed no trigger exists; immutability is service-layer convention only (no update path in code, but nothing stops a raw `UPDATE`) | **SAFE TO DEFER** — no write path exists today, low risk |
| 8 | Person permissions limited to SUPER_ADMIN | Confirmed **partially stale**: `Person.View`/`Search` are already granted to STAFF/BRANCH_ADMIN/ORG_ADMIN; only `AttachGovernmentId`/`Correct` (write operations) remain admin-tier, which is appropriate | **SAFE TO DEFER** — behaves correctly as-is |
| 9 | Applicant master-reference validation | **CLOSED.** All master references are real, DB-enforced Prisma FKs, checked for existence, branch-ownership, and active status before insert. This item was stale in the audit brief and is removed from the open list. | **CLOSED** |
| 10 | Document retention/archival policy | Confirmed genuinely unimplemented — no sweep/cron job exists; `retentionYears` is stored but unread. A working `setInterval`-based sweep pattern already exists for a different concern (`offer-expiry.job.ts`), so this is implementable on a known pattern whenever prioritized | **SAFE TO DEFER** |

One item not on the original list, found during this audit's own Document
review (§8): the `DocumentType` vs `DocumentRequirement` permission-naming
overlap. **SAFE TO DEFER**, not a security issue.

## 21. Blocking Issues

**None.**

## 22. Required Fixes

**None.** No genuine correctness or security defect was found that would
justify a code change under this audit's own discipline ("do not solve it
merely to make the audit look cleaner"). No files were modified as part of
this audit.

## 23. Deferred Items

See §20 for the full carried-forward list with classifications. Summary by
category:

- **Requires business decision (4):** Recovery-KEK ceremony; legacy
  plaintext Aadhaar migration timing for both Applicant and Guardian;
  resolving the one grandfathered `NOT VALID`-constraint Applicant row.
- **Requires infrastructure (2):** real virus scanning; a real cloud
  storage provider.
- **Safe to defer (5):** DB-trigger enforcement of Address immutability;
  Address overlapping-window prevention; document retention sweep job;
  Applicant reapply/resubmission traceability linkage; the DocumentType/
  DocumentRequirement permission-naming split.

## 24. Final Freeze Decision

**READY TO FREEZE.**

The Person → Applicant → Guardian → Address → Documents → Admission
Workflow → Student → Admission → Enrollment core, as it exists today, does
not need to move again for Fees to be built safely on top of it. Every
invariant Fees will depend on — Student's identity stability, Enrollment's
`(studentId, enrollmentId, admissionId)` reference triple, tenant isolation,
and the absence of any financial field on Student — is real, verified
against actual code and migrations in this pass, and not merely asserted
from prior reports.

The open items are real but none of them are core-shape problems: they are
either business decisions about legacy data (plaintext Aadhaar, one
grandfathered row) or infrastructure this environment doesn't have yet
(virus scanning, cloud storage) — none requires touching Student, Admission,
or Enrollment, and none blocks Fees from starting.
