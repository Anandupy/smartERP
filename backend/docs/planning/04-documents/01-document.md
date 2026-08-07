# S3 — Documents

> **Status:** `planned` — §10 has three open questions
> **Depends on:** F1 (encryption), F2 (configuration), I1 (Person)
> **Depended on by:** admissions checklist, verification workflow, certificates, government reporting, employee records

**New module.** There is **no `Document`, `File` or `Attachment` model** in the
schema. `Applicant.photoFileId` (`schema.prisma:162`) references nothing — it is
a column with no target table.

> **Naming warning:** `docs/document.md` in the repository root is the **project
> structure** document. It has nothing to do with this module. Do not link them.

---

## 1. Purpose

S3 owns **stored files and what is known about them** — upload, versioning,
verification, expiry, retention — plus the separate question of **which
documents are required** for a given admission.

It does **not** own what a document *proves*. That an applicant is eligible is
Admissions' conclusion; S3 only records that a caste certificate was uploaded,
verified by whom, and when it expires.

---

## 2. Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | **One shared module with polymorphic ownership** (`ownerType`, `ownerId`) | §9 Q1. Per-module document tables produce five upload paths, five virus-scan implementations and five retention policies. |
| D2 | **Requirements are a separate concept from documents** | See §2.1 — the half that is usually forgotten. |
| D3 | **New upload = new version; old versions retained** | §9 Q2. Re-uploading a corrected marksheet must not erase what was originally submitted. |
| D4 | **Virus scanning is mandatory and blocking on ingest** | §9 Q15. Parents upload arbitrary files from arbitrary devices. An unscanned blob is never served. |
| D5 | **Storage is abstracted behind an interface** | Deployment is undecided (P5). Local disk, S3 and Azure Blob differ only in an adapter. |
| D6 | **Blobs are encrypted at rest per F1** | Using the organization's DEK, so tenant offboarding crypto-shreds documents along with everything else. |
| D7 | **Files are served through signed, short-lived, audited URLs — never a public path** | A predictable URL to a student's birth certificate is a data breach with extra steps. |
| D8 | **Documents attach to `Person` where they are about a human**, to Student/Admission where they are about a study spell | A birth certificate follows the person; a Transfer Certificate belongs to an admission. |
| D9 | **OCR and digital signatures are Phase 3** | §9 Q5, Q6. Design storage to accept a detached signature; build neither now. |

### 2.1 Requirements versus documents

A document is a file that exists. A **requirement** is the rule that a file must
exist. They are different tables and the second is usually forgotten, which is
why `DOCUMENT_PENDING` (already in your workflow) has nothing to compute against.

Which documents are required is a function of:

```
admissionType × programId × quotaId × categoryId
```

A general-category regular admission needs a birth certificate and a marksheet.
An RTE admission additionally needs an income certificate and residence proof. A
migration admission needs a migration certificate. Hard-coding that is how
institutions end up unable to run their own admission policy.

So `DocumentRequirement` declares the rule, and a checklist is computed per
applicant. `DOCUMENT_PENDING` then means something precise: at least one
unsatisfied mandatory requirement.

---

## 3. Data model

### 3.1 `DocumentType` — master, three-tier scoped

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id`, `code`, `name`, `description` | | Follows the existing master pattern |
| `organizationId?` / `branchId?` | `String?` | Null = SYSTEM-level (F1/F2 three-tier resolution) |
| `isIdentityProof`, `isAddressProof`, `isAcademicProof` | `Boolean` | Classification, so rules can say "any identity proof" |
| `hasExpiry` | `Boolean` | Caste, income, medical fitness certificates expire |
| `defaultValidityMonths` | `Int?` | |
| `maxFileSizeMb`, `allowedMimeTypes` | | Per type — a photo is not a 40 MB PDF |
| `retentionYears` | `Int?` | Drives archival (§9 Q13) |

### 3.2 `Document`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID v7` | |
| `organizationId` | `String` | Scopes the DEK (D6) |
| `ownerType` | `DocumentOwnerType` | `PERSON`, `STUDENT`, `ADMISSION`, `ENROLLMENT`, `GUARDIAN`, `EMPLOYEE`, `ORGANIZATION`, `BRANCH` |
| `ownerId` | `String` | |
| `documentTypeId` | `String` | |
| `currentVersionId` | `String?` | Points at the live version |
| `verificationStatus` | `VerificationStatus` | `PENDING`, `VERIFIED`, `REJECTED` |
| `verifiedBy` / `verifiedAt` / `rejectionReason` | | |
| `expiresAt` | `DateTime?` | From the type's validity |
| `archivedAt`, `deletedAt` | `DateTime?` | Soft delete (§9 Q12) |

### 3.3 `DocumentVersion` — append-only

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID v7` | |
| `documentId` | `String` | |
| `versionNumber` | `Int` | 1, 2, 3… |
| `storageKey` | `String` | Opaque; meaningful only to the adapter (D5) |
| `fileName` | `String` | As uploaded — display only, never used as a path |
| `mimeType`, `sizeBytes`, `checksumSha256` | | |
| `scanStatus` | `ScanStatus` | `PENDING`, `CLEAN`, `INFECTED`, `FAILED` |
| `scannedAt` | `DateTime?` | |
| `encryptionKeyVersion` | `Int` | F1 |
| `uploadedBy`, `uploadedAt` | | |

**`fileName` is never a path.** User-supplied filenames are the classic path
traversal vector; `storageKey` is generated.

### 3.4 `DocumentRequirement`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID v7` | |
| `organizationId` / `branchId?` | | Three-tier |
| `documentTypeId` | `String` | |
| `appliesToAdmissionType` | `AdmissionType?` | Null = all |
| `appliesToProgramId` | `String?` | Null = all |
| `appliesToQuotaId` | `String?` | Null = all |
| `appliesToCategoryId` | `String?` | Null = all |
| `isMandatory` | `Boolean` | |
| `requiredByStage` | `AdmissionApplicationStatus` | e.g. required by `SEAT_CONFIRMED`, not at `DRAFT` |

`requiredByStage` is what lets a school accept an incomplete application and
chase documents later — which is what actually happens.

---

## 4. Invariants

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | Version numbers are unique per document | `@@unique([documentId, versionNumber])` |
| 2 | `currentVersionId` belongs to its document | Composite FK `(currentVersionId, id) → (id, documentId)` |
| 3 | **An infected or unscanned version is never current** | `CHECK` cannot span tables; enforced in the service and asserted in tests |
| 4 | Storage keys are unique | `@@unique([storageKey])` |
| 5 | A verified document cannot be soft-deleted while it satisfies a mandatory requirement | Application-level |
| 6 | Expiry only where the type permits it | Application-validated against `DocumentType.hasExpiry` |
| 7 | A rejected document carries a reason | `CHECK ("verificationStatus" <> 'REJECTED' OR "rejectionReason" IS NOT NULL)` |

Invariant 3 is the security-critical one and cannot be a database constraint —
which means it needs an explicit test, not a comment.

---

## 5. Provenance

`DocumentVersion` is append-only (D3). A replacement never overwrites: it
inserts version *n+1* and moves `currentVersionId`.

Verification is a state change on `Document` with actor, timestamp and reason,
and **re-verification is required when a new version is uploaded** — otherwise
uploading a fresh file inherits the previous file's verified status, which is an
obvious way to slip an unverified document past a checklist.

### The correction test

A parent uploads the wrong marksheet, then the right one:

```
DocumentVersion  v1  storageKey: …  scanStatus: CLEAN  uploadedAt: 10:04
DocumentVersion  v2  storageKey: …  scanStatus: CLEAN  uploadedAt: 10:11
Document             currentVersionId: v2
                     verificationStatus: PENDING   ← reset by the new upload
```

v1 is retained. If a dispute arises about what was originally submitted, it is
still there.

---

## 6. Lifecycle

```
upload ──> [scan PENDING] ──┬──> [CLEAN] ──> becomes current ──> [PENDING verification]
                            │                                          ├──> [VERIFIED]
                            │                                          └──> [REJECTED]
                            ├──> [INFECTED] ──> quarantined, never served, admin alerted
                            └──> [FAILED]   ──> retry; never assumed clean
```

`FAILED` must not be treated as `CLEAN`. A scanner that is down is a reason to
refuse the file, not to wave it through.

Expiry: a scheduled job flags documents past `expiresAt` and notifies. It does
**not** invalidate the admission — an expired caste certificate is an
administrative task, not a reason to un-enroll a child.

---

## 7. API surface

| Method | Path | Purpose | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/documents` | Upload (multipart), returns the document | `STAFF`+ |
| `GET` | `/v1/documents?ownerType=&ownerId=` | List for an owner | `STAFF`+ |
| `GET` | `/v1/documents/:id/download` | **Signed short-lived URL**, audited (D7) | `STAFF`+ |
| `GET` | `/v1/documents/:id/versions` | Version history | `BRANCH_ADMIN`+ |
| `POST` | `/v1/documents/:id/versions` | Upload a replacement | `STAFF`+ |
| `POST` | `/v1/documents/:id/verify` | Verify or reject with a reason | `BRANCH_ADMIN`+ |
| `DELETE` | `/v1/documents/:id` | Soft delete | `BRANCH_ADMIN`+ |
| `GET` | `/v1/applicants/:id/document-checklist` | **Computed** requirements and their satisfaction | `STAFF`+ |
| `GET`/`POST` | `/v1/document-requirements` | Manage rules | `ORG_ADMIN`+ |

The checklist endpoint is what a UI renders and what drives `DOCUMENT_PENDING`.

| Rule broken | Status | `error.code` |
| :--- | :--- | :--- |
| File exceeds the type's size limit | `413` | `PayloadTooLargeException` |
| Disallowed MIME type | `415` | `UnsupportedMediaTypeException` |
| Download before scanning completes | `409` | `ConflictException` |
| Download of an infected file | `403` | `ForbiddenException` |
| Rejection without a reason | `400` | `BadRequestException` |

---

## 8. Events

| Event | When | Consumers |
| :--- | :--- | :--- |
| `document.uploaded` | New document or version | Checklist recompute |
| `document.scan_completed` | Scan finishes | Makes the version current, or quarantines |
| `document.scan_infected` | **Malware found** | Security alert — this one pages someone |
| `document.verified` / `document.rejected` | Verification decision | Admissions workflow |
| `document.expiring` | Approaching `expiresAt` | Communication |

---

## 9. Dependencies

**Requires:** F1 (blob encryption, the organization DEK), F2 (retention and
verification-required keys), I1 (Person ownership).

**Depended on by:** the admissions checklist and `DOCUMENT_PENDING`; certificate
issuance; address proof (S2 `proofDocumentId`); consent evidence (F1
`ConsentRecord.evidenceDocumentId`); employee records.

### Resolving `Applicant.photoFileId`

That column currently points at nothing. Options: repoint it at a `Document`, or
drop it and treat the photo as an ordinary document of type `PHOTOGRAPH`.
**Recommendation: drop the column.** A photograph is a document — it needs the
same virus scanning, size limits, versioning and encryption as everything else,
and a special-case column gets none of them.

---

## 10. Open questions

| # | Question | Blocks | Options |
| :--- | :--- | :--- | :--- |
| **Q1** | **What performs virus scanning?** | D4, which is blocking | Options: (a) ClamAV as a sidecar — self-hosted, no per-file cost, needs operating; (b) a cloud scanning API — no ops, per-file cost, and **sends student documents to a third party**, which is a DPDP consideration; (c) skip scanning in v1. **(c) is not acceptable** for a system accepting uploads from thousands of parents. **Recommendation: (a)**, but it is a real infrastructure dependency that belongs in P5 rather than being discovered at implementation time. |
| **Q2** | **Where are blobs stored, and is that decision deployment-dependent?** | D5 | The adapter interface makes this swappable, but the *default* matters: on-premise deployments (§ master plan) have no S3. Options: (a) local filesystem default, S3 adapter optional; (b) require S3-compatible storage, using MinIO on-premise. **Recommendation: (b)** — a single storage contract across deployments avoids two backup stories and two failure modes. Depends on the P5 deployment decision. |
| **Q3** | **Do parents upload directly, or do staff upload on their behalf?** | The upload endpoint's permissions | Direct parent upload is a major convenience and a major increase in attack surface — untrusted files, no staff eyes, and a quota problem. **Recommendation: staff-only in v1**, parent upload once the portal is scoped and rate limiting is designed. |

---

## 11. Acceptance scenarios

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | Upload a birth certificate | Version 1 created, scan `PENDING`, **not downloadable yet** |
| 2 | Scan completes clean | Becomes current, verification `PENDING` |
| 3 | **Upload an EICAR test file** | `INFECTED`, quarantined, never served, security event published |
| 4 | **Download attempted while scan is `PENDING`** | `409` — never optimistically served (invariant 3) |
| 5 | Scanner unavailable | `FAILED`, retried, **never treated as clean** |
| 6 | Replace a marksheet | v2 current, **v1 retained**, verification reset to `PENDING` |
| 7 | RTE applicant's checklist | Includes income and residence proof; a general-category applicant's does not (D2) |
| 8 | Applicant satisfies every mandatory requirement | Checklist complete; `DOCUMENT_PENDING` clears |
| 9 | Download a document | Signed URL, expires, **one audit row written** (D7) |
| 10 | Guess a storage key from a filename | Impossible — `storageKey` is generated, not derived (§3.3) |
| 11 | Upload a 40 MB file where the type caps at 5 MB | `413`, nothing stored |
| 12 | Caste certificate passes `expiresAt` | Flagged and notified; **admission unaffected** (§6) |
| 13 | Tenant offboarded, DEK shredded | Blobs unreadable (D6, F1) |
| 14 | **Raw SQL**: two versions with the same number for one document | Rejected (invariant 1) |

Scenarios 3, 4 and 5 are the security-critical ones. Scenario 3 should use the
standard EICAR test string rather than real malware.
