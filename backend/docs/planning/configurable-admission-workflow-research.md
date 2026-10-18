# Configurable Admission Workflow — Research

**Date:** 2026-10-17 · **Type:** research · **Status:** `implemented` — the
recommendation was approved and built on 2026-10-17. What shipped, and where
it departs from this report, is recorded in
[`../modules/admissions.md` §12](../modules/admissions.md#12-configurable-admission-workflows)
and [`../modules/configuration.md`](../modules/configuration.md). This
document is kept unchanged below as the research record; its `RECOMMENDED`
and `PROPOSED` labels describe the proposal, not the implementation.

**Decisions taken at implementation:** BD1 — organization-wide values need
`ORG_ADMIN`; a branch can be managed by anyone holding
`config.admissions.write` for it. BD2 — enforce every stage a transition
touches and refuse the four no transition touches. BD7 — no `Applicant`
column; F2 effective dating answers it. BD8 — direct admission may start from
any spine state. BD3, BD4 (approval state, eligibility) remain open and
unbuilt; BD5, BD6 unchanged (no guardian requirement; only verified
documents satisfy).

**Question.** Can an organization or branch run a shorter (or stricter) admission
process than today's, without redesigning the
`Applicant → Person → Admission → Student → Enrollment` architecture, and
without letting a simpler process bypass identity, tenant isolation, database
invariants or authorization?

**Short answer.** Yes — through a **named workflow profile plus a handful of
policy flags**, resolved by the planned F2 configuration engine, over the
**unchanged** thirteen-state machine. The one genuinely new capability is an
orchestrated *direct admission* operation that walks the existing edges inside
one transaction. No state is added, no edge is added, and no configurable graph
is introduced. Three verified defects must be fixed first (§5.3).

### Labels

| Label | Meaning |
| :--- | :--- |
| `IMPLEMENTED` | Exists in code today |
| `VERIFIED` | Read in code/schema/migration/test during this research, not taken from a doc |
| `RECOMMENDED` | This document's recommendation |
| `PROPOSED` | A concrete design offered for approval |
| `DEFERRED` | Deliberately out of the first implementation |
| `REQUIRES BUSINESS DECISION` | Cannot be settled by engineering |

### Evidence inspected

`src/modules/admissions/workflow/{workflow.transitions.ts, workflow.service.ts, offer-expiry.job.ts, workflow.controller.ts}`,
`src/modules/admissions/admission-config.provider.ts`,
`src/modules/admissions/applicant/{applicant.service.ts, applicant.controller.ts}`,
`src/modules/admissions/admission/{admission-conversion.service.ts, admission-conversion.controller.ts}`,
`src/modules/admissions/guardians/guardianship.service.ts`,
`src/modules/documents/{checklist.service.ts, document-requirement.service.ts}`,
`prisma/modules/admissions/applicant.prisma`, `prisma/schema.prisma`
(`DocumentRequirement`, `WorkspaceConfiguration`, `SystemSetting`),
`prisma/migrations/20260811000000_phase3_admission_workflow/migration.sql`,
`docs/planning/00-foundation/02-configuration.md` (F2),
`docs/modules/branch-settings.md`, the blueprint §50 Q10 and the lifecycle
reference B14, `test/unit/{workflow.service,checklist.service}.spec.ts`,
`test/integration/{admission-workflow,admit,pipeline}.integration-spec.ts`,
`postman/erp.postman_collection.json`, and
`frontend/src/features/admissions/{components/applicant-workflow-actions.tsx, utils/workflow.ts}`.

---

## 1. Executive Summary

1. **The workflow feels long because its spine is fixed, not because it has
   too many states.** `VERIFIED`: the only path to `ADMITTED` is
   `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → SEAT_CONFIRMED → ADMITTED` —
   four generic workflow calls plus `admit()`, each a separate request and,
   in the UI, a separate screen. The detour states (`DOCUMENT_PENDING`,
   `FEE_PENDING`, `WAITLISTED`, `DEFERRED`) are already optional: an
   institution that never issues those actions never sees them.
2. **The architecture already decided against a configurable graph**
   (blueprint §50 Q10, lifecycle B14, and the header comment of
   `workflow.transitions.ts`): all thirteen states exist; configuration only
   decides which are *reachable*. This research keeps that decision.
3. **There is no admission configuration today.** `VERIFIED`:
   `AdmissionConfigProvider` returns hard-coded defaults (offer validity 15
   days, deferment off). It is the designated seam for F2, which is `planned`
   but not built. `WorkspaceConfiguration` exists with
   `PRODUCT/ORGANIZATION/BRANCH/ROLE/USER` scopes but stores only navigation
   and client-preference JSON — it is not effective-dated or audited and is
   not a fit for admission policy.
4. **Branch-level customization is feasible**, with F2's
   SYSTEM → ORGANIZATION → BRANCH resolution and its effective dating (which
   answers "what was the rule when this application was submitted?").
5. **Three defects block any branch-level document policy** (§5.3), the most
   important being that the document checklist ignores
   `DocumentRequirement.branchId`, so a requirement written for one branch is
   enforced on every branch of the organization.
6. **Recommendation:** three profiles (`SIMPLE_ADMISSION`,
   `STANDARD_ADMISSION` — today's behaviour and the default —
   `VERIFIED_ADMISSION`), four detour flags, one orchestrated
   `direct-admit` operation, one read contract that tells the frontend which
   actions are legal and why, and **no change to the states, the edges, or
   `admit()`'s transaction**.

---

## 2. Current Implementation and Verified Workflow

### 2.1 The state machine — `VERIFIED` (`workflow.transitions.ts`)

Thirteen `AdmissionApplicationStatus` values, fifteen actions. The caller names
a verb; the engine owns the destination.

| Action | From | To | Permission | Remarks | Guards | Stamps |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `submit` | DRAFT | SUBMITTED | `admissions.update` | optional | — (resolves Person, requires programme) | `submittedAt` |
| `startReview` | SUBMITTED | UNDER_REVIEW | `admissions.update` | optional | — | |
| `requestDocuments` | UNDER_REVIEW | DOCUMENT_PENDING | `admissions.update` | **required** | — | |
| `documentsReceived` | DOCUMENT_PENDING | UNDER_REVIEW | `admissions.update` | optional | `DOCUMENT_CHECKLIST_SATISFIED` | |
| `requestFee` | UNDER_REVIEW | FEE_PENDING | `admissions.update` | optional | — | |
| `waitlist` | UNDER_REVIEW | WAITLISTED | `admissions.approve` | **required** | — | |
| `approve` *(= the offer)* | UNDER_REVIEW, DOCUMENT_PENDING, FEE_PENDING, WAITLISTED | APPROVED | `admissions.approve` | optional | `DOCUMENT_CHECKLIST_SATISFIED` | `approvedAt`, `offerIssuedAt`, `offerExpiresAt`, `approvedBy` |
| `confirmSeat` *(= acceptance)* | APPROVED | SEAT_CONFIRMED | `admissions.update` | optional | `OFFER_NOT_EXPIRED` | `seatConfirmedAt` |
| `defer` | APPROVED | DEFERRED | `admissions.approve` | **required** | `DEFERMENT_ENABLED` | `deferredAt` |
| `expireOffer` | APPROVED | CANCELLED | `admissions.approve` | optional | `OFFER_EXPIRED` · **systemOnly** | `cancelledAt` |
| `reject` | SUBMITTED…WAITLISTED | REJECTED | `admissions.reject` | **required** | — | `rejectedAt`, `rejectedBy` |
| `withdraw` | DRAFT…SEAT_CONFIRMED | WITHDRAWN | `admissions.update` | **required** | — | `withdrawnAt` |
| `cancel` | DRAFT…SEAT_CONFIRMED | CANCELLED | `admissions.approve` | **required** | — | `cancelledAt` |
| `admit` | SEAT_CONFIRMED | ADMITTED | `admissions.approve` (+ `student.create` in the orchestrator) | optional | **orchestratedOnly** | |
| `forceReopen` | CANCELLED | UNDER_REVIEW | `admissions.approve` | **required** | severity WARN | |

Terminal: `ADMITTED`, `REJECTED`, `WITHDRAWN`. `CANCELLED` is the only
reopenable state.

`VERIFIED` engine behaviour, identical for every edge: route role gate +
`@RequirePermission` → remarks policy → per-rule permission →
`SELECT … FOR UPDATE` on the applicant **scoped to organization and branch** →
from-state check → guards (read under the lock) → status + timestamps →
`WorkflowHistory` row → outbox event named per transition — all in one
transaction, or inside the caller's when one is passed (which is how `admit()`
joins).

### 2.2 Stage-by-stage audit

| Stage | States / edge | Required fields & validation | Permission | Documents | DB side effects | Mandatory? | Skippable today? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Applicant creation (draft)** — `VERIFIED` | creates `DRAFT` | non-null columns: `firstName`, `lastName`, `dob`, `genderId`, `primaryMobile`, current address (`line1`, `city`, `state`, `country`, `pincode`); `academicYearId` from scope; duplicate report returned as warnings | `admissions.create` | none | allocates `ADMISSION_FORM` and `APPLICATION` numbers; outbox `applicant.created` | yes | no |
| **Editing** — `VERIFIED` | any non-frozen state | frozen from `APPROVED`, `SEAT_CONFIRMED`, `ADMITTED`, `DEFERRED`, `REJECTED`, `WITHDRAWN`, `CANCELLED` | `admissions.update` | — | — | — | — |
| **Programme preferences** — `IMPLEMENTED` | any editable state | `@@unique(applicantId, preferenceOrder)`, `@@unique(applicantId, programId)`, `preferenceOrder ≥ 1` | `admissions.update` | — | `ApplicantProgramPreference` rows | optional | yes |
| **Person resolution** — `VERIFIED` | inside `submit` | `programId` required (`PROGRAM_REQUIRED`); government identifier is the only deterministic key; demographics never merge (twins); candidate warnings are logged, never blocking | (submit's) | — | `Applicant.personId` set; CHECK `applicant_person_from_submitted_check` (NOT VALID) | yes | **no** — and must not become skippable |
| **Guardians** — `VERIFIED` | any editable state | primary / financial exclusivity enforced when synced | guardian routes | — | `ApplicantGuardianMapping`; projected to `Guardianship` by `admit()` | **not required** by submit or admit | yes (nothing requires one) |
| **Address** — `VERIFIED` | create | inline columns on `Applicant` (required); `PersonAddress` is the persistent model | — | — | — | yes (inline) | no |
| **Document requirements** — `VERIFIED` | guard on `documentsReceived` and `approve` only | requirement matches when `requiredByStage ∈ {current, target}` and programme/quota/category match (null = all); satisfied by a `VERIFIED` current version owned by the applicant or its Person | — | yes, when rows exist | none (read-only check) | conditional — only if requirement rows exist | effectively yes (no rows ⇒ satisfied) |
| **Submission** | DRAFT → SUBMITTED | as Person resolution | `admissions.update` | **not checked** | `submittedAt`, `personId`; one-live-application index starts to apply | yes | no |
| **Review** | SUBMITTED → UNDER_REVIEW | — | `admissions.update` | — | — | yes (on the spine) | **no** |
| **Offer** | → APPROVED | — | `admissions.approve` | checklist | offer window; CHECK `applicant_offer_window_check` | yes (on the spine) | **no** |
| **Acceptance / seat** | APPROVED → SEAT_CONFIRMED | offer not expired (inclusive) | `admissions.update` | **not checked** | `seatConfirmedAt` | yes (on the spine) | **no** |
| **ADMIT** — `VERIFIED` | SEAT_CONFIRMED → ADMITTED | caller supplies `academicUnitId` only; unit must be active, a **leaf**, and match the applicant's branch, year and programme; year not locked; `STUDENT_CODE` and `ADMISSION_NO` provisioned; no existing Student for the Person | `admissions.approve` **and** `student.create` | **not checked** | one transaction: lock → Person → Student (+code) → Admission (+number) → guardianship sync → Enrollment → status last | yes | no |
| **Rejection / withdrawal / cancellation** | see table | remarks required | reject / update / approve | — | stamps + history | conditional | — |
| **Deferment** | APPROVED → DEFERRED | `DEFERMENT_ENABLED` (hard-coded `false`) | `admissions.approve` | — | `deferredAt`; a new attempt points back via `deferredFromApplicantId` | conditional | unreachable today |
| **Offer expiry** — `VERIFIED` | APPROVED → CANCELLED | strict `<` against `offerExpiresAt` (complementary to confirm's inclusive check) | system | — | runs through the engine (`setInterval` sweep) — historied and evented | automatic | — |

### 2.3 Cross-cutting — `VERIFIED`

- **History:** one `WorkflowHistory` row per transition, `actionBy` = user id
  or `SYSTEM`; `GET …/workflow/history` (`admissions.view`).
- **Events:** outbox, inside the transaction, one named event per rule
  (`applicant.submitted`, `applicant.offer_issued`, …). All are registered in
  `AuditListener`.
- **Database invariants that hold on every path:** person and programme
  required from `SUBMITTED` on (CHECK, `NOT VALID` for one legacy row),
  **one live application per person/branch/year** (`applicant_one_active`),
  offer dates both-or-neither and ordered, one student per applicant, one
  student per person per organization.

---

## 3. Current API and Database Behaviour

| Operation | Endpoint | Notes |
| :--- | :--- | :--- |
| Create applicant | `POST /admissions/applicants` | `admissions.create` |
| Duplicate check | `POST /admissions/applicants/check-duplicates` | `admissions.view` |
| List / read / update / delete | `GET`, `GET :id`, `PATCH :id`, `DELETE :id` | delete refused in frozen states |
| Preferences | `GET`/`POST :id/preferences` | |
| Any workflow action | `POST /admissions/applicants/:id/workflow/transition` `{ action, remarks }` | `admissions.update` at the route, per-rule permission inside |
| History | `GET …/workflow/history` | |
| Admit | `POST /admissions/applicants/:id/admit` `{ academicUnitId }` | `admissions.approve` + `student.create` |
| Document requirements | `POST/GET/GET :id/PATCH /document-requirements` | |

**Not exposed — `VERIFIED`:** `actionsFrom(state)` exists in
`workflow.transitions.ts` but no endpoint returns it; there is no checklist
read endpoint. The frontend therefore **mirrors the transition table**
(`frontend/src/features/admissions/utils/workflow.ts`) and **recomputes the
checklist client-side** (`utils/checklist.ts`). Both copies are correct today
only because the graph is global; the moment reachability varies by branch they
will be wrong.

---

## 4. Existing Configuration Capabilities

| Mechanism | Status | Scope | Fit for admission policy |
| :--- | :--- | :--- | :--- |
| `AdmissionConfigProvider` | `IMPLEMENTED` as a stub | takes `{organizationId, branchId}` and `asOf`, ignores both | **The seam.** Every call site is already correct for F2. |
| F2 Configuration Engine | `planned`, not built (2 open questions) | SYSTEM → ORGANIZATION → BRANCH, effective-dated, append-only | **Yes** — and it already lists `admissions.offer_validity_days`, `admissions.allow_deferment`, `admissions.quota_required`, `admissions.max_program_preferences` |
| `WorkspaceConfiguration` | `IMPLEMENTED` | PRODUCT/ORGANIZATION/BRANCH/ROLE/USER | **No** — navigation/client JSON; not effective-dated; ROLE/USER scopes are wrong for institutional policy |
| `SystemSetting` | `IMPLEMENTED` | singleton | No — product identity fields only |
| Branch / Organization settings | **do not exist** (`docs/modules/branch-settings.md`) | — | — |
| `DocumentRequirement` rows | `IMPLEMENTED` | organization, optional branch, programme/quota/category, stage | Yes for documents — but see §5.3 D1 |
| Academic Year / Program | `IMPLEMENTED` as data | — | No policy fields |

---

## 5. Supported and Unsupported Workflow Variations

### 5.1 What works today

| Variation | Status | How |
| :--- | :--- | :--- |
| No fee step, no waitlist, no document-request loop | `VERIFIED` | never issue those actions |
| Documents required for some programmes/quotas/categories only | `VERIFIED` | requirement rows with the axis set |
| No document requirements at all | `VERIFIED` | no rows ⇒ checklist satisfied |
| Offer window per institution | **not supported** | hard-coded 15 days |
| Deferment | **not supported** | hard-coded `false` |
| Skipping review, offer or seat confirmation | **not supported** | no edge; and adding one would bypass the checklist guard on `approve` |
| Separate "approval" before "offer" | **not supported** | `approve` *is* the offer |
| Eligibility checks | **not supported** | no eligibility concept anywhere |
| Maker/checker (reviewer ≠ approver) | **not supported** | no actor comparison guard |

### 5.2 The three example processes

| Example | Supported today | Configurable safely | Needs new backend |
| :--- | :--- | :--- | :--- |
| **A — Small school** (details → programme/year → placement → admit) | all data steps; admit | profile selection | **direct-admit orchestration** (§11.3) |
| **B — Standard** (draft → submit → documents → review → offer → acceptance → seat → admit) | **fully, today** | offer window, deferment, detour flags | actions read contract; D1–D3 fixes |
| **C — Strict** (… eligibility → documents → review → approval → offer …) | submit, documents, review, offer, seat, admit | document stages | submission-stage document guard; maker/checker guard; eligibility = `REQUIRES BUSINESS DECISION` |

### 5.3 Verified defects that must be fixed first

| # | Defect | Evidence | Why it blocks |
| :--- | :--- | :--- | :--- |
| **D1** | **The checklist ignores `DocumentRequirement.branchId`.** A branch-specific requirement is enforced on every branch of the organization. | `checklist.service.ts` filters `organizationId` only; `document-requirement.service.ts` stores `branchId`; `checklist.service.spec.ts` never mentions `branchId`. | Branch-level document policy — the core of profiles B and C — is not expressible correctly. |
| **D2** | **Requirements tagged with an unguarded stage are never enforced.** Only `documentsReceived` and `approve` evaluate the checklist, against `{current, target}`. A requirement at `SUBMITTED` (checked on neither) or `SEAT_CONFIRMED`/`ADMITTED` (no guard on `confirmSeat` or `admit`) is accepted by `POST /document-requirements` and silently has no effect. | `workflow.transitions.ts` guard lists; `admission-conversion.service.ts` has no checklist call. | A strict profile's "documents before review" and any "documents before admission" rule look configured and do nothing — the fabricated-control failure the document spec exists to prevent. |
| **D3** | **No backend contract for legal actions or checklist status.** | `actionsFrom` unexposed; frontend `utils/workflow.ts`, `utils/checklist.ts`. | A per-branch workflow cannot be rendered correctly from a client-side copy. |

Minor, `VERIFIED`: the comment above `TRANSITIONS` still says `ADMITTED` is
unreachable (it has been reachable through `admit()` since Phase 5);
`FEE_PENDING` has no exit back to review and no Finance integration — it is a
parking state from which `approve` proceeds.

---

## 6. Example Small-School Admission Journey — `SIMPLE_ADMISSION` (`PROPOSED`)

| # | User does | Backend | Rows / history |
| :--- | :--- | :--- | :--- |
| 1 | Enters the child's details, guardian, programme ("Std 1") — year is the active scope | `POST /admissions/applicants` (+ guardian mapping) — unchanged | Applicant `DRAFT`, form + application numbers |
| 2 | Picks the section ("Std 1 – A") and clicks **Admit** | `POST /admissions/applicants/:id/direct-admit` `{ academicUnitId, remarks? }` | one transaction: `submit` (Person resolved) → `startReview` → `approve` (checklist evaluated; offer stamped) → `confirmSeat` → `admit` (Student, Admission, Enrollment, codes) |
| 3 | Sees the student code and admission number | response = `admit()`'s | **five** `WorkflowHistory` rows, five outbox events, each marked as part of a direct admission |

What the user never sees: review, offer and seat screens. What is never
skipped: Person resolution, programme requirement, one-live-application,
checklist evaluation, numbering, placement validation, year lock, both
permissions, the single transaction. If any step fails, nothing is written
(the applicant stays `DRAFT`).

## 7. Example Standard Admission Journey — `STANDARD_ADMISSION` (default; today's behaviour)

| # | State after | Action | Who |
| :--- | :--- | :--- | :--- |
| 1 | DRAFT | create, edit, attach documents and guardians | front office (`admissions.create/update`) |
| 2 | SUBMITTED | `submit` — Person resolved | front office |
| 3 | UNDER_REVIEW | `startReview` | admissions officer |
| 3a | DOCUMENT_PENDING ⇄ UNDER_REVIEW | `requestDocuments` (reason) / `documentsReceived` (checklist) — *if enabled* | officer |
| 3b | WAITLISTED / FEE_PENDING | *if enabled* | approver / officer |
| 4 | APPROVED | `approve` — checklist, offer window from policy | approver (`admissions.approve`) |
| 5 | SEAT_CONFIRMED | `confirmSeat` before expiry | officer |
| 5a | DEFERRED | `defer` — *if enabled* | approver |
| — | CANCELLED | `expireOffer` by the sweep if step 5 does not happen | system |
| 6 | ADMITTED | `admit` with section | registrar (`admissions.approve` + `student.create`) |

## 8. Example Strict-Verification Journey — `VERIFIED_ADMISSION` (`PROPOSED`)

As §7, plus:

| Addition | Mechanism | Status |
| :--- | :--- | :--- |
| Documents verified **before** review starts | checklist guard on `startReview` for `SUBMITTED`/`UNDER_REVIEW`-stage requirements (fixes D2 for this stage) | `PROPOSED` (engine change) |
| Documents required **before** admission | checklist guard on `confirmSeat` and inside `admit()` for `SEAT_CONFIRMED`/`ADMITTED`-stage requirements | `PROPOSED` (engine change) |
| Approval separate from review | `DISTINCT_ACTOR` guard on `approve`: the approver must not be the user who performed `startReview` (read from `WorkflowHistory`) | `PROPOSED` (engine change) |
| "Approval" separate from "offer" | **not proposed as a new state.** `approve` already stamps `approvedBy` and the offer together; a separate pre-offer approval would be a fourteenth state | `REQUIRES BUSINESS DECISION` |
| Eligibility checks | no definition exists (age cut-off? previous class? marks?) | `REQUIRES BUSINESS DECISION` / `DEFERRED` |
| Detours | document request loop always enabled | configuration |

---

## 9. Recommended Configuration Hierarchy — `RECOMMENDED`

**SYSTEM → ORGANIZATION → BRANCH**, most specific wins, effective-dated — i.e.
exactly F2 D2/D3. Nothing finer.

| Level | Verdict | Reason |
| :--- | :--- | :--- |
| Organization | **yes** — the usual place a chain sets its default | one trust running five schools usually has one process |
| Branch | **yes** — the override | a pre-primary branch and a junior college in one organization genuinely differ |
| Academic year | **no** — use effective dating | "from next year we verify documents" is `effectiveFrom = year start`; a year column would be a second time axis competing with F2's |
| Program | **no** for the profile | a profile per programme means one branch runs several processes on one screen and one counter; programme variance already exists where it belongs — `DocumentRequirement.appliesToProgramId` |

## 10. Workflow Profiles and Policy Options — `PROPOSED`

### 10.1 F2 keys

| Key | Type | Default (SYSTEM) | Scope |
| :--- | :--- | :--- | :--- |
| `admissions.workflow_profile` | `SIMPLE_ADMISSION` \| `STANDARD_ADMISSION` \| `VERIFIED_ADMISSION` | `STANDARD_ADMISSION` (today's behaviour — zero change on rollout) | org, branch |
| `admissions.offer_validity_days` | int ≥ 1 | 15 | org, branch (already in F2 §9) |
| `admissions.allow_deferment` | bool | false | org, branch (already in F2 §9) |
| `admissions.waitlist_enabled` | bool | true | org, branch |
| `admissions.fee_step_enabled` | bool | true | org, branch |
| `admissions.document_request_enabled` | bool | true | org, branch |

Six keys, not a designer. `RECOMMENDED`: an unrestricted workflow designer is
rejected for the reasons already recorded (Q10/B14) — it makes "can this
application be approved?" unanswerable without a tenant's graph, and it can
draw a path to `ADMITTED` around `admit()`.

### 10.2 What each step can be

| Step | SIMPLE | STANDARD | VERIFIED | Can policy change it? |
| :--- | :--- | :--- | :--- | :--- |
| Draft / applicant details | required | required | required | no |
| Person resolution at submit | required (inside direct-admit) | required | required | **never** |
| Programme selected | required | required | required | **never** (DB CHECK) |
| Guardian | optional | optional | optional | `REQUIRES BUSINESS DECISION` (§22) |
| Review | **orchestrated** (recorded, not a screen) | required | required + maker/checker | profile |
| Document request loop | disabled | flag | always enabled | flag |
| Document checklist | evaluated at the orchestrated `approve` | evaluated | evaluated at more stages | **rows**, never a flag |
| Waitlist / fee step | disabled | flag | flag | flag |
| Offer + acceptance | orchestrated | required | required | profile |
| Deferment | disabled | flag | flag | flag |
| Placement + admit | required | required | required | **never** |

"Disabled" means the action is not offered and is refused by the engine with a
named error — not hidden by the UI.

## 11. State Machine and Transition Design

### 11.1 What stays — `RECOMMENDED`

The thirteen states, the fifteen action rules, `orchestratedOnly`, `systemOnly`, the
lock-then-decide engine, per-transition history and events. **No new state, no
new edge, no edge into `ADMITTED` other than `admit()`.**

### 11.2 Configuration vs engine change

| Need | Configuration only | Engine change |
| :--- | :--- | :--- |
| Offer window, deferment | ✅ swap `AdmissionConfigProvider` to F2 | — |
| Disable waitlist / fee / document loop | — | new guard `POLICY_ENABLED(key)` on those three rules (a guard, not an edge) |
| Profile-gated direct admission | — | new orchestrated operation (§11.3) |
| Documents before review / before admission | requirement rows | checklist guard on `startReview`, `confirmSeat`, and inside `admit()` (fixes D2) |
| Maker/checker | — | `DISTINCT_ACTOR` guard on `approve` when profile = VERIFIED |
| Branch-correct checklist | — | D1 fix in `ChecklistService` |

### 11.3 Direct admission — `PROPOSED`

`AdmissionConversionService.directAdmit(applicantId, { academicUnitId, remarks }, scope, actor)`:

1. Pre-transaction (no lock held): profile resolves to `SIMPLE_ADMISSION`
   (else `403 WORKFLOW_PROFILE_MISMATCH`); actor holds `admissions.update`,
   `admissions.approve` **and** `student.create`; placement and numbering
   validated exactly as `admit()` does today.
2. One `$transaction`: lock the applicant; assert `DRAFT` (or `SUBMITTED` /
   `UNDER_REVIEW`, so a partly-walked application can finish); then call
   `WorkflowService.transition(…, tx)` for each remaining spine edge with
   `request.orchestrated = 'DIRECT_ADMISSION'` — **every guard runs**,
   including `DOCUMENT_CHECKLIST_SATISFIED` on `approve`; then run `admit()`'s
   existing body on the same `tx`.
3. Each history row and event carries the marker so a report can tell a
   direct admission from a walked one.

Rejected alternatives: a `DRAFT → SEAT_CONFIRMED` or `DRAFT → ADMITTED` edge
(skips guards, timestamps and `approvedBy`; breaks the "one row per step"
history); flipping statuses in a loop outside the engine (a second engine).

Engineering prerequisite (`VERIFIED` shape): `admit()` currently opens its own
transaction and asserts `SEAT_CONFIRMED` before it; its body must be factored so
it can run on a caller's `tx` after the preceding transitions — the same
pattern `WorkflowService.transition` already supports.

### 11.4 Authorization, validation, concurrency, expiry

- **Authorization** never weakens: each orchestrated step still checks its own
  rule's permission, so a SIMPLE profile needs a user who holds every
  permission the walked steps need. `RECOMMENDED`: no new "direct admit"
  permission — composing existing ones is stricter and auditable.
- **Required fields** are the existing ones; a profile cannot relax a
  non-null column or a CHECK.
- **Concurrency:** the applicant row lock is taken once, first; a parallel
  `transition` or `admit` blocks and then fails its from-state check, exactly
  as today. `applicant_one_active` and `student_one_per_applicant` remain the
  backstops.
- **Expiry sweep:** unchanged. A direct admission stamps and consumes the offer
  in the same transaction, so the sweep can never see it `APPROVED`. The sweep
  reads `offerExpiresAt` already written, so changing
  `offer_validity_days` never moves an issued deadline.

## 12. Document and Identity Rules

| Rule | Classification |
| :--- | :--- |
| Person resolved at submission, government identifier as the deterministic key, no demographic merge | **mandatory**, every profile |
| Document requirements | **configurable as data** (rows per org/branch/programme/quota/category/stage), not by profile |
| Verified (not merely uploaded) current version satisfies a requirement | **mandatory** semantics — `VERIFIED` |
| Expiry never blocks satisfaction | **mandatory** (blueprint §11.5) |
| Every document verified before every admission | **not assumed** — only rows marked mandatory at a guarded stage are enforced |
| SIMPLE profile with mandatory requirement rows | the orchestrated `approve` refuses with `409 DOCUMENTS_INCOMPLETE` naming what is missing — the school must verify or not configure the requirement |
| "Upload now, verify later" (admit on unverified documents) | `REQUIRES BUSINESS DECISION` — would need a satisfaction mode `UPLOADED` per requirement; not proposed by default |

## 13. Applicant, Guardian and Person Integration

- Person: unchanged — resolved inside `submit` in every profile, including the
  orchestrated one. `admit()` reuses `Applicant.personId` (the Phase 5.5 fix).
- Guardian: `VERIFIED` that nothing requires one. `admit()` projects mappings
  with a `personId` onto `Guardianship`; mappings without one are skipped by
  design. Primary/financial exclusivity is enforced on sync.
  `REQUIRES BUSINESS DECISION`: should a guardian (and a primary one) be
  required before admission for minors? If yes it is a profile-independent
  guard inside `admit()`, not a profile option.
- Address: inline on Applicant (required at create); unchanged.

## 14. Admission Conversion and Enrollment

Unchanged in every profile: one transaction, Person → Student (+`STUDENT_CODE`)
→ Admission (+`ADMISSION_NO`) → guardianship sync → Enrollment (leaf unit
matching branch/year/programme; year unlocked) → status last. `STUDENT_ALREADY_EXISTS`
remains the readmission boundary. Numbering must be provisioned for
`ADMISSION_FORM`, `APPLICATION`, `STUDENT_CODE` and `ADMISSION_NO` regardless
of profile — a SIMPLE school still needs all four sequences.

## 15. Security, Permissions and Audit

- Tenant isolation: the row lock is scoped to organization and branch; profile
  resolution uses the resolved request scope, never a body value.
- A profile is **read** at decision time from F2; it is never a request field.
- Who may change `admissions.*` keys: F2 Q2 recommends a per-category
  permission (`config.admissions.write`) — `REQUIRES BUSINESS DECISION`, and a
  blocker for this work (an ORG_ADMIN-wide toggle that shortens every branch's
  process is a control change).
- Audit: F2 writes are append-only and evented; every orchestrated transition
  keeps its own history row and event; the direct-admit marker makes the path
  reportable.
- Related open item: `backend/docs/backend pending.md` SEC-07 (role permission
  matrix editable platform-wide by ORG_ADMIN) affects who effectively holds
  `admissions.approve`.

## 16. Existing Application Compatibility — `RECOMMENDED`

Resolve every policy with **`asOf`** — the design `AdmissionConfigProvider`
already anticipates:

| Application state when config changes | Rule |
| :--- | :--- |
| `DRAFT` | follows the current profile (nothing has been decided yet) |
| `SUBMITTED` … `SEAT_CONFIRMED` | profile and flags resolved `asOf submittedAt` — an in-flight application finishes the process it entered |
| `APPROVED` | `offerExpiresAt` is already stored; never recomputed |
| Terminal | unaffected |

No `workflowProfile` column on `Applicant` is required if F2's effective dating
is built as specified. `REQUIRES BUSINESS DECISION` (low cost either way): a
snapshot column is an alternative if F2 is delayed or if reports must filter by
profile without re-resolving.

## 17. Required Schema/API Changes — `PROPOSED`

| Change | Kind | Phase |
| :--- | :--- | :--- |
| `ChecklistService` filters `branchId IS NULL OR branchId = scope.branchId` | code | 1 |
| Checklist guards on `startReview`, `confirmSeat`, inside `admit()` (or: `POST /document-requirements` refuses stages no guard reads) | code — **REQUIRES BUSINESS DECISION** which | 1 |
| `GET /admissions/applicants/:id/workflow/actions` → `{ profile, actions: [{ action, remarksRequired, permitted, blockedBy: [{ guard, detail }] }] }` | new read API | 1 |
| `GET /admissions/applicants/:id/checklist` → required / satisfied / missing, by stage | new read API | 1 |
| F2 `ConfigDefinition` + `ConfigValue` + resolution | new schema (F2's own) | 2 |
| `AdmissionConfigProvider` backed by F2; six keys registered | code | 2 |
| `GET /admissions/workflow/policy` → effective profile + flags for the scope | new read API | 2 |
| `POLICY_ENABLED` guard on waitlist / fee / document-request | code | 3 |
| `POST /admissions/applicants/:id/direct-admit` | new orchestrated API | 3 |
| `DISTINCT_ACTOR` guard on `approve` (VERIFIED) | code | 4 |

No change to `AdmissionApplicationStatus`, `TRANSITIONS` edges, `Applicant`,
`Admission`, `Student` or `Enrollment` schemas.

## 18. Frontend Integration Requirements (no UI implemented here)

- **Discover, never mirror.** Buttons come from
  `GET …/workflow/actions`; `utils/workflow.ts` becomes labels/copy only.
  `blockedBy` drives "why can't I approve?" (e.g. the missing documents).
- **Checklist from the backend.** `utils/checklist.ts` is replaced by
  `GET …/checklist`, so branch scoping (D1) cannot diverge.
- **Profile-shaped journey.** `GET /admissions/workflow/policy` decides the
  wizard: SIMPLE shows *Details → Programme → Section → Admit* and calls
  `direct-admit`; STANDARD shows the status-driven hub; VERIFIED adds the
  document-verification gate before review. A disabled step is absent because
  the backend says so, not because the UI assumed it.
- Errors are rendered through `ApiErrorState` / `getErrorMessage` using the
  backend's named codes (`DOCUMENTS_INCOMPLETE` with `missing`,
  `WORKFLOW_PROFILE_MISMATCH`, `POLICY_DISABLED`, `ACADEMIC_UNIT_NOT_PLACEMENT_TARGET`, …).
- Per `frontend/AGENTS.md` §28, until each endpoint exists and is documented,
  the corresponding UI ships disabled behind `BackendPendingBadge`.

## 19. Migration and Backward Compatibility

- Default profile `STANDARD_ADMISSION` with all flags at today's values ⇒
  **zero behaviour change** on deploy; tenants opt in.
- D1 is a behaviour change for any organization that already wrote
  branch-scoped requirements: they stop applying to other branches. Before
  release, list `DocumentRequirement` rows with `branchId IS NOT NULL` and
  confirm with each tenant.
- D2's guard additions can newly block applications that carry requirements
  at `SUBMITTED`/`SEAT_CONFIRMED` stages. Same pre-release query; options are
  to enforce, re-stage or deactivate those rows (`REQUIRES BUSINESS DECISION`).
- The two `NOT VALID` CHECKs are unaffected; direct admission satisfies both
  (person and programme are set by `submit` inside the transaction).

## 20. Testing Strategy

| Layer | Cases |
| :--- | :--- |
| Unit (`workflow.service.spec`, `checklist.service.spec`) | branch-scoped requirement applies only to its branch; each new guard pass/fail; `POLICY_ENABLED` per flag; `DISTINCT_ACTOR` |
| Unit (`transitions.spec`) | exhaustiveness unchanged — same 13 states, same edges; no rule targets `ADMITTED` except `admit` |
| Integration (`admission-workflow`, `admit`) | direct-admit writes five history rows + Student/Admission/Enrollment; failure at each step leaves `DRAFT` and no rows; 20 concurrent direct-admits → one student; direct-admit vs concurrent `cancel` |
| Integration (`pipeline`) | the composed invariants hold for a SIMPLE-profile admission exactly as for a walked one |
| Config | profile change mid-flight: a submitted application keeps its process; a draft takes the new one; offer deadline never moves |
| E2E / Postman | actions and checklist contracts per profile; refusal codes |

## 21. Risks and Trade-offs

| Risk | Mitigation |
| :--- | :--- |
| SIMPLE becomes a way to skip controls | it walks every edge and every guard; it needs every permission involved; it is visible in history and audit |
| F2 is a prerequisite and not built | Phase 1 (defects + read contracts) delivers value without it; the provider seam keeps call sites stable |
| Profiles multiply into a designer | hold the line at three profiles + flags; any new need is a guard or a flag reviewed against Q10 |
| D1/D2 fixes change live behaviour | pre-release queries and tenant confirmation (§19) |
| Orchestration lengthens the `admit()` transaction | four extra single-row updates under a lock already held; validation stays outside |
| Frontend drift during transition | ship the actions contract before any profile UI |

## 22. Open Business Decisions

| # | Decision |
| :--- | :--- |
| BD1 | Who may change `admissions.*` policy (F2 Q2) — and may a branch override an organization's profile, or only tighten it? |
| BD2 | D2 resolution: enforce requirements at every stage they name (new guards), or refuse stages no transition reads? |
| BD3 | Is "approval" distinct from "offer" for strict institutions (a fourteenth state), or does `approvedBy` + maker/checker suffice? |
| BD4 | What is an eligibility check (age cut-off, previous class, marks, entrance test)? Without a definition it stays `DEFERRED`. |
| BD5 | Must a minor have a (primary) guardian before admission, in every profile? |
| BD6 | May any profile admit on uploaded-but-unverified documents? |
| BD7 | Snapshot `workflowProfile` on `Applicant`, or rely on F2 `asOf` only? |
| BD8 | Should SIMPLE allow direct admission from `SUBMITTED`/`UNDER_REVIEW` (finishing a partly-walked application), or only from `DRAFT`? |

## 23. Recommended Implementation Phases

| Phase | Scope | Depends on |
| :--- | :--- | :--- |
| **1 — Correctness and contracts** | D1 checklist branch scoping; D2 per BD2; `GET …/workflow/actions`; `GET …/checklist`; stale comment | BD2 |
| **2 — F2 for admissions** | F2 engine (or its admissions slice); provider swap; six keys; `GET /admissions/workflow/policy` | F2 Q1–Q2, BD1 |
| **3 — Profiles** | `POLICY_ENABLED` guards; `direct-admit` orchestration (with `admit()` body factored onto a caller `tx`) | Phase 2, BD8 |
| **4 — Strict verification** | `DISTINCT_ACTOR`; additional document stages | BD3, BD4 |
| **5 — Frontend** | consume actions/checklist/policy; profile-shaped journeys | Phases 1–3 contracts documented |

## 24. Final Recommendation

**Keep the state machine; configure reachability; add one orchestrated
operation.** Profiles are three named presets over six F2 keys at
ORGANIZATION/BRANCH scope, effective-dated so in-flight applications finish the
process they entered. `SIMPLE_ADMISSION` is delivered by a direct-admit
operation that walks the existing edges inside one transaction — every guard,
permission, Person resolution, numbering and placement rule still applies.
Fix D1–D3 first; they are correctness defects today and preconditions for any
branch-specific policy.

**Exact next phase:** Phase 1 — fix the checklist's branch scoping (D1), decide
and implement D2 (BD2), and add the read-only `workflow/actions` and
`checklist` endpoints. It needs no F2 and no schema change, it removes the
frontend's two shadow implementations, and every later phase depends on it.

### Current versus proposed

| Aspect | Current (`VERIFIED`) | Proposed |
| :--- | :--- | :--- |
| States / action rules | 13 / 15, global | **unchanged** |
| Path to ADMITTED | 4 calls + `admit()` | same, or one `direct-admit` that runs the same 5 steps (SIMPLE) |
| Policy source | hard-coded stub | F2, SYSTEM → ORG → BRANCH, effective-dated |
| Offer window / deferment | 15 days / off | per org/branch |
| Detours | always reachable | per-flag, refused by a guard when disabled |
| Document checklist scope | organization only (**D1**) | organization + branch |
| Document stages enforced | `documentsReceived`, `approve` only (**D2**) | every stage that can be configured |
| Maker/checker | none | VERIFIED profile |
| Frontend actions | mirrored client-side (**D3**) | `GET …/workflow/actions` |
| Frontend checklist | recomputed client-side | `GET …/checklist` |
| Admission conversion | one transaction | **unchanged** |
