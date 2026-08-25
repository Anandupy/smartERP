# CampusFlow ERP – Admissions Numbering Review
**Document ID:** `numbering-review.md`  
**Status:** Completed Audit (Phase 1)

---

## 1. Number Generation Process Flow

The current implementation in [NumberingService](file:///d:/ERP/backend/src/modules/admissions/numbering/numbering.service.ts) generates sequences through these steps:

1.  **Retrieve Configuration:** Loads configuration parameters for a branch and purpose (e.g. `ADMISSION_FORM`).
2.  **Locate Counter:** Queries the database for the active counter for that configuration and academic year. If none exists, it attempts to insert a starting counter.
3.  **Atomic Increment:** Performs a raw PostgreSQL update to increment the counter:
    ```sql
    UPDATE "NumberSequenceCounter"
    SET "currentValue" = "currentValue" + 1
    WHERE "id" = $1
    RETURNING "currentValue"
    ```
4.  **Format Mapping:** Hydrates placeholders (`{prefix}`, `{year}`, `{branchCode}`, `{sequence}`) to compile the final identifier string (e.g., `ADM-2026-0001`).

---

## 2. Technical Limitations & Gaps Analysis

### A. Concurrency Races in Counter Initialization
*   **Problem:** If two concurrent transactions attempt to write a counter for a new configuration, they will execute the check simultaneously, both will read "no counter exists", and both will execute `create` queries. One transaction will succeed, while the other will crash with a unique key index violation.
*   **Code Review:** `numbering.service.ts` uses a try-catch block to handle this specific case:
    ```typescript
    if (!counter) {
      try {
        counter = await client.numberSequenceCounter.create({ ... });
      } catch (err) {
        counter = await client.numberSequenceCounter.findFirst({ ... });
      }
    }
    ```
    This is an acceptable retry fallback, but using database-level `upsert` or locking is cleaner.

### B. Number Allocation Transaction Boundaries (Rollback Gaps)
*   **Problem:** Increments are triggered inside `ApplicantService.create` before executing the actual applicant record insert. However, this is not wrapped in a database transaction block.
*   **Implication:** If applicant validation fails or database insertion crashes, the counter record remains incremented. This results in gaps in sequence numbering (e.g., `ADM-2026-0001` followed by `ADM-2026-0003` because number `0002` failed to save).
*   **Gapless Sequence Support:** Gapless sequences are mandatory in finance and auditing.
*   **Mitigation Plan (Phase 2):** To achieve gapless numbering:
    1.  Wrap both numbering incrementation and applicant insertion in a single Prisma transaction.
    2.  Execute sequence generation at the end of the transaction to reduce row-lock contention.

### C. Concurrency Locks & Performance
*   **Problem:** Wrapping numbering sequence updates in the main applicant transaction holds a row-lock on `"NumberSequenceCounter"` from the moment `generateNextNumber` is called until the transaction commits.
*   **Implication:** If the database transaction is slow, concurrent registration requests for the same branch and purpose will block, waiting for the row lock. This limits write throughput for a single branch.
*   **Recommendation:** Use optimistic locks or pre-allocate sequence numbers in batches for non-financial documents (e.g., draft form numbers) to avoid database bottlenecks during high-volume periods.

---

## 3. Phase 2 — `NUMBERING_NOT_PROVISIONED` incident (2026-08-25)

This section postdates §1–2 and describes the current engine (the F3 rewrite —
`src/infrastructure/numbering/`, `docs/planning/00-foundation/03-numbering.md`),
not the legacy `src/modules/admissions/numbering/` code §1–2 audited.

### Symptom

`POST /v1/admissions/applicants/:id/admit` returned `NUMBERING_NOT_PROVISIONED`
for organization "Global Education Trust" (`e99f096e-6cb7-4672-acf7-79a3956f15d6`),
branch "Main Campus".

### Investigation

`AdmissionConversionService.assertNumberingProvisioned()`, the numbering engine
(`NumberingService`, `NumberSequenceConfig`/`Counter` schema), and the
provisioning API (`POST /v1/numbering/configs`) were all read against
`docs/planning/00-foundation/03-numbering.md` and their own integration/unit
test suites. All three match the design: scope, allocation mode and reset
strategy are derived from `SequencePurpose` and are not caller-configurable;
the counter allocation statement is the single-`UPSERT` form the design
requires; the pre-flight check queries the same `(deletedAt: null, isActive:
true)` predicate the allocator itself uses, so a config that would fail inside
the transaction is refused before it opens. **No backend defect was found.**

Querying the dev database directly (`NumberSequenceConfig` for this
organization) showed the actual cause:

| Purpose | Present? | Note |
| :--- | :--- | :--- |
| `ADMISSION_FORM` | Yes | created 2026-07-23 |
| `APPLICATION` | Yes | created 2026-07-23 |
| `STUDENT_CODE` | Yes, but malformed | created 2026-08-22 with `prefix: null`, `sequencePadding: 6` — not the `STU` + 10-digit standard every other organization in this codebase's own test fixtures uses |
| `ADMISSION_NO` | **Missing entirely** | never provisioned |

`assertNumberingProvisioned()` requires both `STUDENT_CODE` and `ADMISSION_NO`
to exist, active, for the calling organization/branch. With `ADMISSION_NO`
absent, it correctly refused the admission before opening a transaction —
this is the check working as designed, not failing.

Root cause: **tenant provisioning gap**, not a code defect. Workspace bootstrap
(`WorkspaceSetupService`, `SETUP_RESOURCES`) deliberately does not include
numbering configuration among the mandatory setup resources — by design, per
its own comment, mandatory setup is `SYSTEM_SETTINGS` → `ORGANIZATION` →
`BRANCH` → `ACADEMIC_YEAR` only. Numbering sequences are provisioned
separately, by an `ORG_ADMIN`, via `POST /v1/numbering/configs`, and for this
organization that step was only ever done partially.

### Decision

Do not alter `admit()`, `assertNumberingProvisioned()`, or the numbering
engine — none is defective, and inventing a fallback inside `admit()` would
reproduce exactly the failure mode the F3 rewrite removed (`ApplicantService
.ensureNumberConfig`, §7 of `03-numbering.md`). Provision the missing
configuration through the existing, designed API instead.

### Remediation applied (data, not code)

Against the dev database, via the real `NumberingService`:

1. `ADMISSION_NO` provisioned for branch "Main Campus": `prefix: 'AD'`,
   `sequencePadding: 5`, `format: '{prefix}-{year}-{sequence}'` — the same
   shape this codebase's own integration test fixtures use.
2. `STUDENT_CODE` corrected via `updateConfig` — `prefix: null` → `'STU'`,
   `sequencePadding: 6` → `10` — while safe to do (zero students existed yet
   for this organization, so the sequence had not allocated and the width was
   not yet frozen by `SEQUENCE_WIDTH_IMMUTABLE`).

Both are now active and render correctly (`STU0000000001`,
`AD-<year>-00001`). No source file changed for this part of the
investigation.

### Deferred / carried forward

- **Tenant onboarding still has no automated numbering provisioning step.**
  Every new organization will hit this exact symptom until an admin manually
  calls `POST /v1/numbering/configs` for `STUDENT_CODE`, `EMPLOYEE_CODE`, and
  each branch's `ADMISSION_NO` (and any others it uses). `03-numbering.md` §9
  already flags this as belonging to tenant onboarding (P2) and unbuilt. This
  investigation did not build it — `SETUP_RESOURCES` deliberately excludes
  domain configuration from mandatory bootstrap, and widening that scope is a
  product decision, not a defect fix, and out of scope for this pass.
- See `docs/admissions/enrollment-academic-placement-review.md` for the
  companion review of `Enrollment` → `AcademicUnit` placement, including
  capacity, which the schema does not yet support.
