# Admissions Foundation Module Documentation

## 1. Overview
The **Admissions Foundation Module** provides the core intake, lifecycle, and mapping infrastructure for the multi-tenant School ERP platform. It manages the applicant transition pipeline from initial application submission to formal approval and academic placement.

---

## 2. Why Applicant ≠ Student
In an enterprise ERP, it is a critical anti-pattern to represent active students and applicants in the same table.
* **Applicant**: Represents a short-lived enquiry, draft form, review candidate, or converted registration. It is transactional and volatile.
* **Student**: Represents a permanent institutional identity with active enrollment histories, fee accounts, course grades, and attendance.
Applicants only trigger a permanent **Student** record creation hook *after* their application is marked `APPROVED`.

---

## 3. Why Enrollment ≠ Student Identity
* **Student Identity**: A permanent user/profile record unique to the individual across multiple academic years.
* **Enrollment**: An academic assignment connecting a student profile to a specific **Branch**, **Academic Year**, **Program**, and **Academic Unit (class/section)**. An applicant can be placed into an enrollment template, which converts into an active student enrollment upon final matriculation.

---

## 4. Folder Structure
The module follows a **feature-first modular structure** under `src/modules/admissions/`:
```
src/modules/admissions/
├── masters/           # 10 Master data entities (Religion, Caste, Category, Gender, etc.)
├── applicant/         # Applicant intake and lifecycle services/controllers
├── guardians/         # Normalised Guardian records and many-to-many Sibling mapping
├── numbering/         # Transaction-safe formatted sequence generator
├── workflow/          # Transactional state transitions and history logging
└── enrollment/        # Simple academic placement templates
```

---

## 5. Applicant Lifecycle & Workflow States
Applications transition through the following states via strict transition matrices:
```
  [DRAFT] ────> [SUBMITTED] ────> [UNDER_REVIEW] ───┬───> [APPROVED]
     │               │                   │           ├───> [DOCUMENT_PENDING]
     └───────────────┴───────────────────┴───────────┼───> [FEE_PENDING]
                     │                   │           ├───> [WAITLISTED]
                     └───────────────────┴───────────┼───> [REJECTED]
                                                     └───> [CANCELLED]
```
### Valid Transition Rules:
* Transitions out of terminal states (`APPROVED`, `REJECTED`, `CANCELLED`) are strictly blocked.
* Log audits are recorded automatically in the `WorkflowHistory` table.

---

## 6. Number Generation Architecture
To guarantee concurrent safety, sequence counters utilize atomic updates via row locking:
```sql
UPDATE "NumberSequenceCounter"
SET "currentValue" = "currentValue" + 1
WHERE "id" = :counterId
RETURNING "currentValue";
```
Configurable formats support placeholders:
* `{prefix}`: Custom string (e.g. `ADM`)
* `{branchCode}`: Resolved from Branch profile
* `{year}`: Resolved from current Academic Year
* `{sequence}`: 0-padded sequence number

---

## 7. Guardian / Sibling Relationship System
Rather than hardcoding mother/father columns, the system uses a normalized relationship table:
* **Guardian**: Stores unique personal information (Aadhaar, contact, address).
* **ApplicantGuardianMapping**: Associates a guardian to multiple applicants with custom attributes (`isPrimary`, `pickupAllowed`, `priority`).
This enables easy sibling discovery and reuses parent profiles during registration.

---

## 8. Multi-Tenancy & Isolation Strategy
* **Tenant Isolation**: Every operational entity holds `organizationId` and `branchId` foreign keys.
* **Branch Switching**: Roles Guard dynamically overrides the request context branch parameters for non-super-admins, ensuring database actions stay sandboxed inside authorized scopes.

---

## 9. Duplicate Warning Engine
Before finalizing an applicant create or submit action, the warning engine executes check matches:
1. Match on `aadhaarNo` (if populated).
2. Match on `primaryMobile`.
3. Match on Fuzzy Name + Date of Birth.
Matches return non-blocking warning arrays to alert admins of potential duplicates.

---

## 10. Future Extensibility
* **Applicant-to-Student Hook**: Triggered automatically in `WorkflowService` when transitioning to `APPROVED`.
* **Seat Capacity Validation**: Integrates inside the approval transition transaction.

---

## 11. Domain Events & Audit Flow
The Admissions module publishes the following events over the shared `EventBus` to integrate with the core `AuditListener`:

* **`applicant.created`**: Fired when a draft applicant is created.
* **`applicant.updated`**: Fired when applicant demographics/addresses/previous education fields are updated.
* **`applicant.deleted`**: Fired when an applicant is soft-deleted.
* **`guardian.created`**: Fired when a guardian is registered.
* **`guardian.updated`**: Fired when guardian details are updated.
* **`guardian.mapped`**: Fired when a guardian is associated with an applicant.
* **`guardian.unmapped`**: Fired when a guardian association is removed.
* **`admission.transitioned`**: Fired when the applicant transitions status (e.g., DRAFT -> SUBMITTED, UNDER_REVIEW -> APPROVED, etc.).
* **`enrollment.completed`**: Fired when academic placement templates are finalized.
* **`numbering_config.created`**: Fired when numbering sequences are configured.
* **`admissions_master.created`**: Fired when lookups (Religion, Caste, etc.) are registered.
* **`admissions_master.updated`**: Fired when lookups are updated.
* **`admissions_master.deleted`**: Fired when lookups are soft-deleted.

All events are handled asynchronously by the `AuditListener`, preserving the fast execution of core admission workflows.


---

## 12. Configurable admission workflows

Implemented 2026-10-17 from
[`../planning/configurable-admission-workflow-research.md`](../planning/configurable-admission-workflow-research.md).
The thirteen states and the edges between them are **unchanged** — a profile
chooses a journey over the one state machine and never adds a state, an edge,
or a way into `ADMITTED` other than the admit operation. The authoritative
transition table is `src/modules/admissions/workflow/workflow.transitions.ts`.

### 12.1 Profiles

| Profile | Journey | What the engine adds |
| :--- | :--- | :--- |
| `STANDARD_ADMISSION` (**default**) | submit → review → offer (`approve`) → `confirmSeat` → admit, with the optional detours | nothing — previous behaviour |
| `SIMPLE_ADMISSION` | register → choose section → **Admit student** | `POST …/direct-admit` (§12.4); the ordinary steps still run, in one transaction |
| `VERIFIED_ADMISSION` | standard | documents owed at `SUBMITTED`/`UNDER_REVIEW` must be verified before `startReview`; the approver must not be the user who started the review (maker/checker, read from `WorkflowHistory`) |

Out of scope, as the approved design decided: an eligibility engine and a
separate approval-before-offer state (`REQUIRES BUSINESS DECISION` BD3/BD4).

### 12.2 Policy and where it comes from

Resolved by the configuration engine ([`configuration.md`](./configuration.md)),
**BRANCH → ORGANIZATION → SYSTEM → default**, effective-dated.

| Key | Type | Default | Enforced by |
| :--- | :--- | :--- | :--- |
| `admissions.workflow_profile` | enum | `STANDARD_ADMISSION` | `direct-admit`, `VERIFIED_REVIEW_CHECKLIST`, `DISTINCT_REVIEWER` |
| `admissions.offer_validity_days` | int 1–365 | `15` | the deadline stamped at `approve` |
| `admissions.allow_deferment` | bool | `false` | `DEFERMENT_ENABLED` on `defer` (`400 DEFERMENT_DISABLED`, unchanged code) |
| `admissions.waitlist_enabled` | bool | `true` | `WAITLIST_ENABLED` on `waitlist` |
| `admissions.fee_step_enabled` | bool | `true` | `FEE_STEP_ENABLED` on `requestFee` |
| `admissions.document_request_enabled` | bool | `true` | `DOCUMENT_REQUEST_ENABLED` on `requestDocuments` |

The defaults reproduce the behaviour before configuration existed exactly, so
deploying changes nothing until a tenant sets a value. A disabled step is
refused by the engine with `400 POLICY_DISABLED` naming the key — not merely
hidden by a client.

**In-flight applications.** Policy is resolved **as of the application's
`submittedAt`** (now, for a draft). A draft follows the current policy; an
application that has entered the workflow finishes under the policy it
entered with; an issued offer keeps its stored `offerExpiresAt`; terminal
applications are never rewritten. No column was added to `Applicant` — the
effective-dated configuration answers "what was the rule then".

### 12.3 Document stage enforcement

`DocumentRequirement.requiredByStage` is enforced when a checklist-guarded
transition leaves or enters that stage (`[current, target]`):

| Transition | Stages checked |
| :--- | :--- |
| `submit` | `DRAFT`, `SUBMITTED` |
| `startReview` (VERIFIED only) | `SUBMITTED`, `UNDER_REVIEW` |
| `documentsReceived` | `DOCUMENT_PENDING`, `UNDER_REVIEW` |
| `approve` | the from-state (`UNDER_REVIEW`, `DOCUMENT_PENDING`, `FEE_PENDING`, `WAITLISTED`), `APPROVED` |
| `confirmSeat` | `APPROVED`, `SEAT_CONFIRMED` |
| `admit` (inside the admit transaction) | `SEAT_CONFIRMED`, `ADMITTED` |

`POST/PATCH /document-requirements` refuses `DEFERRED`, `REJECTED`,
`WITHDRAWN` and `CANCELLED` with `400 UNSUPPORTED_REQUIREMENT_STAGE`: no
transition checks them, so a requirement there would look protective and do
nothing. Only a `VERIFIED` current version satisfies a requirement — an
uploaded but unverified one never does. Requirements bind the applicant's
organization and are either organization-wide (`branchId` null) or written
for the applicant's own branch; another branch's requirement never applies
(fixed 2026-10-17 — the checklist previously ignored `branchId`).

**Rollout.** Requirements already stored at `DRAFT`, `SUBMITTED`,
`SEAT_CONFIRMED` or `ADMITTED` were previously never checked and now are;
branch-scoped requirements stop applying to other branches. Before release,
review `DocumentRequirement` rows with `branchId IS NOT NULL` or those stages.
Rows already stored at an unsupported stage remain inert and should be
re-staged or deactivated.

### 12.4 Direct admission (`SIMPLE_ADMISSION`)

`POST /v1/admissions/applicants/:applicantId/direct-admit` — body as `admit`
(`academicUnitId`, optional `admissionType`, `admissionDate`, `remarks`).

1. Pre-flight, outside any lock: the caller holds `admissions.update`,
   `admissions.approve` **and** `student.create`; the profile resolves to
   `SIMPLE_ADMISSION` (`400 WORKFLOW_PROFILE_MISMATCH` otherwise); the state
   is one it can start from; placement and numbering are valid.
2. One transaction: lock the applicant, re-read its state and re-check the
   profile, then run each remaining step — `submit`, `startReview`, `approve`,
   `confirmSeat`, whichever remain — through `WorkflowService.transition` on
   the same client, then the existing admit conversion on the same client.
3. Every step runs its own permission check and guards (the document
   checklist included), stamps its timestamps, writes its `WorkflowHistory`
   row (remarks "Recorded as part of a direct admission." unless given) and
   enqueues its own event with `orchestration: 'DIRECT_ADMISSION'` in the
   payload — one event per transition, as before, never a duplicate. Person
   resolution happens in `submit` exactly as always.
4. Any failure rolls back every step; the applicant is left as found.

Startable from `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `DOCUMENT_PENDING`,
`FEE_PENDING`, `WAITLISTED`, `APPROVED`, `SEAT_CONFIRMED`
(`DIRECT_ADMISSION_PLAN`). Anything else is `400 INVALID_TRANSITION`;
`ADMITTED` answers `409 APPLICANT_ALREADY_ADMITTED` naming the student.
The standard `POST …/admit` is unchanged.

### 12.5 Read contracts

| Endpoint | Permission | Purpose |
| :--- | :--- | :--- |
| `GET /v1/admissions/workflow/policy` | `admissions.view` | Effective profile and switches for the request's branch, with the tier that answered each |
| `GET /v1/admissions/applicants/:id/workflow/actions` | `admissions.view` | Every action legal from the current state: `permitted` for this caller, `blockedBy` (the same codes the action would fail with — `DOCUMENTS_INCOMPLETE` with `missing`, `POLICY_DISABLED`, `DEFERMENT_DISABLED`, `MAKER_CHECKER_VIOLATION`, `OFFER_EXPIRED`), `via: TRANSITION \| ADMIT`, `directAdmission` availability, and `deleteDraft` (`permitted`/`available` — `SUPER_ADMIN`/`ORG_ADMIN`/`BRANCH_ADMIN` with `admissions.delete`, on a `DRAFT`). Advice only — every action is re-validated under the row lock |
| `GET /v1/admissions/applicants/:id/checklist` | `admissions.view` | Every requirement binding the applicant with `VERIFIED` / `PENDING_VERIFICATION` / `REJECTED` / `MISSING`, by the guard's own matching rules |
| `GET/PUT/DELETE /v1/config/values/:key` | see [`configuration.md`](./configuration.md) | Policy history and changes |

All are scoped: an applicant outside the request's organization and branch is
`404`.

### 12.6 Error codes

| Code | Status | Meaning |
| :--- | :--- | :--- |
| `POLICY_DISABLED` | 400 | The step is switched off for this branch (`policy` names the key) |
| `DEFERMENT_DISABLED` | 400 | Deferment is off (kept from before, for existing clients) |
| `WORKFLOW_PROFILE_MISMATCH` | 400 | Direct admission outside `SIMPLE_ADMISSION` |
| `MAKER_CHECKER_VIOLATION` | 403 | VERIFIED: the reviewer tried to approve |
| `DOCUMENTS_INCOMPLETE` | 409 | Mandatory documents missing or unverified (`missing`) |
| `UNSUPPORTED_REQUIREMENT_STAGE` | 400 | A requirement at a stage no transition checks |
| `CONFIGURATION_INVALID` | 500 | A stored policy value fails validation — fail closed |
| `APPLICANT_NOT_DELETABLE` | 403 | `DELETE /applicants/:id` on anything but a `DRAFT` (`status`); also when the draft was submitted concurrently |
| `GOVERNMENT_ID_MISMATCH` | 409 | An applicant or guardian edit supplies an Aadhaar that differs from the one its linked Person records (`field: aadhaarNo`). Neither value is echoed |
| `GOVERNMENT_ID_ATTACH_FORBIDDEN` | 403 | The edit would record a first Aadhaar on the linked Person, and the caller lacks `person.attach_government_id` (`field: aadhaarNo`) |
| `GOVERNMENT_ID_ALREADY_ASSOCIATED` | 409 | That first Aadhaar already belongs to another Person (`field: aadhaarNo` when raised from an edit) |

### 12.7 Verification

`test/unit/workflow.service.spec.ts` (graph unchanged, policy switches, stage
enforcement, VERIFIED controls, `describeActions`),
`test/unit/admission-conversion.service.spec.ts` (direct admission: one
transaction client, permissions, profile re-check, refusals),
`test/unit/configuration.service.spec.ts`, `test/unit/checklist.service.spec.ts`
(branch scoping, read model, stage drift guard),
`test/integration/configurable-workflow.integration-spec.ts` (all three
profiles, rollback at every failure point, concurrency, mid-flight policy
changes, F2 invariants as raw SQL) and
`test/e2e/configurable-workflow.e2e-spec.ts` (HTTP boundary).

### 12.8 Closing a draft (BP-17, resolved 2026-10-19)

`cancel` and `withdraw` used to list `DRAFT` as a from-state, but a draft has
no `personId` and `applicant_person_from_submitted_check` refuses every other
status without one, so closing a draft that way failed with a raw `23514`
surfaced as a 500. Decision: a draft has not entered the workflow, so it is
**deleted**, not withdrawn or cancelled. `DRAFT` was removed from both rules
(now `400 INVALID_TRANSITION`), and `DELETE /v1/admissions/applicants/:id`
soft-deletes a `DRAFT` only — the status is part of the write's `WHERE`, so a
draft submitted between the read and the write is refused with
`403 APPLICANT_NOT_DELETABLE` rather than deleted. Both CHECK constraints are
unchanged; no migration. Withdraw and cancel from `SUBMITTED` onward are
unchanged.

### 12.9 Aadhaar on the role records

`Applicant.aadhaarNo` and `Guardian.aadhaarNo` are validated with the identity
index's own rule (`AADHAAR_PATTERN`: twelve digits, not starting with 0 or 1),
so a value submission would discard can no longer be stored. Once the record is
linked to a Person that records a government identifier, an edit supplying a
different Aadhaar is refused with `409 GOVERNMENT_ID_MISMATCH` — the same rule
as `GOVERNMENT_ID_ALREADY_SET`: correcting a recorded identifier is a separate,
audited operation.

When the linked Person has **no** identifier yet, the edit records it on the
Person as well, through `PersonService.attachGovernmentId` in the same
transaction (blind index, encrypted copy, `person.government_id_attached`
event) — so the role record and the identity agree, or neither changes.
Attaching is its own capability: the caller must hold
`person.attach_government_id` (granted to `SUPER_ADMIN` by default), otherwise
`403 GOVERNMENT_ID_ATTACH_FORBIDDEN`. A value already held by another Person
is `409 GOVERNMENT_ID_ALREADY_ASSOCIATED`.

Locking order: the applicant (or guardian) row, then the Person row.
`attachGovernmentId` locks the Person row too, so a direct
`POST /persons/:id/government-id` and an edit racing it are serialised —
whichever locks first wins and the other is refused. Drafts have no Person
and are unaffected.
