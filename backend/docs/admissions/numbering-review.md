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
