# F1 — Data Protection & Key Custody

> **Status:** `planned` — §10 has three open questions, two of which need your input
> **Depends on:** Organization (exists)
> **Depended on by:** Person (I1), Student (I4), Guardian (S1), Document (S3), Employee (S4), Finance (O3)

---

## 1. Purpose

This module owns **how personal data is protected at rest**: which fields are
encrypted, which are hashed for search, which are plaintext, how keys are
derived and custodied, and how a person's data is erased without destroying the
academic record.

It does **not** own authentication (`modules/auth`), role-based access control
(`modules/authorization`), transport security (TLS — infrastructure), the
general change-audit log (`core/audit.md`), or document blob storage. It defines
the *primitives* those modules use when they touch personal data.

---

## 2. Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | **Envelope encryption with a per-organization Data Encryption Key (DEK)** | Rotation re-wraps N small key rows instead of re-encrypting every record. Blast radius is one tenant. Tenant offboarding becomes a key deletion. |
| D2 | **Every DEK is wrapped twice** — once by `KEK_operational`, once by `KEK_recovery` | Directly answers "one key lost = game over". Either wrap can unlock the DEK, so recovery needs two independent failures. |
| D3 | **`KEK_recovery` never exists on the server** | A full server compromise yields `KEK_operational` only. The recovery path stays intact even after a breach. |
| D4 | **Aadhaar: blind-index hash + last-4 + encrypted full value** | Hash serves duplicate detection without decryption; last-4 serves routine screen display; the full value stays recoverable, as you require. |
| D5 | **APAAR, ABC ID, PEN, Saral ID, UDISE ID stored in plaintext** with access control and audit | These are institutional identifiers designed to be shared between institutions and printed on records. They are personal data, not secrets. Encrypting them adds key-loss risk and buys nothing. |
| D6 | **Names, DOB, addresses, photos stay plaintext** | Encrypting them breaks search, sort, ordering and reporting across the entire product for negligible gain against the realistic threat. |
| D7 | **Reading a full sensitive value is a privileged, separately-audited action** | Sensitive values must never appear in list endpoints or bulk responses. One read, one log row, with a stated purpose. |
| D8 | **No cloud KMS dependency** | Deployment target is undecided. Nothing here assumes AWS/Azure/GCP. If a cloud is later chosen, `KEK_operational` can move into its KMS without touching the data model. |
| D9 | **AES-256-GCM** for field encryption, **HMAC-SHA256** for blind indexes | GCM is authenticated — tampering fails loudly instead of returning plausible garbage. |
| D10 | **Erasure nulls the ciphertext; it does not delete the row** | Satisfies the statutory right to erasure while `§3 Q7` ("a student record is never deleted") continues to hold. Enrollments, marks and receipts survive and still report. |
| D11 | **Full-disk / volume encryption is assumed in addition, not instead** | Field encryption protects against a leaked table dump; disk encryption protects against a stolen server or backup. They defend different things. |
| D12 | **Decryption is gated by a dedicated `sensitive_data.read` permission granted per user**, not by role | Roles widen silently as people are promoted into them. An explicit per-user grant appears in the permission-change audit (§15 Q19) and can be revoked without demoting anyone. Uses the existing `UserPermissionOverride` machinery — no new authorization concept. |

### Rejected alternatives

| Rejected | Why |
| :--- | :--- |
| One master key for the whole platform | The failure mode you explicitly ruled out. Also makes rotation a full-database re-encryption. |
| Cloud KMS (AWS KMS, Azure Key Vault) | Best-in-class key durability, but the deployment target is undecided and on-premise is still a live option. Revisit once decided — D1's structure already accommodates it. |
| Disk encryption only, no field encryption | Protects a stolen disk but not SQL injection, a compromised application, or a rogue operator with database access. |
| Not storing Aadhaar at all (hash + last-4 only) | Strongest privacy position and needs no key — rejected because you require the full number to be recoverable. |
| Shamir secret sharing of the master key | Solves single-point-of-loss but adds real operational ceremony. D2 achieves the same survivability for a small team. |
| Per-record DEK | Key management cost scales with row count. Per-organization is the right granularity — see §10 Q2 for the one case that argues otherwise. |

---

## 3. Data model

### 3.1 The key hierarchy

```
KEK_operational ──┐                      KEK_recovery
(app environment) │                      (offline: safe, password manager)
                  │                            │
                  ▼                            ▼
        ┌─────────────────────────────────────────────┐
        │  OrganizationDataKey                        │
        │  dekWrappedOperational   dekWrappedRecovery │  ← same DEK, two wraps
        └─────────────────────────────────────────────┘
                            │  unwrap with either
                            ▼
                   DEK (32 bytes, in memory only)
                            │
                            ▼
              encrypts Aadhaar, bank details, …
```

### 3.2 `OrganizationDataKey`

| Field | Type | Null | Why here | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `String (UUID v7)` | no | | |
| `organizationId` | `String` | no | The DEK's scope is one tenant (D1) | Unique |
| `dekWrappedOperational` | `Bytes` | no | Daily-use wrap | |
| `dekWrappedRecovery` | `Bytes` | no | Break-glass wrap (D2) | |
| `operationalKekVersion` | `Int` | no | Which KEK generation produced the wrap | Enables rotation without re-encrypting data |
| `recoveryKekVersion` | `Int` | no | Same, independently versioned | |
| `algorithm` | `String` | no | e.g. `AES-256-GCM` | Explicit, so a future change is legible |
| `status` | `DataKeyStatus` | no | `ACTIVE`, `ROTATING`, `RETIRED`, `SHREDDED` | |
| `createdAt` | `DateTime` | no | | |
| `lastRewrappedAt` | `DateTime?` | yes | Last KEK rotation | Distinct from DEK rotation |
| `shreddedAt` / `shreddedBy` | `DateTime?` / `String?` | yes | Tenant offboarding | Irreversible |

> **The DEK itself is never stored.** Only its two wrapped forms. It exists in
> process memory for the duration of a request and is never logged.

### 3.3 The encrypted-field convention

Any module storing a sensitive value follows one shape, so this is specified
once rather than re-argued per module:

| Column | Present when | Purpose |
| :--- | :--- | :--- |
| `<field>Enc` `Bytes?` | always | Ciphertext |
| `<field>Hash` `String?` | the field must be **searched** | Blind index (§3.5) |
| `<field>Last4` `String?` | the field is **displayed** routinely | Screen display without decryption |

**Ciphertext wire format:**

```
byte 0        format version (currently 1)
bytes 1..12   IV — 12 random bytes, never reused
bytes 13..28  GCM authentication tag — 16 bytes
bytes 29..    ciphertext
```

The leading version byte is independent of `operationalKekVersion`: one tracks
the *layout*, the other the *key*. Conflating them makes future migration
ambiguous.

### 3.4 Field-by-field classification

| Field | Storage | Searchable | Displayed as |
| :--- | :--- | :--- | :--- |
| **Aadhaar** | `Enc` + `Hash` + `Last4` | yes, by hash | `XXXX XXXX 1234` |
| **Bank account** (scholarship, refund) | `Enc` + `Last4` | no | `••••3456` |
| **APAAR ID** | plaintext | yes | in full |
| **ABC ID** | plaintext | yes | in full |
| **PEN** | plaintext | yes | in full |
| **Saral ID** | plaintext | yes | in full |
| **UDISE student ID** | plaintext | yes | in full |
| Name, DOB, gender, address | plaintext | yes | in full |
| Photograph | blob, access-controlled | n/a | via signed URL |
| Health notes, disability details | plaintext, restricted roles | no | restricted screens |
| Biometric templates | **not collected in v1** | — | — |

> Biometrics are excluded deliberately. Under the DPDP Act, biometric data of
> children carries the heaviest obligations in the statute, and §12 Q8/Q9
> (face-recognition and biometric attendance) are Phase 3 at the earliest. When
> that lands it needs its own consent flow, not this one.

### 3.5 Blind index

`HMAC-SHA256(pepper, organizationId + ":" + domain + ":" + normalizedValue)`

Three properties, each load-bearing:

- **`organizationId` is inside the message**, not merely the query scope. The
  same human at two tenants produces unrelated digests, so the index can never
  correlate people across organizations — which §4 Q6 requires.
- **A domain separator** (`aadhaar`, `phone`) stops a phone number that happens
  to equal an identifier from colliding across columns.
- **Normalization must never change.** `1234 5678 9012` and `123456789012` are
  the same Aadhaar and must always agree. Aadhaar: strip non-alphanumerics,
  upper-case. Phone: digits only, last 10.

The pepper is a deployment secret, not a per-record salt — a per-record salt
would make equality lookup impossible, which is the entire point.

> ⚠️ **The pepper can never change once data exists.** Changing it raises no
> error. It silently stops duplicate detection from finding anyone. Treat it
> with the same care as `KEK_recovery`.

### 3.6 `SensitiveAccessLog`

Separate from the general `AuditLog` (`core/audit.md`), which records *changes*.
This records *reads*, and DPDP requires a stated purpose for each.

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `String (UUID v7)` | |
| `organizationId` | `String` | |
| `subjectType` / `subjectId` | `String` | Whose data was read |
| `fieldName` | `String` | e.g. `aadhaar` |
| `action` | `SensitiveAccessAction` | `VIEW`, `EXPORT`, `REPORT_GENERATION` |
| `purpose` | `String` | Required, non-empty — stated by the caller |
| `actorUserId` | `String` | |
| `requestId` | `String?` | Correlates with application logs |
| `ipAddress` | `String?` | |
| `occurredAt` | `DateTime` | |

**Append-only.** No update path, no delete path, no service method.

### 3.7 `ConsentRecord`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `String (UUID v7)` | |
| `organizationId` / `personId` | `String` | Whose data |
| `purpose` | `ConsentPurpose` | `ACADEMIC_OPERATIONS`, `PHOTOGRAPHY`, `COMMUNICATION_PROMOTIONAL`, `THIRD_PARTY_SHARING`, `GOVERNMENT_REPORTING` |
| `granted` | `Boolean` | |
| `grantedByPersonId` | `String?` | The consenting guardian, for a minor |
| `noticeVersion` | `String` | Which consent notice text was shown |
| `evidenceDocumentId` | `String?` | Signed form, if collected on paper |
| `grantedAt` / `withdrawnAt` | `DateTime` / `DateTime?` | |

Append-only. **Withdrawal writes a new row**; it never edits the old one.
`ACADEMIC_OPERATIONS` is necessary for the contract and is not withdrawable
while a student is enrolled — the others are.

---

## 4. Invariants

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | One DEK per organization | `@@unique([organizationId])` |
| 2 | An `ACTIVE` DEK always carries **both** wraps | `CHECK (status <> 'ACTIVE' OR (dekWrappedOperational IS NOT NULL AND dekWrappedRecovery IS NOT NULL))` |
| 3 | A blind index is unique within an organization | `@@unique([organizationId, aadhaarHash])` on the owning table; Postgres treats NULLs as distinct, so people without Aadhaar don't collide |
| 4 | One active consent per person per purpose | `CREATE UNIQUE INDEX consent_active ON "ConsentRecord" ("personId","purpose") WHERE "withdrawnAt" IS NULL` |
| 5 | `SensitiveAccessLog` is append-only | No update/delete in the service; `REVOKE UPDATE, DELETE` on the table role |
| 6 | `purpose` is never empty | `CHECK (length(trim(purpose)) > 0)` |
| 7 | A `SHREDDED` DEK has no wraps left | Enforced by the shred procedure and asserted in tests — a `CHECK` cannot express the required ordering |

---

## 5. Provenance

Two operations are routinely confused and must stay distinct:

| Operation | What changes | Cost | When |
| :--- | :--- | :--- | :--- |
| **KEK rotation** | The wraps only. Same DEK, re-wrapped. | N rows, N = organizations | Suspected KEK exposure; scheduled hygiene |
| **DEK rotation** | New DEK; every ciphertext re-encrypted | Every encrypted row for that tenant | Suspected DEK exposure; tenant request |

`DataKeyRotationLog` records both, append-only: `organizationId`, `rotationType`
(`KEK_REWRAP` / `DEK_ROTATE`), `fromVersion`, `toVersion`, `reason` (mandatory),
`actorUserId`, `startedAt`, `completedAt`, `rowsAffected`.

**Erasure provenance.** Erasure nulls ciphertext and stamps `erasedAt`,
`erasedBy`, `erasureReason`, `erasureRequestId` on the owning row. The row
survives. A future reader can always see that data was erased, when, and under
what authority — an erased field is visibly erased, not silently absent.

**The correction test.** After erasing Riya's Aadhaar:

```
Person             row intact, govtIdHash intact  ← duplicate detection still works
PersonSensitive    aadhaarEnc = NULL
                   erasedAt   = 2027-03-14
                   erasedBy   = <user>
                   reason     = "DPDP erasure request #41"
Student            intact
Enrollment × 12    intact
Marks, receipts    intact and still reportable
```

> **Note the deliberate choice:** `govtIdHash` is retained. It is not reversible
> to an Aadhaar number, and destroying it would let the same person re-enrol as
> a stranger — defeating the duplicate detection every other module relies on.
> Whether your counsel accepts that reading is §10 Q3.

---

## 6. Lifecycle

### DEK

```
[PENDING] ──provision──> [ACTIVE] ──rotate──> [ROTATING] ──complete──> [ACTIVE]
                             │
                             ├──offboard──> [SHREDDED]   (irreversible)
                             └──supersede─> [RETIRED]
```

| From | To | Action | Who | Guard |
| :--- | :--- | :--- | :--- | :--- |
| — | `PENDING` | provision | `SUPER_ADMIN` | organization exists, has no DEK |
| `PENDING` | `ACTIVE` | activate | `SUPER_ADMIN` | both wraps present |
| `ACTIVE` | `ROTATING` | rotate | `SUPER_ADMIN` | reason mandatory |
| `ROTATING` | `ACTIVE` | complete | system | every row re-encrypted |
| `ACTIVE` | `SHREDDED` | offboard | `SUPER_ADMIN` | explicit confirmation; **irreversible** |

### Consent

`GRANTED → WITHDRAWN` (new row). `ACADEMIC_OPERATIONS` cannot be withdrawn while
an enrollment is active.

### Erasure request

```
[REQUESTED] ──review──> [APPROVED] ──execute──> [EXECUTED]
      └──────────────> [REJECTED]  (reason mandatory)
```

Rejection is a legitimate outcome: statutory retention can override an erasure
request, and refusing without a recorded reason is not defensible.

---

## 7. API surface

| Method | Path | Purpose | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/organizations/:id/data-key` | Provision a DEK | `SUPER_ADMIN` |
| `POST` | `/v1/organizations/:id/data-key/rewrap` | KEK rotation | `SUPER_ADMIN` |
| `POST` | `/v1/organizations/:id/data-key/rotate` | DEK rotation | `SUPER_ADMIN` |
| `GET` | `/v1/persons/:id/sensitive/:field` | Read one decrypted value | **`sensitive_data.read`** (D12) |
| `GET` | `/v1/persons/:id/consents` | Consent history | `BRANCH_ADMIN`+ |
| `POST` | `/v1/persons/:id/consents` | Record consent | `STAFF`+ |
| `POST` | `/v1/persons/:id/erasure-requests` | Raise an erasure request | `ORG_ADMIN` |

**The sensitive read endpoint is deliberately awkward.** One field, one person,
one call, a mandatory `purpose` in the body, rate-limited per user. It is not
possible to decrypt in bulk through the API — anyone needing that is doing
something that should go through the reporting module with its own approval.

Error contract per [`../core/response-contract.md`](../../core/response-contract.md):

| Rule broken | Status | `error.code` |
| :--- | :--- | :--- |
| Organization has no DEK | `409` | `ConflictException` |
| Reading an erased field | `410` | `GoneException` |
| `purpose` missing or blank | `400` | `BadRequestException` |
| DEK already provisioned | `409` | `ConflictException` |
| Ciphertext fails authentication | `500` | `InternalServerErrorException` — never a silent empty value |

---

## 8. Events

| Event | When | Payload | Consumers |
| :--- | :--- | :--- | :--- |
| `data_key.provisioned` | DEK created | `organizationId` | audit |
| `data_key.rewrapped` | KEK rotation | `organizationId`, versions | audit |
| `data_key.rotated` | DEK rotation | `organizationId`, `rowsAffected` | audit |
| `data_key.shredded` | Offboarding | `organizationId` | audit, billing |
| `consent.granted` / `consent.withdrawn` | Consent change | `personId`, `purpose` | communication (suppression lists) |
| `person.data_erased` | Erasure executed | `personId`, fields erased | audit |

Sensitive **reads** write directly to `SensitiveAccessLog`, synchronously, in
the same transaction as the decryption — they are not published as events. An
asynchronous handler can drop a message; a compliance log that silently loses
entries is worse than none. `consent.withdrawn` matters most to the
communication module, which must stop promotional sends immediately.

---

## 9. Dependencies

**Requires:** `Organization`.

**Depended on by:** Person (I1) — `govtIdHash`, `PersonSensitive`; Guardian (S1)
— same pattern; Student (I4); Document (S3) — blob encryption; Employee (S4);
Finance (O3) — bank details.

**Foreign key contract:** sensitive data attaches to **`personId`**. This is why
F1 precedes I1 — a Person exists partly so that Aadhaar has exactly one home
rather than three, which is what makes erasure provable.

**Environment (breaking):** `IDENTITY_HASH_PEPPER` and `KEK_OPERATIONAL` become
required. `ENCRYPTION_KEY` already exists in `src/config/env.validation.ts` as
optional and "reserved, not consumed yet" and would be promoted or replaced.
Every environment must set these before the application starts. Both services
fail at dependency-injection time without them, so declaring them optional would
only convert a clear startup message into an obscure injection error.

---

## 10. Open questions

| # | Question | Blocks | Status |
| :--- | :--- | :--- | :--- |
| ~~Q1~~ | Who may read a full Aadhaar? | — | **Resolved 2026-08-06** → D12: a dedicated `sensitive_data.read` permission, granted per user |
| **Q2** | **Is retaining `govtIdHash` after erasure acceptable?** | The erasure procedure | **Open — needs a legal opinion, not an engineering one.** The hash is not reversible to an Aadhaar number, and keeping it is what stops an erased person silently re-enrolling as a stranger. But it is *derived from* personal data, so a strict reading may require destroying it. If counsel says destroy it, §5's correction test changes and duplicate detection loses its strongest signal for erased subjects. |

### Deferred with a known redesign risk

**Backup retention is undecided**, which means this specification assumes the
simple case: erasure applies to live data, and backups age out inside a short
window (~30–35 days). Per-organization DEKs are sufficient under that
assumption, and that is what §3 specifies.

> ⚠️ **If backup retention is set to a year or more**, erasure must invalidate
> historical backups. That requires a **per-person key wrapped by the
> organization DEK**, so destroying it renders old backups unreadable. This
> changes every encrypt and decrypt path and adds a key table sized to the
> person count — a redesign of §3, not a tweak.

Recorded as a prerequisite for **P5 — Deployment, backup, key-recovery runbook**.
Decide backup retention there *before* F1 is implemented, not after.

---

## 11. Acceptance scenarios

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | Encrypt then decrypt a value | Round-trips exactly, including leading zeros and Unicode |
| 2 | Flip one byte of ciphertext, then decrypt | **Throws.** GCM authentication fails — never returns a partial or empty value |
| 3 | Hash `1234 5678 9012` and `123456789012` | Identical digests |
| 4 | Hash the same Aadhaar under two organizations | **Different** digests — no cross-tenant correlation |
| 5 | Hash an absent/empty Aadhaar | `null`, not a digest of the empty string (otherwise everyone without Aadhaar collides) |
| 6 | **Discard `KEK_operational`; recover using `KEK_recovery`** | DEK unwraps, data reads normally, DEK re-wraps under a new operational KEK. **This is the scenario that justifies the whole design — it must be rehearsed, not assumed.** |
| 7 | Read a full Aadhaar via the API | Exactly one `SensitiveAccessLog` row, with actor, purpose and timestamp |
| 8 | Read with a blank `purpose` | `400`, no decryption performed, no log row |
| 9 | Erase a person, then read their record | Aadhaar `410 Gone`; Student, 12 Enrollments, marks and receipts all intact and reportable |
| 10 | KEK rotation across 50 organizations | 50 rows re-wrapped, **zero data rows re-encrypted**, everything still readable |
| 11 | Insert an `ACTIVE` DEK with one wrap missing | **Rejected by Postgres** (invariant 2) — verify via raw SQL, bypassing Prisma |
| 12 | Withdraw promotional consent, then run a bulk send | The person is excluded; transactional messages still deliver |
| 13 | 50 concurrent decrypt requests | No key material in any log line, no cross-request leakage, 50 log rows |

Scenarios 6 and 11 are the ones that prove the design rather than the
implementation. Run 11 as raw SQL — through Prisma it proves nothing.
