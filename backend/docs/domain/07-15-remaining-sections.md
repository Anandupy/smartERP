# Sections 7–15 — Decisions

Companion to [01-04-review-of-frozen-decisions.md](01-04-review-of-frozen-decisions.md)
and [05-06-admission-enrollment.md](05-06-admission-enrollment.md).

Two conventions used throughout, carried from the earlier documents:

- **Three-tier resolution** — SYSTEM → ORGANIZATION → BRANCH, most specific wins.
  Applies to masters and to configuration.
- **`Person`** — the organization-scoped identity index proposed as defect D4.
  `Student`, `Guardian`, and `Employee` all reference it; none owns it.

---

## SECTION 7 — Guardian & Family (20)

**The governing decision:** a Guardian is a **person**, and guardianship is a
**relationship**. Every attribute that sounds like a guardian property —
primary, financial, emergency, pickup, biological, foster — is actually a
property of the *link* between that person and one particular child. Your
existing `ApplicantGuardianMapping` already gets this right
(`admissions-production-audit.md` §4); the same shape must extend to Student.

| # | Question | Decision |
| :--- | :--- | :--- |
| 1 | Guardian independent entity? | **Yes**, and organization-scoped (not branch-scoped) — siblings often sit in different branches. Backed by a `Person` record. |
| 2 | Multiple students? | **Yes.** One guardian ↔ many children, already supported. |
| 3 | Multiple guardians? | **Yes**, unbounded. Father, mother, grandparent, driver, local guardian. |
| 4 | One primary guardian? | **Exactly one per student**, enforced by a partial unique index — not by application code. The current toggle-then-upsert is untransacted and is a live bug (`admissions-production-audit.md` §4). |
| 5 | Financial guardian? | Flag on the mapping. **Exactly one per student**, same index pattern. This is who invoices address and who receives fee dunning. |
| 6 | Emergency guardian? | Flag on the mapping, **ordered** by `priority`. Multiple allowed — that is the point of an escalation list. |
| 7 | Pickup guardian? | Flag on the mapping, multiple allowed, each with optional validity dates and a photo. Gate changes behind approval by the primary guardian. |
| 8 | Biological guardian? | Attribute of `relationTypeId` (master), not a separate flag. |
| 9 | Foster guardian? | Same — a `RelationType` value. Add `isLegalGuardian` on the mapping for custody, which is legally distinct from biology. |
| 10 | Guardian login? | **Yes**, via a `User` linked to the Guardian (Section 14). Mobile + OTP is the realistic default for Indian parents; email is optional. |
| 11 | Parent portal? | **Yes.** One login shows **all** linked children across branches within the organization — this is the payoff for org-scoping the guardian. |
| 12 | Shared household? | **No `Household` entity in v1.** It is the classic premature abstraction: it adds a mandatory join to every address and contact read, and delivers value only for the minority of cases where it is genuinely shared. Revisit only if transport routing demands it. |
| 13 | Shared address? | **Yes** — via the polymorphic `Address` model in Section 8, not via Household. Two students can reference the same address row. |
| 14 | Guardian merge? | **Yes**, same confidence-scored, admin-confirmed, audited pattern as applicant merge (§4 Q13). Merging guardians is *more* common than merging applicants — every sibling admission is a chance to create a duplicate. |
| 15 | Guardian duplicate? | Detect on hashed government ID (high), mobile (medium), name+DOB (low). **Warn, never block** — consistent with §4 Q14. |
| 16 | Guardian archive? | **Yes**, when no active mapping remains. Archived guardians stay searchable for re-linking. |
| 17 | Guardian delete? | **No.** Soft delete only, and blocked while any mapping exists. |
| 18 | Guardian transfer? | Not a real operation. A guardian isn't branch-owned; only mappings move, and they move with the child. |
| 19 | Sibling relationship? | **Derived, not stored.** Two students sharing a guardian mapping are siblings. Storing an explicit sibling edge creates a second source of truth that will drift. Materialize it as a view if performance demands. |
| 20 | Family tree? | **Out of scope.** A school ERP needs guardianship and siblinghood, not genealogy. |

---

## SECTION 8 — Address (15)

**The governing decision:** two different things are both called "address" and
must not share a model.

- The address **on the application form** is a legal snapshot of what was
  declared on a date. It must never change. Your inline fields on `Applicant`
  (schema.prisma:185–191) are correct and should stay exactly as they are.
- The address **of a living person** changes. It needs its own entity, types,
  and history.

| # | Question | Decision |
| :--- | :--- | :--- |
| 1 | Owned by Student? | **No.** Owned by `Person`, referenced by whoever needs it. |
| 2 | Guardian? | Same — `Person`-owned. |
| 3 | Household? | **No** (see §7 Q12). |
| 4 | Shared? | **Yes.** Siblings and guardians reference one address row. Edits propagate, which is the desired behaviour — a family moves once. |
| 5 | Permanent? | `addressType = PERMANENT`. Used on certificates and TCs. |
| 6 | Current? | `addressType = CURRENT`. Used for transport routing and verification. |
| 7 | Communication? | `addressType = COMMUNICATION`. Falls back to CURRENT when unset. |
| 8 | Billing? | `addressType = BILLING`. Resolves from the **financial guardian**, and is what appears on a GST invoice. |
| 9 | Emergency? | Not an address type — it's the emergency contact's own address, reached through the guardian mapping. |
| 10 | Geo location? | Optional `latitude`/`longitude`. Required only when transport is enabled. Do not make it mandatory at admission — staff will enter garbage to get past the field. |
| 11 | PIN validation? | **Yes**, against a seeded India PIN→district→state table. Auto-fill district and state from PIN; allow override. This removes the single largest source of dirty address data. |
| 12 | Country support? | `countryCode` (ISO 3166-1 alpha-2), default `IN`. Validation rules per country in configuration, matching §1 Q5's "configuration, not redesign." |
| 13 | Address history? | **Yes.** Append-only with `validFrom` / `validTo`. Never `UPDATE` an address row in place — a TC issued in 2029 must print the address as it was, not as it is. |
| 14 | Multiple addresses? | **Yes**, one active per type per person. |
| 15 | Address verification? | `verificationStatus` + `verifiedBy` + `verifiedAt` + linked proof document. Configurable whether verification is required before enrollment. |

---

## SECTION 9 — Documents (15)

**The governing decision:** one shared document service with polymorphic
ownership, **plus** a separate *requirements* concept. The second half is the
part usually forgotten: which documents are required is a function of
`admissionType × program × quota × category`, and that checklist is what drives
the `DOCUMENT_PENDING` status you already have.

| # | Question | Decision |
| :--- | :--- | :--- |
| 1 | Shared document module? | **Yes**, `ownerType` + `ownerId`. Never per-module document tables. |
| 2 | Versioning? | **Yes.** New upload = new version; old versions retained. Re-uploading a corrected marksheet must not erase what was originally submitted. |
| 3 | Expiry? | `expiresAt` on document *types* that have one (caste certificate, income certificate, medical fitness). Scheduled job flags expiring documents. |
| 4 | Verification? | **Yes**, a first-class workflow: `PENDING → VERIFIED / REJECTED` with verifier, timestamp, and reason. Runs through the same workflow engine as everything else. |
| 5 | Digital signature? | **Phase 3.** Design the storage to accept a detached signature; don't build signing now. |
| 6 | OCR? | **Phase 3**, and only as an *assistive pre-fill* that a human confirms. Never auto-accept OCR output into an identity field. |
| 7 | Categories? | Master-driven `DocumentType`, three-tier scoped, with `isIdentityProof` / `isAddressProof` / `isAcademicProof` classification flags. |
| 8 | Student documents? | Yes — and they must **carry over from the Applicant** at approval rather than requiring re-upload. |
| 9 | Guardian documents? | Yes, owned by the guardian's `Person`, so they are uploaded once for all siblings. |
| 10 | Employee documents? | Yes, same module. |
| 11 | Organization documents? | Yes — affiliation certificates, registration, board recognition. |
| 12 | Soft delete? | Yes, and **blocked** for any document that satisfied a verified checklist item. |
| 13 | Archive? | Move blobs to cold storage on a retention schedule; metadata rows stay hot. |
| 14 | Encryption? | **Mandatory at rest**, per-tenant keys. This is the mechanism that makes the DPDP crypto-erasure path (defect D3) possible — design them together, not separately. |
| 15 | Virus scan? | **Mandatory, non-negotiable, on ingest.** Parents upload arbitrary files from arbitrary devices. Quarantine on detection; never serve an unscanned blob. |

---

## SECTION 10 — Academic Structure (20)

**The governing decision:** your existing `Program` + `AcademicUnit`
(unlimited-depth `parentId` tree, `docs/modules/academic-unit.md`) is a genuinely
good foundation — it handles school and college shapes without branching logic.

**The gap is enormous, though: there is no Subject.** No `Subject`, no
curriculum mapping, no credits. Attendance cannot be period-wise, examination
cannot exist, NEP electives cannot exist, and timetabling cannot exist until
this lands. It is the critical path for Sections 12 and 13.

| # | Item | Decision |
| :--- | :--- | :--- |
| 1 | Program | Exists. Stable offering ("Engineering", "Primary English"). Keep as is. |
| 2 | Academic Unit | Exists. Dynamic, year-scoped tree. Keep as is. |
| 3 | Section | An `AcademicUnit` of type `DIVISION`/`SECTION`. No separate entity. |
| 4 | Grade | An `AcademicUnit` of type `CLASS`/`YEAR`. No separate entity. |
| 5 | Semester | An `AcademicUnit` of type `SEMESTER`, **or** a term of the academic calendar. Not an Enrollment (your Section 6 decision). |
| 6 | Subject | 🔴 **MISSING — build first.** Org-scoped master: code, name, type, default credits. |
| 7 | Curriculum | 🔴 **MISSING.** `CurriculumSubject` = a Subject offered to an AcademicUnit in an AcademicYear, carrying credits, `isElective`, max marks, and pass criteria. This is the join that makes marks and period attendance addressable. |
| 8 | Batch | `AcademicUnit` of type `BATCH` — practical/lab groups. Already supported. |
| 9 | Stream | `AcademicUnit` of type `STREAM` (Science/Commerce/Arts). Already supported. |
| 10 | Faculty | Two meanings. *Faculty as division* → `AcademicUnit`. *Faculty as teacher* → the missing **Employee** module (see the gaps document). |
| 11 | Department | `AcademicUnit` of type `DEPARTMENT`. Already supported. |
| 12 | Electives | `CurriculumSubject.isElective` + `StudentSubjectSelection` per enrollment, with a selection window and capacity limits. |
| 13 | Honors | Subject group tagged `HONORS`, with a minimum-credit rule. NEP. |
| 14 | Minors | Same mechanism, tagged `MINOR`. NEP. |
| 15 | Credit System | Credits on `CurriculumSubject`; earned credits on the mark record. Required by NEP (§1 Q7) and by APAAR/ABC credit reporting (§1 Q6). |
| 16 | CBCS? | Emerges from electives + credits. No separate model. |
| 17 | NEP? | Enabled by credits + multidisciplinary `SECONDARY` enrollments (§6 Q15) + ABC credit export. Design for it; ship it in Phase 2. |
| 18 | Multi-board? | Board sits on **Program**, not Branch — §2 Q2 allows one branch to run several boards. Board-specific behaviour lives in the grading and assessment *configuration*, never in code branches. |
| 19 | Academic Calendar? | 🔴 **MISSING.** `AcademicYear` today is "just its two dates" (`docs/modules/academic-year.md`). You need terms, holidays, working days, exam windows, and admission windows. Attendance percentages are uncomputable without working days. |
| 20 | Promotion Rules? | Configuration-driven ruleset (attendance %, pass criteria, subject minimums, fee clearance) evaluated at year end, producing a *proposed* promotion list that a human approves. Never auto-commit a promotion run. |

---

## SECTION 11 — Finance (20)

**The two governing decisions:**

1. **Fees attach to `Enrollment`, not `Student`.** The applicable fee is a
   function of branch, academic year, program, academic unit, and quota — every
   one of which lives on Enrollment. A Student spanning twelve years has twelve
   different fee liabilities.
2. **Money is append-only.** No soft delete, no in-place edit, no gaps in
   receipt numbers. Corrections are reversing entries. This is the one module
   where your existing non-gapless numbering (`numbering-review.md` §2B) is not
   a cosmetic issue — it is an audit failure.

| # | Question | Decision |
| :--- | :--- | :--- |
| 1 | Fees belong to Student? | **No** — Student is the identity the ledger hangs off, not the basis of liability. |
| 2 | Enrollment? | **Yes.** This is the anchor. |
| 3 | Applicant? | **Separately yes** — application and admission fees are pre-Student and belong to the Applicant. Two distinct ledgers that must reconcile at conversion. |
| 4 | Invoice? | **Yes**, immutable once issued. Changes happen via credit note. |
| 5 | Payment? | **Yes**, append-only, with idempotency keys on the gateway path. |
| 6 | Receipt? | **Yes**, immutable, **gapless-numbered**, branch+year scoped. Legally significant. |
| 7 | Scholarship? | Own entity: sanction → approval → application to invoice → disbursal. Not a discount. Different approval chain, different reporting, often externally funded. |
| 8 | Discount? | Fee-head-level, rule-driven (sibling, staff ward, early payment). Applied at invoice generation, never by editing an invoice. |
| 9 | Refund? | **Credit note + payout**, never a negative payment. Policy from configuration (§4 Q16). Approval workflow mandatory. |
| 10 | Fine? | A fee head that is generated by a rule (library overdue, late fee), not entered by hand. |
| 11 | Installments? | **Yes** — this is how Indian schools actually bill. Schedule on the fee structure; each installment produces its own invoice with its own due date. |
| 12 | Transport fee? | Fee head, driven by route/stop. **GST applies.** |
| 13 | Hostel fee? | Fee head, driven by room/mess allocation. **GST may apply.** |
| 14 | Exam fee? | Fee head, often per-attempt (supplementary, revaluation) rather than per-year. |
| 15 | Late fee? | Rule-generated on due-date breach, with a configurable grace period and cap. |
| 16 | Waiver? | Explicit, reason-coded, approval-gated, fully audited. The most-abused feature in any school ERP — make it hard and visible. |
| 17 | Financial Aid? | Same machinery as scholarship, different funding source flag. |
| 18 | GST? | **Per-fee-head tax configuration.** Core education services are exempt; transport, hostel, mess, uniforms, and books frequently are not. Do not apply GST globally, and do not hardcode rates — they change. |
| 19 | TDS? | **Out of scope for student finance.** TDS applies to vendor and salary payments, i.e. the payables/HR side, not fee collection. |
| 20 | Online Payment? | **Yes.** Provider-abstracted like your existing communication providers. Non-negotiable requirements: idempotency keys, webhook signature verification, reconciliation job, and a documented policy for payment-succeeded-but-callback-lost. That last case *will* happen and is the classic source of double payments. |

---

## SECTION 12 — Attendance (15)

**The governing decision:** attendance attaches to `Enrollment` (which fixes
student + year + section), and for period-wise it attaches to
`Enrollment × CurriculumSubject × date × period`. It never attaches to Student
directly — a Student has no section.

**Second decision:** biometric, RFID, and face devices are **ingestion sources**,
not part of the domain model. They write to a raw `AttendanceEvent` stream; a
resolver turns events into attendance records. Modelling devices into the core
means every hardware vendor change becomes a schema migration.

| # | Question | Decision |
| :--- | :--- | :--- |
| 1 | Student? | No — via Enrollment. |
| 2 | Enrollment? | **Yes**, the anchor. |
| 3 | Subject? | Yes, via `CurriculumSubject`, when period-wise. |
| 4 | Lecture? | Via timetable period. Requires the missing timetable module. |
| 5 | Daily? | **Yes** — the school default. One record per enrollment per day. |
| 6 | Period-wise? | **Yes** — the college default. Configurable per program, not per branch. |
| 7 | RFID? | Ingestion source. Phase 2. |
| 8 | Face Recognition? | Ingestion source. Phase 3, and **check DPDP first** — biometric data of minors is the most sensitive category you could choose to collect. Make it opt-in with explicit parental consent. |
| 9 | Biometric? | Same as above, same caution. |
| 10 | GPS? | Only for transport (bus boarding), not classroom attendance. |
| 11 | Parent notification? | **Yes**, on absence, same day, via your existing communication module. This is the single most-valued feature by parents in Indian school ERPs. |
| 12 | Short attendance? | **Computed**, not stored — from working days in the academic calendar (§10 Q19). Snapshot it at term lock for audit. |
| 13 | Attendance correction? | Allowed within a configurable window, with reason, audited. Locked after. |
| 14 | Attendance lock? | **Yes**, per period/month, and implied by academic-year lock. |
| 15 | Attendance audit? | Every correction recorded with before/after, actor, and reason. |

---

## SECTION 13 — Examination (20)

**The governing decision:** this is where board differences actually live
(§1 Q8's promise of "no hardcoded board rules" is cashed here, or nowhere).
A mark record is `Enrollment × CurriculumSubject × ExamComponent`. Everything
above it — grades, GPA, pass/fail, rank — is **derived by a configured
ruleset**, never stored as the source of truth.

**Second decision:** marks are append-only. Revaluation writes a new record
superseding the old. Overwriting a mark destroys the evidence that a
revaluation occurred, which is precisely what gets disputed.

| # | Question | Decision |
| :--- | :--- | :--- |
| 1 | Marks? | Anchor record, per component, append-only. |
| 2 | Grades? | Derived from a configurable grade scale per board/program. |
| 3 | GPA? | Derived per term from credits × grade points. |
| 4 | CGPA? | Derived cumulatively across enrollments. |
| 5 | Practical? | An `ExamComponent` type, with its own max marks and pass criteria. |
| 6 | Viva? | An `ExamComponent` type. |
| 7 | Internal? | `ExamComponent` with `assessmentType = INTERNAL`. |
| 8 | External? | `assessmentType = EXTERNAL`. Separate entry permissions and separate lock. |
| 9 | Revaluation? | New mark record + `revaluationOf`. Fee-linked. Never an overwrite. |
| 10 | Improvement? | New attempt record on the same curriculum subject; best-of rule is configurable. |
| 11 | Grace marks? | Explicit, rule-driven, **separately visible** on the record. Never silently folded into the raw mark. |
| 12 | Rank? | Computed on demand within a configurable scope. Consider making it suppressible — several boards and states restrict publishing ranks. |
| 13 | Transcript? | A generated document over the enrollment history. Snapshot and store the issued PDF; do not re-derive a previously issued transcript. |
| 14 | Certificates? | Template-driven: TC, bonafide, character, migration. TC is issued against the **Admission** (§5), which is why that layer exists. |
| 15 | Promotion? | Consumes §10 Q20's rules; produces the next year's Enrollment (§6 Q8). |
| 16 | Supplementary? | New attempt, own exam schedule, own fee. |
| 17 | Backlog? | Derived: any curriculum subject not yet passed. Not a stored flag. |
| 18 | Result freeze? | **Yes**, mandatory before publish. Frozen results are immutable except by audited force-correction. |
| 19 | Moderation? | Applied as a separate, visible adjustment layer with approval — same principle as grace marks. |
| 20 | Publish workflow? | `DRAFT → MODERATED → FROZEN → PUBLISHED`, with scheduled publish time and per-audience visibility (student, guardian, staff). |

---

## SECTION 14 — Identity & Authentication (15)

**The governing decision:** `User` is an **authentication** record. Student,
Guardian, and Employee are **domain** records. They are linked, never merged —
because one human is routinely more than one thing: a teacher whose child
studies at the same school needs one login and two roles.

Your schema already has `User`, `RoleType`, `Permission`, `RolePermission`, and
`UserPermissionOverride`, plus a communication module with OTP. The gap is the
**link table** and multi-role context switching.

| # | Question | Decision |
| :--- | :--- | :--- |
| 1 | User independent? | **Yes.** Add `UserIdentityLink(userId, linkedType, linkedId)` — one user, many domain identities. |
| 2 | Student login? | Yes, from a configurable minimum age/level. Junior classes typically don't get one. |
| 3 | Guardian login? | **Yes**, the highest-traffic surface in the whole product. One login, all children, all branches in the org. |
| 4 | Staff login? | Yes, branch-scoped by assignment, with cross-branch grants per §2 Q9. |
| 5 | Username? | Optional. Not the primary credential. |
| 6 | Email? | Optional for guardians (many won't have one), required for staff. |
| 7 | Mobile? | **Primary identifier for guardians and students.** Must be verified. Note that families share numbers — a mobile cannot be globally unique across users. |
| 8 | MFA? | **Mandatory** for `SUPER_ADMIN` / `ORG_ADMIN`, optional elsewhere. OTP counts. |
| 9 | Password reset? | Exists (`docs/auth-password-recovery.md`). Extend to OTP-based reset for guardians. |
| 10 | Account lock? | Progressive backoff, then lock, then admin unlock. Never lock permanently on failed attempts alone — it's a trivial denial-of-service against a known mobile number. |
| 11 | Device management? | Session list with revoke. Phase 2. Valuable when guardians share devices. |
| 12 | SSO? | Phase 3, for institutional staff (Google Workspace / Microsoft is what schools actually run). |
| 13 | OAuth? | As the SSO mechanism. Not a separate feature. |
| 14 | LDAP? | **Skip.** Effectively no Indian school runs it; larger colleges that do can use SSO. |
| 15 | Audit? | Login, logout, failed attempt, password change, MFA change, permission change, impersonation. Impersonation especially — if support can "log in as" a user, that must be loud in the audit log. |

---

## SECTION 15 — Events & Audit (20)

**The governing decision:** audit entries are **derived from domain events**,
never hand-written in each service. Your `EventBus` + `AuditListener` +
`AuditLog` is already the right architecture — your own audit report notes it
isn't consistently used (`admissions-production-audit.md` §8: masters unaudited,
successful operations unlogged). The fix is coverage and enforcement, not a new
design.

**Second decision:** three distinct streams that are often wrongly merged —
**Domain events** (integration, may be replayed), **Audit log** (who changed
what, legally significant, immutable), and **Application logs** (debugging,
short retention). Different shapes, different retention, different access
control.

| # | Question | Decision |
| :--- | :--- | :--- |
| 1 | Which events? | Every state transition, every financial movement, every permission change, every export. Not every field write. |
| 2 | Audit retention? | Tiered: financial and academic **7+ years** (statutory); security **3 years**; operational **1–2 years**, then cold archive. |
| 3 | Soft delete events? | Yes — with the actor and reason. |
| 4 | Login events? | Yes, including failures and the source IP. |
| 5 | Export events? | **Yes, critical.** Bulk export of student data is the highest-risk action in the system and the one a DPDP inquiry will ask about first. Record actor, filter, row count. |
| 6 | Print events? | Yes for certificates, TCs, receipts, and marksheets — printing is issuance. |
| 7 | Bulk update events? | Yes, as **one** event with a row count and a job id, not N events. |
| 8 | Workflow events? | Yes — already implemented for applicants; extend to Admission and Enrollment via the polymorphic `WorkflowHistory` (§5 Q20). |
| 9 | Notification events? | Delivery outcomes, already covered by `DeliveryLog`. |
| 10 | Payment events? | Yes, immutable, with gateway correlation ids. |
| 11 | Attendance events? | Corrections and locks, not every daily mark — the volume would swamp the log. |
| 12 | Result events? | Entry, moderation, freeze, publish, revaluation. |
| 13 | Student merge events? | Yes, with full before/after snapshots. Irreversible operations need reconstructable evidence. |
| 14 | Branch transfer events? | Yes — privileged, rare, mandatory reason (your own constraint). |
| 15 | Promotion events? | One job-level event plus a per-student result summary. |
| 16 | Readmission events? | Yes, linked to both admissions. |
| 17 | Document upload events? | Upload, version, verify, reject, delete. |
| 18 | Address update events? | Yes — address history already gives before/after for free. |
| 19 | Permission change events? | **Yes, highest priority.** Privilege escalation is what an attacker does first and what an auditor checks first. |
| 20 | Configuration change events? | **Yes** — and this is why configuration must be versioned (defect D6). "The refund was 80% because that's what the policy said on that date" must be provable. |

---

## Build order implied by all of this

Dependencies, not priorities. Nothing below can start before the thing above it.

1. **Configuration Engine** + **three-tier master resolution** — everything else
   assumes them.
2. **`Person` index** — unblocks identity, duplicates, siblings, readmission.
3. **`Student` + `Admission` + `Enrollment` rewrite** — the Sections 5–6 doc.
4. **Address**, **Document** — needed by admissions, reused everywhere.
5. **Subject + Curriculum + Academic Calendar** — the critical path for
   everything academic, and currently a total gap.
6. **Employee/Staff** — required before attendance marking and exam entry have
   an actor.
7. **Finance** — depends on Enrollment.
8. **Attendance** → **Examination** → **Certificates**.
