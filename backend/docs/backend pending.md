# Backend Pending

The backend-only living tracker for gaps identified against
`frontend/docs/backend-gaps.md` (the frontend/backend contract-gap inventory)
during the 2026-08-21 backend audit. This is not a copy of that document —
every item here has been independently verified against actual backend
source (controllers, services, DTOs, Prisma schema, tests), and is
classified by what it actually is, not by how the frontend experienced it.

Frontend-only concerns (client-side filtering/paging, UI copy, disabled
controls, missing design-system fields with no backend counterpart) are not
listed here — see `frontend/docs/backend-gaps.md` for those.

Statuses: `OPEN` · `IN PROGRESS` · `DONE` · `DEFERRED` · `BUSINESS DECISION`
· `INFRASTRUCTURE` · `NOT A BACKEND GAP`

---

## P0 — Blocking / Security

None found. The one item that looked P0 on paper — the scope-header
mismatch (`X-Tenant-Id`/`X-Academic-Year` vs documented
`X-Organization-Id`/`X-Academic-Year-Id`) — turned out to be a non-issue;
see **BP-01** below.

---

## P1 — Contract / Correctness

### BP-01 — Scope header names: NOT A BACKEND GAP
- **Module:** Context / execution-context guard
- **Status:** `NOT A BACKEND GAP`
- **Evidence:** `src/modules/context/guards/execution-context.guard.ts:28-32` defines
  `SCOPE_HEADERS = { organizationId: ['x-organization-id', 'x-tenant-id'], branchId: ['x-branch-id'], academicYearId: ['x-academic-year-id', 'x-academic-year'] }`,
  and `header()` (`:145-157`) accepts either name in each pair. A code comment
  (`:14-27`) states the second name in each list is "an accepted alias that
  the shipped web client sends." `src/modules/context/constants/context.constants.ts:1-5`
  documents the canonical names used in docs/Postman.
- **Required action:** none on the backend. The frontend's `X-Tenant-Id`/
  `X-Academic-Year` headers already work today via the alias. Converging the
  frontend to the canonical names is a frontend-side cleanup, not a backend
  fix, since both resolve identically today.
- **Dependencies:** none.

### BP-02 — Numbering pre-flight ignored `isActive` (D22): DONE
- **Module:** Admissions / admission-conversion
- **Status:** `DONE`
- **Evidence:** `assertNumberingProvisioned` in
  `src/modules/admissions/admission/admission-conversion.service.ts` queried
  `NumberSequenceConfig` without `isActive: true`, while `NumberingService.requireConfig`
  (the in-transaction allocator) has always filtered on it. A deactivated
  (not deleted) sequence config passed the pre-flight check and then failed
  deterministically inside the transaction — not a race, a guaranteed
  failure on every `admit()` attempt for that organization until the config
  was reactivated.
- **Fix:** added `isActive: true` to the pre-flight query, matching
  `NumberingService.requireConfig`'s filter exactly.
- **Tests:** `test/unit/admission-conversion.service.spec.ts` — asserts the
  query's `where` clause includes `isActive: true`.
- **Dependencies:** none. No schema change.

### BP-03 — `NUMBERING_NOT_PROVISIONED` status inconsistency (D24): DONE
- **Module:** Admissions / admission-conversion, Numbering
- **Status:** `DONE`
- **Evidence:** The same condition ("no active sequence config") was `400`
  from the pre-flight check (`assertNumberingProvisioned`, before the
  transaction) and `500` from `NumberingService.requireConfig` when the same
  condition surfaced from inside the transaction (a TOCTOU race — the config
  is deactivated/deleted between the pre-flight read and `numbering.allocate()`
  running). Numbering itself is frozen and independently audited; changing
  its exception class would affect every purpose it serves (STUDENT_CODE,
  EMPLOYEE_CODE, ADMISSION_NO, RECEIPT, INVOICE, TC_NUMBER, CERTIFICATE), not
  just admission.
- **Fix:** `admission-conversion.service.ts`'s `translate()` now detects this
  specific `InternalServerErrorException` shape and remaps it to the same
  `BadRequestException` (400) the pre-flight uses, scoped to the `admit()`
  call path only. `NumberingService` itself is unmodified — every other
  caller keeps its existing 500 contract.
- **Tests:** `test/unit/admission-conversion.service.spec.ts` — simulates the
  in-transaction 500 and asserts the caller of `admit()` sees 400.
- **Dependencies:** none.

### BP-04 — `APPLICANT_ALREADY_ADMITTED` missing `admissionId`/`enrollmentId` (D23, SAE4): DONE
- **Module:** Admissions / admission-conversion
- **Status:** `DONE`
- **Evidence:** The conflict thrown when an applicant is already admitted
  carried only `studentId`/`studentCode`, though the Admission and Enrollment
  for that student already exist by the time the conflict fires. No "View
  Admission"/"View Enrollment" deep link could be built from the response
  alone.
- **Fix:** both throw sites now resolve and include `admissionId` and
  `enrollmentId` — the lock-reread path (`explainIneligible`, inside the
  active transaction) via a new `findActiveAdmissionAndEnrollment` helper,
  and the P2002-race path (`translate()`) via the same helper run outside
  the (already rolled-back) transaction, against `this.prisma`.
- **Tests:** `test/unit/admission-conversion.service.spec.ts` — both paths
  covered.
- **Dependencies:** none.

### BP-05 — No authenticated change-password endpoint (K1): DONE
- **Module:** Auth
- **Status:** `DONE`
- **Evidence:** `POST /auth/reset-password` existed but required a
  single-use recovery token — it is account recovery, not something a
  signed-in user with a known current password can call. `src/modules/auth/auth.controller.ts`
  had no route for this.
- **Fix:** added `POST /auth/change-password` (authenticated). Verifies
  `currentPassword` via the existing `PasswordService.compare` (the same
  pattern `login()` uses), hashes the new password, revokes every refresh
  token for the account (same effect as `resetPassword`, reusing its
  transaction shape), and publishes the existing `PasswordChangedEvent` —
  already in `AuditListener`'s registered event set, so the change is
  audited without any new wiring.
- **Tests:** `test/unit/auth.service.spec.ts` — wrong-current-password
  rejection, missing-user handling, and the full success path (hash
  updated, sessions revoked, event published).
- **Dependencies:** none. No schema change — reuses `User.passwordHash` and
  `RefreshToken`.

---

## P2 — Required Features

### BP-06 — No `GET /workspace/configuration` read endpoint (L1): DONE
- **Module:** Workspace
- **Status:** `DONE`
- **Evidence:** `WorkspaceConfiguration` had only `POST /workspace/configuration`
  (upsert) — no way to read back a previously-saved layer before editing it.
  `WorkspaceConfigService.upsertConfiguration` already ran the exact lookup
  (`findFirst` keyed on `scopeType`/`scopeId`, matching the model's
  `@@unique([scopeType, scopeId])`) a read endpoint would need.
- **Fix:** added `GET /workspace/configuration/:scopeType?scopeId=` (same
  `SUPER_ADMIN` + `Settings.Manage` guard as the write endpoint), backed by a
  new `WorkspaceConfigService.getConfiguration()` that reuses the existing
  lookup pattern verbatim. Returns 404 if no layer has ever been saved for
  that exact scope — deliberately distinct from the *merged* configuration
  `GET /workspace`'s `configuration` field resolves.
- **Tests:** `test/unit/workspace-config.service.spec.ts` — exact-scope
  lookup and the `PRODUCT`-layer (`scopeId: null`) case.
- **Docs:** `docs/core/workspace/configuration.md` updated with the new route.
- **Dependencies:** none. No schema change.

---

## P3 — Hardening

### BP-07 — Response-body documentation gaps for three read endpoints (A): DEFERRED (documentation only)
- **Module:** Maintenance, Audit
- **Status:** `DEFERRED`
- **Evidence:** `GET /maintenance-rules/active/status`, `GET /audit-logs/summary`,
  and `GET /audit-logs/timeline` are fully implemented with stable, typed
  response shapes (`MaintenanceStatusDto`, `AuditSummaryDto`, `AuditTimelineDto`)
  and full Swagger `@ApiOkEnvelope` decoration — confirmed by reading the
  controllers, DTOs and repository methods directly. The *markdown* module
  docs (`docs/modules/maintenance.md`, `docs/core/audit.md`) simply don't
  transcribe these shapes into their data-structure tables.
- **Required action:** transcribe the three DTOs into the module docs. Not
  done in this pass — it's pure documentation work with no code or contract
  change, and the Swagger UI already serves as the authoritative live
  reference in the meantime.
- **Dependencies:** none.

### BP-08 — Maintenance's 12 presentation fields undocumented (C1): DEFERRED (documentation only)
- **Module:** Maintenance
- **Status:** `DEFERRED`
- **Evidence:** `title`, `shortMessage`, `description`, `reason`,
  `estimatedCompletion`, `maintenanceWindow`, `supportContact`, `bannerColor`,
  `severity`, `maintenanceIcon`, `announcementLink`, `externalStatusPageUrl`
  are all real Prisma columns (`prisma/modules/system/maintenance-rule.prisma:29-41`),
  all in the create/update DTOs, all persisted (no field filtering in the
  service), and all returned by `MaintenanceRuleDto`. Only 7 of the 12 are
  echoed in the *public* `active/status` payload — the other 5 are
  admin-CRUD-only, which is intentional (a public status page doesn't need
  an icon name or a CMS link), not a gap.
- **Required action:** same as BP-07 — transcribe into `docs/modules/maintenance.md`.
- **Dependencies:** none.

### BP-09 — `severity` has no defined value set (C2): BUSINESS DECISION
- **Module:** Maintenance
- **Status:** `BUSINESS DECISION`
- **Evidence:** `MaintenanceRule.severity` is a free-text column; only
  `"INFO"` has ever been observed. No enum exists in the schema.
- **Required action:** decide the value set (e.g. `INFO`/`WARNING`/`CRITICAL`)
  if a fixed vocabulary is wanted, then add it as a Prisma enum — additive,
  no destructive migration. Not decided in this pass; free text remains
  correct until a vocabulary is chosen.

### BP-10 — No audit-log export endpoint (D5): DEFERRED (not in current contract)
- **Module:** Audit
- **Status:** `DEFERRED`
- **Evidence:** `AuditRepository` (`src/infrastructure/audit/audit.repository.ts`)
  has exactly `createAuditLog`, `createDeduplicated`, `findAuditLogs`,
  `queryAuditLogs`, `getAuditSummary`, `getAuditTimeline`, `getAuditLogById`
  — no export/CSV/streaming builder anywhere. `postman/erp.postman_collection.json`'s
  Audit Log folder has no export request. `docs/core/audit.md` never
  mentions export. Per the audit task's own instruction: if export is not
  part of the existing backend contract/architecture, do not invent it.
- **Required action:** a business decision on whether export is wanted at
  all, and if so, whether it needs streaming (the audit log can be large) and
  what authorization/redaction rules apply beyond the existing filter set.
  Not implemented — inventing an export format and auth model without that
  decision risks building the wrong thing.
- **Dependencies:** decision on retention/PII redaction policy for exported
  rows.

### BP-11 — `Applicant.personId` missing from the Swagger response DTO (AP2): DEFERRED (documentation only)
- **Module:** Admissions / Applicant
- **Status:** `DEFERRED`
- **Evidence:** `personId` is genuinely returned in the real JSON response
  (`ApplicantService.findOne`/`create` return the raw Prisma row, no
  `select` projection, no serialization interceptor) but is absent from
  `ApplicantDto`'s Swagger annotations — a Swagger/generated-docs gap only,
  not a runtime defect.
- **Required action:** add the field to the DTO for documentation accuracy.
  Low risk, not done in this pass to keep the batch scoped to verified
  functional gaps.

---

## Business Decisions

### BP-12 — Organization suspend/reactivate has no write path (E4)
- **Module:** Organization
- **Status:** `BUSINESS DECISION`
- **Evidence:** `OrganizationStatus.SUSPENDED` exists in the enum
  (`prisma/modules/organization/organization-status.enums.prisma`) but no
  endpoint ever sets or clears it — the only status transition is
  `DELETE :id` → `INACTIVE`. Combined with **E2** (the list endpoint excludes
  `INACTIVE` orgs and has no parameter to include them), a deactivated
  organization is today irreversible and invisible from the API.
- **Required action:** decide whether `SUSPENDED` is a real, reachable state
  (needs a suspend/reactivate endpoint pair) or should be removed from the
  schema. Not implemented — this is a lifecycle-design decision on a
  frozen-unless-justified module (Organization), not a bug fix, and no
  Postman/architecture doc currently promises the endpoints.

### BP-13 — Branch Settings does not exist (F12)
- **Module:** Branch
- **Status:** `BUSINESS DECISION`
- **Evidence:** No `BranchSettings` entity, table, service, or controller
  exists anywhere in `src/` or `prisma/`. `docs/modules/branch-settings.md`
  already and correctly documents this absence and enumerates the candidate
  fields (working hours, holiday calendar, grading system, attendance
  policy, biometric/LMS/webhook integration, etc.) — it is an honest gap
  document, not a stale one.
- **Required action:** a scoping decision on which of the ~20 candidate
  fields are in scope, and whether some belong in existing modules instead
  (e.g. locale already lives in System Settings). Not built — this is a
  multi-screen feature, explicitly out of scope for a "minimal compatibility
  fix" per this audit's brief.

### BP-14 — System Settings has no branding/localization/security-policy/infrastructure fields (B4-B7)
- **Module:** System Settings
- **Status:** `BUSINESS DECISION`
- **Evidence:** `prisma/modules/system/system-setting.prisma` has only
  `productName/productCode/version/environment/maintenanceMode/maintenanceMessage/defaultTimezone/defaultCurrency/defaultLanguage/supportEmail/supportPhone/isActive`
  — no logo/branding, no 2FA/session-timeout/IP-allowlist policy fields, no
  infrastructure/health metrics.
- **Required action:** scope decision per field group. Not built.

### BP-15 — Two-factor auth, security preferences, login history, security activity feed, trusted devices, deactivate/delete account, security score (K2-K4, K6, K9, K10)
- **Module:** Auth / Security Center
- **Status:** `BUSINESS DECISION`
- **Evidence:** `User.isTwoFactorEnabled`/`twoFactorSecret` exist in Prisma
  but are explicitly commented as unimplemented and never written or
  selected into any response. No login-history, security-activity,
  trusted-device, or account-deactivation model or endpoint exists anywhere.
- **Required action:** explicit architecture decisions per capability, per
  this audit's own instruction not to implement 2FA enrollment or
  trusted-device management without one. Not built.

### BP-16 — `logout`/session-revocation emit no audit event (K5, partial)
- **Module:** Auth
- **Status:** `BUSINESS DECISION`
- **Evidence:** `AuditListener`'s registered event set already includes
  `user.logged_in` and `communication.password_changed`/`password_reset_requested`
  — login and password changes *are* audited today, contrary to the
  frontend report's blanket claim. `logout()`, `revokeSession()`, and
  `revokeAllSessions()` genuinely publish no event, so those three actions
  leave no audit trail.
- **Required action:** decide whether to add `user.logged_out`/
  `user.session_revoked` events. Not done in this pass — it touches three
  existing, working endpoints outside the specific change-password gap this
  audit was asked to close, and risks scope creep without an explicit ask.

---

## Infrastructure Dependencies

None identified in this pass beyond BP-10's redaction/retention policy
dependency (recorded there).

---

## Deferred / Future

- **G14** — No academic calendar (terms, holidays, exam windows) beyond the
  two `AcademicYear` dates. Large, undecided feature; not part of this
  audit's brief (Academic Year is frozen unless a concrete correctness
  defect is found — none was).
- **SAE1** — `Admission` has no direct `GET .../:id`; reachable only through
  `Enrollment` or the `admit()` response. Consistent with the model's role
  in the architecture (a provenance/history spine, not a primary query
  entity) — not treated as a defect.
- **SAE2** — `POST /students/:id/branch-transfer` existence unconfirmed
  against the captured Postman collection. Needs direct confirmation, not a
  code change.
- **GD3** — A nested `guardians[]` field on Applicant create is designed but
  not confirmed present in the wire contract. Needs direct confirmation.
- **WF3** — `admit()` writes a `WorkflowHistory` row for the Applicant only,
  none for the freshly created Admission or Enrollment, so
  `GET /enrollments/:id/history` on a new student returns empty. Confirmed
  accurate; treated as a design question (should a "birth" get a history
  row at all) rather than a bug, since Admission/Enrollment's history
  semantics were deliberately scoped to post-creation *changes* in the
  frozen architecture. Not changed in this pass.

---

## Completed / Verified (no code change needed)

- **Numbering, Student Code, Application/Admission numbering** — fully
  re-verified against the engine, `SEQUENCE_PURPOSE_RULES`, and Postman.
  Already correct (see BP-02/BP-03 for the two admission-side edge cases
  that were fixed).
- **DocumentType, DocumentRequirement, checklist satisfaction** — verified
  in the prior audit pass (duplicate prevention, branch-scope validation,
  quota/category resolution, `DOCUMENT_CHECKLIST_SATISFIED`). No further
  gaps found this pass.
- **Admission Masters delete-dependency guard (L4)** — the frontend report's
  claim that no in-use check exists before deleting a master is stale.
  `base-master.service.ts`'s `remove()` already throws `MASTER_IN_USE`
  against configured reference relations for all 10 masters (Category,
  Caste, Religion, Gender, Language, Blood Group, Disability, Admission
  Source, Quota, Relation Type), confirmed by reading every service file.
- **`GET /academic-years/:id` (G2)** — exists (`academic-year.controller.ts:119`).
- **Academic Year lifecycle inverses (G3/G4)** — no deactivate/deselect/unlock
  endpoints exist, and this is intentional exclusive-swap semantics
  (activating one year deactivates the previous one; there is nothing to
  "undo" to), not a missing feature. Locking blocks update/delete only —
  activate/select/lock remain callable on a locked year, also intentional
  and already documented in the controller's own doc comments.
- **`Program.level` (H1)** — a real, persisted, returned field
  (`prisma/schema.prisma:131`, `CreateProgramDto`, `ProgramResponseDto`).
  The frontend report's claim it's undocumented-and-unconfirmed was correct
  for the markdown docs, but the field itself is fully implemented.
- **AcademicUnit dual write paths for `parentId`/`isActive` (I4/I5)** — both
  exist by design and are already documented in the controller's own doc
  comments: `PATCH /:id` sets values directly (including `parentId`, without
  `level` recalculation) while `PATCH /:id/move` recalculates `level`;
  `PATCH /:id` sets `isActive` to a target value while `PATCH /:id/status`
  flips it (bodyless, non-idempotent, same pattern as Branch). Not changed —
  redesigning either would be a frozen-architecture change with no
  correctness defect behind it.
- **System Settings identity/audit metadata (B1)** — `id`/`createdAt`/
  `updatedAt`/`createdBy`/`updatedBy` all exist in the DTO and schema. Note:
  the controller never passes the caller's `userId` through to
  `updateSystem`/`initSystem`, so `createdBy`/`updatedBy` are always `null`
  in practice — a real but minor wiring gap, not listed as a numbered item
  above because it doesn't affect any documented contract (the fields are
  typed nullable already) and fixing it was judged lower value than the
  five P1/P2 items actually fixed this pass. Worth a follow-up.
- **System Settings PATCH semantics (B2)** — already a true partial update
  (`UpdateSystemDto extends PartialType(CreateSystemDto)`).
- **System Settings RBAC (B8)** — real `@Roles`/`RequirePermission` guards
  confirmed; no `x-role` header simulation exists anywhere in `src/`.
- **Branch status toggle (F4)** — confirmed intentionally bodyless
  (flips `isActive`, non-idempotent by design, documented as such in the
  controller). Not a bug.

---

## Out of scope for this pass (per audit brief)

Fees and every other module not named above were not inspected or modified,
per this audit's explicit instruction to stop after the cross-verification,
fixes, tests, documentation, and commits described here.
