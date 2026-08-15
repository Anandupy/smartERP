# CampusFlow — Document Management Specification (S3 / R5)

**Status: `implemented` ✅ 2026-08-17 — foundation only.** Real virus scanning,
cloud storage and direct parent upload are `DEFERRED`, documented below with
what ships in their place. This document is a reconciliation of what R5 built
against `core-admission-lifecycle-specification.md` §11, not a rewrite of it —
where the two disagree, this document says which is correct and why.

---

## 1. Executive summary

Before R5 there was no `Document`, `DocumentVersion`, `DocumentType` or
`DocumentRequirement` model, no storage abstraction, and the
`DOCUMENT_CHECKLIST_SATISFIED` workflow guard was a no-op that had returned
unconditionally since Phase 3 (`WorkflowService`, S1 §2.1-style discrepancy).
`Applicant.photoFileId` and `Student.photoDocumentId` pointed at nothing.

R5 adds:

- `DocumentType` (configurable, masters-style) and `DocumentRequirement`
  (the rule a file must exist — §11.2's distinction, now a real table).
- `Document` / `DocumentVersion` — business identity vs. append-only file
  versions, ownership polymorphic by *what the document proves* (§11.3).
- `StoragePort` / `ScanPort` — provider-agnostic abstractions with
  development-only adapters (local filesystem; a scanner that refuses to run
  in production rather than fabricate a result).
- `DocumentService` — upload, replace, verify, reject, archive, download.
- `ChecklistService` — the first real implementation of
  `DOCUMENT_CHECKLIST_SATISFIED`, wired into `WorkflowService`.
- Encryption reuse: `IdentityCryptoService.encryptBuffer`/`decryptBuffer`,
  the same per-organization DEK Person/Address already use.

What did **not** ship, and why, is in §32 (Deferred Work).

---

## 2. Scope

In scope: the shared document foundation — metadata, storage reference,
lifecycle, versioning, verification, requirements, checklist wiring,
permissions, events, tenant isolation.

Out of scope, explicitly: Fees, Attendance, Examination, Transport, Library,
HR, Parent Portal, OCR, digital signatures, AI extraction, a rules engine for
admission policy, retention/archival sweep jobs, presigned URLs, multi-cloud
routing. None of these were required by an existing architecture reference to
support this foundation minimally, so none were built.

---

## 3. Current state before this phase

`VERIFIED` against the repository directly, not against documentation:

| Item | Found |
| :--- | :--- |
| `Document`/`DocumentVersion`/`DocumentType`/`DocumentRequirement` model | None existed |
| Storage abstraction | None existed |
| Upload service | None existed |
| `Applicant.photoFileId` | `String?`, no FK, nothing reads it |
| `Student.photoDocumentId` | `String?`, **deliberately no FK** (kept — see §6) |
| Document categories/masters | None existed |
| Document events | None existed |
| `DOCUMENT_CHECKLIST_SATISFIED` guard | Declared on `documentsReceived` and `approve`, returned unconditionally |

Also checked and found already correct, so left alone: `PrismaErrorTranslator`
generically handles `P2002` for any table, including the new ones; the
outbox/event pattern established in R4/R4.5 needed no changes to accommodate
Documents.

---

## 4. Domain model

```
DocumentType (config)              DocumentRequirement (config)
      |                                    |
      | 1                                  | references
      v                                    v
  Document ---------- currentVersionId -> DocumentVersion
      |  (ownerType, ownerId)                 |
      |  polymorphic, service-validated        1..n, append-only
      v
  Person | Applicant | Admission | Enrollment | Student | Organization | Branch
```

`Document` is business identity: who owns it, what type, current status.
`DocumentVersion` is one uploaded file: storage reference, scan result,
verification result, checksum. See `prisma/modules/documents/document.prisma`
for the full field-level rationale — every non-obvious field there carries a
doc-comment explaining why it exists, which this document does not repeat.

---

## 5. Document vs File

| | Document | DocumentVersion (the "file") |
| :--- | :--- | :--- |
| Identity | business (owner, type, lifecycle) | one uploaded artefact |
| Mutates | status, currentVersionId, expiresAt | never — append-only |
| Storage detail | none | storageProvider, storageKey, checksum, mimeType, sizeBytes, encryptionKeyVersion |

A `Document` can have many versions (§9). Exactly one is ever "current" —
enforced structurally by `Document.currentVersionId` being a nullable
**unique** foreign key, not by a constraint that could be forgotten.

---

## 6. Ownership

Ownership follows §11.3's rule exactly, unchanged: **what does this document
prove?** A fact about the human → `PERSON`. Evidence for one attempt →
`APPLICANT`. A fact about a spell of study → `ADMISSION`. A fact about a year
→ `ENROLLMENT`. A student-role fact that is not about a placement → `STUDENT`.
Plus `ORGANIZATION` and `BRANCH` for institution-level documents (affiliation
certificates and similar), which §11.3's table did not enumerate but the R5
brief explicitly asked to support.

`Document.ownerType` is an enum: `PERSON | APPLICANT | ADMISSION | ENROLLMENT
| STUDENT | ORGANIZATION | BRANCH`. `EMPLOYEE` is absent — S4 does not exist.
A distinct `GUARDIAN` owner type is absent deliberately: a guardian's own
documents are owned by their `Person` row, once resolved (§11.3, "Guardian ID
proof → PERSON").

**A normal SQL foreign key cannot point at "whichever table `ownerType`
names."** Referential integrity for `(ownerType, ownerId)` is therefore a
**SERVICE** invariant, not a database one: `OwnerResolverService.resolve()`
looks up the named row **within the caller's own verified scope** — never a
scope the client claims — before any `Document` row is written. A
cross-tenant `ownerId` 404s at that point, the same 404-not-403 rule every
other lookup in this codebase follows. `Document.organizationId` (always) and
`Document.branchId` (only for owners fixed to one branch for life) are
stamped from the *resolved* owner, never from client input.

Orphaning on owner deletion is not a practical risk: every candidate owner
table is soft-deleted (`deletedAt`) or, for `Person`, never deleted at all —
the existing convention this schema already relies on elsewhere, not a new
mechanism built for Documents.

`Student.photoDocumentId` is kept exactly as-is (plain `String?`, no FK) per
S3's own prior note — Student must compile and migrate whether or not S3
exists, which is now moot since it does, but changing it is a Student
concern outside R5's boundary. `Applicant.photoFileId` is **still
recommended for removal** (§11.1) but not touched — dropping a column from
`Applicant` is an Applicant/I2 concern, not a Documents one.

**Scope shape by owner type**, decided here and enforced in
`OwnerResolverService`:

| ownerType | Document.branchId | Why |
| :--- | :--- | :--- |
| `PERSON` | `null` | Org-scoped for life, matches Person/Guardianship (R4.5) |
| `STUDENT` | `null` | `Student.branchId` moves on transfer; a health record must not go stale when it does |
| `ORGANIZATION` | `null` | Institution-level |
| `APPLICANT` | owner's own | Applicant is branch+year fixed for life |
| `ADMISSION` | owner's own | Admission is branch-fixed for life |
| `ENROLLMENT` | owner's own | Enrollment is branch+year fixed for life |
| `BRANCH` | the branch's own id | Inherently branch-specific |

---

## 7. Document types

Configurable, not hard-coded — `DocumentType` follows the exact visibility
shape the Admissions masters already use (system default / organization
default / branch-specific, via nullable `organizationId`/`branchId`), so an
institution can define its own document catalogue the same way it defines its
own Quota or Category list. Fields: `code`, `name`, `isSensitive`,
`hasExpiry` + `defaultValidityMonths`, `retentionYears`, `allowedMimeTypes`,
`maxSizeBytes`, `displayOrder`, `isActive`.

`isSensitive` drives the stricter download rule in §17. `hasExpiry` +
`defaultValidityMonths` drive `Document.expiresAt` at upload/replace time.
`retentionYears` is read by nothing yet — a future retention sweep is
`DEFERRED` (§21).

---

## 8. Requirements

§11.2's distinction, implemented for real: a **document** is a file that
exists; a **requirement** is the rule that one must. `DocumentRequirement`
variance is `programId x quotaId x categoryId`, each nullable meaning
"applies to all."

**Discrepancy, recorded rather than silently resolved:** §11.2's formula also
names an `admissionType` axis (`admissionType x programId x quotaId x
categoryId`). `Applicant` carries no `admissionType` column — `VERIFIED`
against `applicant.prisma` — so that axis is not implemented. Adding it would
mean inventing a field on `Applicant`, which is out of R5's boundary (§28).
`requiredByStage` reuses `AdmissionApplicationStatus` directly rather than a
parallel enum, so a stage that stops existing cannot leave an orphaned
requirement silently valid.

No rules engine: an institution expresses policy as a set of
`DocumentRequirement` rows via `POST /document-requirements`, not as
configurable logic.

---

## 9. Versioning

`DocumentVersion.versionNumber` is 1-based and append-only —
`@@unique([documentId, versionNumber])` at the database. A replacement is
never an overwrite: `DocumentService.replace()` inserts a new row, marks the
prior current version's `supersededAt`, and only repoints
`Document.currentVersionId` once the new version's scan result is `CLEAN`.

Old versions are **never deleted**, and there is no route that deletes one.
**Re-verification is always required**: a new `DocumentVersion` row starts
`verificationStatus: PENDING` unconditionally — it structurally cannot
inherit the previous version's `VERIFIED` status, because it is a distinct
row with its own default. Verification and rejection are per-version
(`verifiedBy`, `verifiedAt`, `rejectionReason` all live on
`DocumentVersion`, not `Document`).

Download always serves the current version unless a specific `versionId` is
requested (for audit/history), and a version whose scan result is not
`CLEAN` is never served regardless of which one is asked for (§13, §17).

---

## 10. Lifecycle

**Document-level:** `ACTIVE -> ARCHIVED`. One-way, staff-initiated
(`documents.archive`), never automatic, never a delete. An archived document
and every one of its versions stay in the database and in storage — a
document referenced by an approved admission must not disappear because its
owner is later archived (§19, §21).

**Version-level**, per §11.5:

```
upload -> scan -> CLEAN    -> becomes current -> verification PENDING
                                                    |-> VERIFIED
                                                    '-> REJECTED (+ reason)
                -> INFECTED -> never current, quarantined, admin alerted
                -> FAILED   -> never current, never assumed clean
```

`FAILED` is never treated as `CLEAN` — a scanner that is down is a reason to
refuse the upload, not to wave it through (enforced by the same code path
that handles `INFECTED`: only `scanStatus === CLEAN` ever sets
`currentVersionId`). This is a fact spanning `Document` and
`DocumentVersion` together, so it cannot be a single-table CHECK constraint —
it is proven by test instead (`document.service.spec.ts`,
`document.integration-spec.ts`), matching §11.5's own instruction that this
needs an explicit test rather than a comment.

Expiry (`Document.expiresAt`, derived from `DocumentType.defaultValidityMonths`)
**does not invalidate anything** — an expired caste certificate is an
administrative fact, not a workflow gate (§11.5, §11.6). Nothing reads
`expiresAt` to block an operation; a future UI can surface it as a renewal
reminder.

---

## 11. Verification

Verification is a decision, not data entry — gated behind `documents.verify`
/ `documents.reject`, restricted to `BRANCH_ADMIN` and above (§17). A
rejection requires a reason (`RejectDocumentDto.reason`, mandatory,
DB-enforced by `DocumentVersion_rejection_reason_check`). Verification can be
effectively revoked by rejecting a later version, but a `VERIFIED` version
itself is never edited back to `PENDING` — the only path to a fresh
`PENDING` state is a new version (§9). Verified/rejected versions remain
immutable historical fact; nothing downstream depends on a version's
verification status *changing* after the fact, only on which version is
current.

---

## 12. Expiry

`DocumentType.hasExpiry` + `defaultValidityMonths` -> `Document.expiresAt`,
computed at upload/replace time from the new version's `uploadedAt`. Not
mandatory per type — most document types (photograph, application evidence)
have none. See §10 for why expiry never blocks anything.

---

## 13. Storage

### 13.1 Storage vs file — the boundary

`StoragePort` (`src/infrastructure/storage/storage-port.ts`) is the entire
contract: `upload(key, data, contentType)`, `download(key)`, `delete(key)`,
`exists(key)`. `DocumentService` depends on this interface only — it never
imports an S3, Supabase, R2 or GCS SDK, and never sees a bucket, region or
credential. `key` is always generated (`{organizationId}/{documentTypeCode}/
{uuid}`), never derived from the client-supplied filename, which is what
rules out path traversal from a crafted upload name.

### 13.2 Development provider

Only `local` — `LocalFilesystemStorageAdapter` — is implemented. **This
repository holds no credentials for a real object-storage account**, and
provisioning one was not something this phase could safely do on the user's
behalf. Per the phase brief's own fallback ("if no suitable free provider is
reliably available... implement the storage port and a minimal local
development adapter instead, and document the provider as deferred"), that
is exactly what shipped. The adapter writes under a configured root
(`DOCUMENT_STORAGE_LOCAL_ROOT`, default `./storage/documents`), refuses any
key that resolves outside that root as a second layer of defence, and logs a
loud warning at boot naming itself as development-only.

### 13.3 Cloud providers — deferred

S3-compatible adapters (`s3`, `r2`, `gcs`, `supabase`) are **not stubbed**.
`StorageModule`'s factory throws a named error at boot if
`DOCUMENT_STORAGE_PROVIDER` names anything but `local` — a stub that
silently accepted uploads it could not durably store would be worse than a
deployment that fails to start. DQ2 (§11.7: "where are blobs stored?")
remains `REQUIRES BUSINESS DECISION`; the spec's own recommendation (one
S3-compatible contract everywhere, e.g. MinIO on-premise) is unchanged and
is exactly what plugging in an `s3`-compatible adapter behind `StoragePort`
would satisfy without touching `DocumentService`.

### 13.4 Upload flow

Backend-mediated, not direct-to-storage: `Client -> DocumentController
(multipart) -> validation -> DocumentService -> StoragePort -> adapter`.
Chosen over presigned/direct upload because (a) DQ3 recommends staff-only in
v1 anyway, so there is no browser-direct-upload requirement to optimise for,
and (b) a local filesystem adapter has no presigned-URL concept, so
backend-mediated is the only shape that works identically across `local` and
a future S3-compatible adapter without a day-one branch in the domain logic.
If a cloud adapter is added later and file sizes grow enough to justify
direct upload, the backend still owns authorization, object-key generation,
and finalization — `DocumentService` would gain a two-step "intent then
confirm" flow, not lose control of any of those.

---

## 14. Security

### 14.1 Encryption

File bytes are encrypted under the owning organization's data key before
`StoragePort.upload()` is ever called — `IdentityCryptoService.encryptBuffer`
/`decryptBuffer`, added to the *existing* crypto service rather than
duplicating its envelope-encryption implementation (AES-256-GCM, the same
per-organization DEK, the same key-version tracking `PersonSensitive` and
`Address` already use). What the storage adapter receives is opaque
ciphertext with `Content-Type: application/octet-stream` — the real MIME
type is never visible at the storage layer, a small extra layer of
defence-in-depth beyond what was strictly required.

`DocumentVersion.encryptionKeyVersion` records which DEK generation produced
each version's ciphertext, exactly like every other encrypted field in this
schema, so a future key rotation is representable without a data migration.

### 14.2 Upload validation

- **MIME allow-list** per `DocumentType.allowedMimeTypes` — checked against
  the client-declared `Content-Type`.
- **Magic-byte verification** for the three types this deployment can
  actually sniff without a new dependency: PDF (`%PDF`), JPEG (`FFD8FF`),
  PNG (`89504E47...`). A declared type outside that set is trusted — a
  recorded, deliberate gap (no `file-type`-equivalent package is a project
  dependency; adding one was out of scope for a foundation phase). See
  `mime-sniff.ts`.
- **Size limit** per `DocumentType.maxSizeBytes`, plus a global 25 MiB
  ceiling on the multipart interceptor itself as defence-in-depth against a
  misconfigured per-type limit.
- **Storage key never derived from the filename** — generated, always.
  `originalFilename` is stored only for display, sanitised to strip path
  separators and control characters.
- **Checksum** (`SHA-256`) computed and stored on every version; a re-upload
  identical to the current version is refused (`DOCUMENT_UNCHANGED`, 409)
  rather than silently creating a pointless new version.
- **Duplicate/concurrency safety**: two concurrent first-uploads for the
  same `(ownerType, ownerId, documentType)` resolve to one `ACTIVE`
  `Document` via a partial unique index at the database, with the loser's
  request retried as "add a version to the winner" rather than erroring
  (§22).

### 14.3 Virus scanning

`ScanPort` (`src/infrastructure/scan/scan-port.ts`) is mandatory and
blocking on ingest, per §11.4's `DECIDED` rule — every upload is scanned
before it can become current, no exceptions. **No real scanner is available
to this deployment.** DQ1 (§11.7) recommends ClamAV, described there as real
infrastructure this deployment does not run. Rather than fabricate a
scanner that always answers `CLEAN` — which is exactly the
`DOCUMENT_CHECKLIST_SATISFIED` no-op mistake this phase exists not to
repeat — `NullScanAdapter` follows the identical pattern
`EnvRecoveryKeyProvider` already established for an unconfigured security
dependency: outside production it marks every upload `CLEAN` with a loud,
one-time boot warning; **in production it refuses to scan at all**, and
every upload is rejected with `SCAN_NOT_CONFIGURED` rather than silently
passed through. A real deployment must bind a `ScanPort` implementation
(ClamAV sidecar or an approved cloud API — DQ1 remains `REQUIRES BUSINESS
DECISION`, specifically whether a cloud scanner sending student documents to
a third party is acceptable under DPDP) before it can accept any document
upload in production.

### 14.4 Download

Never a public or presigned URL. `GET /documents/:id/download` streams
decrypted bytes through the backend after: scope check, scan-status check
(anything but `CLEAN` is refused with `403 VERSION_NOT_CLEAN`, unconditionally
— no permission overrides this), and a sensitivity check (`isSensitive`
document types additionally refuse the `STAFF` role, requiring
`BRANCH_ADMIN` or above). Every successful download publishes
`document.downloaded` directly via `EventBus` (not the outbox — a download
commits no data of its own to attach the event to, matching the existing
"outbox for what a transaction just committed, direct publish otherwise"
rule from `OutboxPublisher`'s own documentation).

---

## 15. Tenant isolation

Documents follow the exact organization/branch scoping precedent §6
establishes: org-scoped for `PERSON`/`STUDENT`/`ORGANIZATION`-owned
documents (any branch within the org can reach them, matching
Person/Guardianship from R4/R4.5), branch-fixed for
`APPLICANT`/`ADMISSION`/`ENROLLMENT`/`BRANCH`-owned ones. Every operation —
create, read, replace, verify, reject, archive, download — resolves scope
before touching a row, and a cross-tenant id 404s (never 403) at every one
of those points, proven in `document.integration-spec.ts` against real
Postgres rather than asserted only at the unit level.

---

## 16. Permissions

```
documents.view / documents.upload / documents.download /
documents.verify / documents.reject / documents.replace / documents.archive
documents.requirements.manage   (DocumentType + DocumentRequirement config)
```

Chosen to match this codebase's existing convention of splitting by
*operation*, not CRUD verb (Enrollment does the same) — verify/reject are
reviewer decisions with different consequence than upload/replace, and
configuring what a document type *is* is a different capability than
uploading one, mirroring `AdmissionsMasters` vs `Admissions`.

| Role | Granted |
| :--- | :--- |
| `SUPER_ADMIN` | Everything (bypass — all active permissions) |
| `ORG_ADMIN`, `BRANCH_ADMIN` | Full set including verify/reject/archive/requirements.manage |
| `STAFF` | view, upload, download, replace — **not** verify/reject/archive/requirements.manage |

Seeded in `SeederService` under a new `DOCUMENTS` permission category; the
project's own `permission-catalog-coverage.spec.ts` (unit test) enforces
that no permission referenced in code is left unseeded — it caught and
required fixing exactly this gap during R5.

---

## 17. Admission integration

`WorkflowService`'s `DOCUMENT_CHECKLIST_SATISFIED` guard (declared on
`documentsReceived`: `DOCUMENT_PENDING -> UNDER_REVIEW`, and `approve`: various
`-> APPROVED`) now calls `ChecklistService.isSatisfied()` with the
applicant's `programId`/`quotaId`/`categoryId`/`personId` and the two
`AdmissionApplicationStatus` values relevant to the transition (the
applicant's current status and the transition's target — not an invented
ordering over the whole 13-state graph, which stays owned by
`workflow.transitions.ts`). A failed check throws `409 DOCUMENTS_INCOMPLETE`
naming the missing document types, matching the error code the lifecycle
spec's own error table already documented for this case.

A requirement is satisfied by a `VERIFIED` current version on either the
`APPLICANT`-owned document of that type, or (once the applicant has a
resolved `Person`) the `PERSON`-owned one — matching §11.3's ownership table,
since a birth certificate "required for this applicant" is legitimately a
`PERSON`-owned fact. Missing documents can be overridden only by not
configuring the requirement as mandatory in the first place — there is no
"override with reason" bypass route, because none was requested and adding
one is a policy decision outside this phase's authority to make silently.

`Applicant.photoFileId` remains `RECOMMENDED: drop` (§11.1), unchanged by
this phase — see §6.

---

## 18. Student integration

Unchanged. `Student.photoDocumentId` stays a plain `String?` with no FK, by
design (§6) — Student does not depend on the Documents module, matching the
one-way dependency direction this codebase enforces everywhere (`documents`
has no import from `identity` or `admissions`; `admissions` imports
`documents`, via `WorkflowModule`, for `ChecklistService` only).

---

## 19. Guardian integration

A guardian's identity documents (Aadhaar copy, etc.) are owned by the
guardian's `Person` row once R4.5's `Guardian.personId` resolution has run —
no distinct `GUARDIAN` owner type exists (§6). This phase did not add any
guardian-specific document logic; it only made `PERSON` a valid, working
owner type that a resolved guardian's documents can already use.

---

## 20. Retention

`DocumentType.retentionYears` exists on the schema and is read by nothing —
**`DEFERRED`**. No retention/archival sweep job exists. Archiving a document
is a manual staff action only (§10); nothing automatically archives a
document when its owner's admission closes or its applicant is rejected.
This is a deliberate scope boundary, not an oversight: building a
time-based sweep with legal-hold semantics is a materially larger piece of
work than this foundation, and §19 of the phase brief explicitly warns
against letting a document disappear silently just because its owner
becomes archived — the safe default until a real retention policy exists is
"never delete automatically," which is exactly what shipped.

---

## 21. Audit

No direct `AuditService` dependency anywhere in the Documents module — every
mutation event goes through the transactional outbox
(`OutboxPublisher.enqueue`), which the existing audit relay already
consumes, the same pattern R4/R4.5 established. The one read-only exception
(`document.downloaded`) publishes directly via `EventBus`, per
`OutboxPublisher`'s own documented rule that only events describing
something a transaction just committed belong in the outbox.

---

## 22. Events

| Event | Producer | Transport | Payload |
| :--- | :--- | :--- | :--- |
| `document.uploaded` | `DocumentService.persistVersion` | outbox | documentId, documentVersionId, organizationId, ownerType, ownerId, documentTypeId, versionNumber, becameCurrent |
| `document.scan_failed` | same, when scan result is not `CLEAN` | outbox, `severity: critical` | documentId, documentVersionId, organizationId, scanStatus |
| `document.verified` | `DocumentService.verify` | outbox | documentId, documentVersionId, organizationId, verifiedBy |
| `document.rejected` | `DocumentService.reject` | outbox | documentId, documentVersionId, organizationId, rejectedBy |
| `document.archived` | `DocumentService.archive` | outbox | documentId, organizationId, archivedBy |
| `document.downloaded` | `DocumentService.download` | direct `EventBus.publish` | documentId, documentVersionId, organizationId, downloadedBy |

Chosen as the minimal set that is genuinely load-bearing — not "every
possible lifecycle transition," per the brief's own instruction not to
blindly create all candidates. `document.scan_failed` exists specifically
because §11.5 requires "admin alerted" for an infected/failed scan and
nothing else in this system currently surfaces that. No event ever carries
a filename, storage key, checksum-derived content, signed URL or the file
itself — only ids, enums and booleans, the same rule `person.events.ts` and
`address.events.ts` already state for government identifiers and physical
addresses respectively.

---

## 23. Outbox

Every write-path event uses `OutboxPublisher.enqueue(event, tx)` inside the
same transaction as the row it describes — never `EventBus.publish()`
directly for a committed mutation, which was exactly Defect 6 from the
Guardian reconciliation (R4.5) that this phase does not repeat.

---

## 24. Database invariants

Classified as the phase brief requested:

| Invariant | Class | Enforcement |
| :--- | :--- | :--- |
| Organization isolation | DATABASE + SERVICE | `Document.organizationId` NOT NULL; every query scoped; `OwnerResolverService` resolves within caller scope |
| Document ownership validity | SERVICE | `OwnerResolverService.resolve()` — no FK possible for a polymorphic reference (§6) |
| One ACTIVE document per owner+type | DATABASE | Partial unique index `Document_owner_type_active_key` |
| Version uniqueness | DATABASE | `@@unique([documentId, versionNumber])` |
| Current-version uniqueness | DATABASE (structural) | `Document.currentVersionId` is a nullable **unique** FK — cannot point at two versions, and no other document can share a version |
| Document type validity | DATABASE | FK `Document.documentTypeId -> DocumentType.id` |
| Archive requires actor+timestamp | DATABASE | CHECK `Document_archive_fields_check` |
| Rejection requires a reason | DATABASE | CHECK `DocumentVersion_rejection_reason_check` |
| Version numbers positive | DATABASE | CHECK `DocumentVersion_version_number_positive_check` |
| Immutable historical versions | SERVICE (WORKFLOW-adjacent) | No update/delete route for a superseded version; proven by test, not a DB constraint (versions are mutable rows for scan/verification fields, which legitimately change once) |
| "Infected/unscanned is never current" | SERVICE, spans two tables | Cannot be a single-table CHECK; enforced in `persistVersion` and proven by test (§10) |
| Deletion/archive rules | SERVICE | `archive()` is the only status-changing route; no delete route exists at all |

---

## 25. Concurrency

Tested against real Postgres (`document.integration-spec.ts`) and at the
unit level with a simulated race:

- **Simultaneous first uploads for the same owner+requirement**: the partial
  unique index lets exactly one `Document` insert win; the loser's service
  call catches the `P2002`, re-reads the winner, and proceeds to add its
  upload as that document's version instead of erroring the caller.
- **Simultaneous replacement**: two concurrent `versionNumber` computations
  racing to insert the same number collide on
  `@@unique([documentId, versionNumber])`; the loser is translated to a
  `409 CONCURRENT_REPLACE` asking for retry, the same shape as
  `WorkflowService`'s existing `translateConstraint` pattern for
  `applicant_one_active`.
- **Simultaneous verification/archive**: idempotent by construction — a
  second `verify()` call on an already-`VERIFIED` version simply re-writes
  the same state; a second `archive()` call on an already-`ARCHIVED`
  document is refused with `409 ALREADY_ARCHIVED` rather than silently
  succeeding twice.

No race produces two contradictory "current" versions — provable directly
from §14's structural argument (a unique nullable FK), not just by test,
though the test exists too.

---

## 26. Migration safety

Pre-migration inventory (`prisma/migrations/20260817000000_r5_document_management`,
run against both dev and test databases before any DDL): 1 dev `Applicant`
with `photoFileId` null and a stale `checklistStatus` value nothing reads; 0
`Student` rows with `photoDocumentId` set; zero pre-existing tables matching
`%document%` in either database. The migration is entirely additive — new
tables, new enums, new columns on nothing (no existing table was altered).
Applied cleanly to both databases with `prisma migrate deploy`; `prisma
migrate status` reports zero drift on both after. No backfill was performed
or was necessary.

---

## 27. API contract

All routes under `/documents`, `/document-types`, `/document-requirements`.
Every route requires `@RequirePermission` and `@Roles` (enforced by test,
`document.controller.permissions.spec.ts`) and resolves scope via
`resourceScopeOf`/`organizationScopeOf` before touching data.

| Method | Route | Permission | Scope | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/documents` | `documents.upload` | branch | multipart: `file` + `ownerType`/`ownerId`/`documentTypeId` |
| `GET` | `/documents?ownerType=&ownerId=` | `documents.view` | branch | list for one owner |
| `GET` | `/documents/:id` | `documents.view` | branch | with version history |
| `POST` | `/documents/:id/replace` | `documents.replace` | branch | multipart: `file` |
| `POST` | `/documents/:id/verify` | `documents.verify` | branch | `BRANCH_ADMIN`+ only |
| `POST` | `/documents/:id/reject` | `documents.reject` | branch | body: `reason` (mandatory), `BRANCH_ADMIN`+ only |
| `POST` | `/documents/:id/archive` | `documents.archive` | branch | body: `reason?`, `BRANCH_ADMIN`+ only |
| `GET` | `/documents/:id/download?versionId=` | `documents.download` | branch | streams decrypted bytes; sensitive types refuse `STAFF` |
| `POST`/`GET`/`PATCH`/`DELETE` | `/document-types` | `documents.requirements.manage` (write) / `documents.view` (read) | branch (masters-style visibility) | |
| `POST`/`GET`/`PATCH`/`DELETE` | `/document-requirements` | `documents.requirements.manage` (write) / `documents.view` (read) | organization | |

Errors used: `400` (`MIME_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`,
`MIME_TYPE_MISMATCH`, `FILE_REQUIRED`, `OWNER_REQUIRED`), `403`
(`VERSION_NOT_CLEAN` on download, `SENSITIVE_DOCUMENT_RESTRICTED`), `404`
(owner/document not found — never 403 for a cross-tenant id), `409`
(`DOCUMENT_TYPE_INACTIVE`, `DOCUMENT_UNCHANGED`, `NO_CURRENT_VERSION`,
`ALREADY_ARCHIVED`, `CONCURRENT_REPLACE`, `DOCUMENTS_INCOMPLETE` — from the
workflow guard, not this module directly), `422`
(`DOCUMENT_SCAN_FAILED`).

---

## 28. Validation matrix

| Field | Type | Required | Notes | Editable until | Error code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DocumentType.code` | string | yes | upper-snake-case, unique per scope | always (staff) | `DUPLICATE_DOCUMENT_TYPE` |
| `DocumentType.allowedMimeTypes` | string[] | yes, min 1 | | always | `400` |
| `DocumentType.maxSizeBytes` | int | no, default 10 MiB | 1 KiB–50 MiB | always | `400` |
| Upload `ownerType` | enum | yes | 7 values, see §6 | n/a | `400` |
| Upload `ownerId` | uuid | yes | resolved+scope-checked | n/a | `404` if not found in scope |
| Upload `file` | multipart | yes | ≤25 MiB global, ≤type limit, allow-listed MIME, magic-byte checked for pdf/jpeg/png | n/a | `400`/`422` |
| Reject `reason` | string | yes, 3–500 chars | | n/a | `400` (DTO validation) |
| Archive `reason` | string | no, ≤500 chars | | n/a | — |
| `DocumentRequirement.requiredByStage` | `AdmissionApplicationStatus` | yes | any enum value | | `400` |
| `DocumentRequirement.isMandatory` | bool | no, default true | | | — |

---

## 29. Testing

- **Unit** (`test/unit/`): `document.service.spec.ts` (upload new/existing,
  duplicate-checksum refusal, scan-failure quarantine, MIME/size/magic-byte
  validation, inactive-type refusal, concurrent-replace race translation,
  expiry derivation, verify/reject, archive, download incl. sensitive-type
  STAFF restriction and non-CLEAN refusal — 30 tests), `checklist.service.spec.ts`
  (9), `owner-resolver.service.spec.ts` (11), `document.controller.permissions.spec.ts`
  (9), plus the R5 additions to `workflow.service.spec.ts` (3, covering the
  checklist guard's pass/fail/argument-passing behaviour).
- **Integration** (`test/integration/document.integration-spec.ts`, real
  Postgres + real local storage + real encryption): full upload -> verify ->
  download round trip, versioning with re-verification reset, archive
  without deletion, all 4 hand-written DB CHECK/unique invariants, org
  isolation across every mutating route, and the non-CLEAN-never-served
  guarantee — 15 tests.
- **Not covered** (explicitly, per §32): real ClamAV/cloud scanning (no
  scanner available to test against), real cloud storage adapters (none
  exist), presigned URL security (no presigned URLs exist), rollback beyond
  what Prisma's own transaction semantics already guarantee and R5's tests
  already exercise for the two-phase storage-then-DB write.

`pnpm typecheck` / `pnpm lint`: clean, zero new errors or warnings anywhere
in the touched files (1034 pre-existing warnings elsewhere, unchanged).
`pnpm test:unit`: 796/796. `pnpm test:integration`, this file alone: 41/41,
reliably repeated across every run. Full 80-file integration suite: see §31
for the one finding that did not resolve.

---

## 30. Risks

- No real virus scanner in any environment — production cannot accept
  uploads until one is bound (§14.3, fail-closed by design, not a silent gap).
- Local filesystem storage is not durable across environments or instances —
  unsuitable beyond single-instance development (§13.2).
- Magic-byte verification covers only 3 formats; anything else trusts the
  declared Content-Type (§14.2).
- `DocumentRequirement` has no `admissionType` axis (§8) — an institution
  that genuinely needs to vary requirements by admission type cannot yet.

---

## 31. Deferred work

| Item | Why | Where it would land |
| :--- | :--- | :--- |
| Real virus scanning (ClamAV or an approved cloud API) | No infrastructure in this repo/environment to bind; DQ1 remains a business decision (self-hosted vs. third-party DPDP exposure) | New `ScanPort` implementation, no `DocumentService` change needed |
| Cloud storage adapter (S3-compatible) | No credentials available to provision or safely test one | New `StoragePort` implementation, no `DocumentService` change needed |
| Presigned/direct-to-storage upload | Not needed while `local` is the only adapter; DQ3 already recommends staff-only backend-mediated for v1 | `DocumentController` + `StoragePort` extension |
| Retention/archival sweep job | Materially larger scope than a foundation phase; §19's own warning against silent disappearance makes "no automatic sweep" the safe default | A scheduled job reading `DocumentType.retentionYears` |
| `admissionType` axis on `DocumentRequirement` | `Applicant` has no such column; adding one is an Applicant/I2 change | `applicant.prisma` + this module's requirement matching |
| Dropping `Applicant.photoFileId` | Applicant/I2 concern, not Documents' to make | I2 phase |
| Direct parent/guardian upload | DQ3 recommends staff-only for v1; portal scoping and rate limiting not designed | A future portal-facing route, once scoped |
| Multi-provider / per-document-class routing (e.g. documents -> Provider A, backups -> Provider B) | Not required by any current use case; `StoragePort`'s single-binding-per-deployment shape does not prevent adding it later | `StorageModule`'s factory, extended |

---

## 32. Open decisions

Carried forward unchanged from §11.7, still `REQUIRES BUSINESS DECISION`:

- **DQ1** — self-hosted ClamAV vs. a cloud scanning API (DPDP third-party
  exposure). Recommendation on file: ClamAV.
- **DQ2** — deployment storage target. Recommendation on file: one
  S3-compatible contract everywhere (e.g. MinIO on-premise).
- **DQ3** — direct parent upload. Recommendation on file: staff-only in v1,
  which is what shipped.

None of these block the foundation itself; they block only the specific
capabilities listed in §31 that depend on them.

---

## 33. Final architecture

```
DocumentController / DocumentTypeController / DocumentRequirementController
                    |
            DocumentService  ChecklistService  DocumentTypeService  DocumentRequirementService
                    |                |
         OwnerResolverService   (reads DocumentRequirement + Document, no dependency on WorkflowService)
                    |
   IdentityCryptoService.encryptBuffer/decryptBuffer   StoragePort   ScanPort
        (existing, extended)                          |               |
                                          LocalFilesystemStorageAdapter  NullScanAdapter
```

Dependency direction: `documents` depends on nothing from `admissions` or
`identity` as a module edge — cross-module scope reads go through the shared
`PrismaService` directly (the same pattern `GuardianshipService` already
uses for `Person`), never a service import. `admissions` (via
`WorkflowModule`) imports `documents`, for `ChecklistService` only. This
keeps the one-way edge rule this codebase enforces everywhere intact:
`admissions -> documents`, never the reverse.

---

## 34. Storage provider abstraction

See §13.1. `StoragePort` is an abstract class (matching the existing
`OperationalKeyProvider`/`RecoveryKeyProvider` pattern in
`src/infrastructure/crypto/key-provider.interface.ts`), bound in
`StorageModule` via a factory keyed on `DOCUMENT_STORAGE_PROVIDER`.

## 35. Storage port/adapter contract

```ts
abstract class StoragePort {
  readonly providerName: string;
  upload(key: string, data: Buffer, contentType: string): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;   // idempotent
  exists(key: string): Promise<boolean>;
}
```

Bytes handed to `upload()` are already final ciphertext — the adapter never
sees plaintext and never performs encryption itself, so a provider swap can
never accidentally change what is or is not encrypted at rest (§14.1).

## 36. Development storage provider

`LocalFilesystemStorageAdapter`, `providerName: 'local'`. Root directory via
`DOCUMENT_STORAGE_LOCAL_ROOT` (default `./storage/documents`; test suite
points it at `./storage/documents-test`, gitignored). Logs a boot warning
identifying itself as development-only and pointing at this document.

## 37. Provider replacement strategy

Add a new class implementing `StoragePort`, add one more `case`/binding in
`StorageModule`'s factory, set `DOCUMENT_STORAGE_PROVIDER`. Nothing in
`DocumentService`, `DocumentController`, any DTO, any Prisma model, or any
other business/domain code changes. `DocumentVersion.storageProvider`
records which adapter wrote each version, so old versions written under
`local` remain resolvable even after a deployment switches its *new* uploads
to a cloud adapter — no migration of existing blobs is required to add a
second provider going forward (routing *which* provider a given upload uses
is `DEFERRED`, §31, since nothing needs it yet).
