/**
 * Wire shapes for `/academic-years`.
 *
 * Transcribed from `backend/docs/modules/academic-year.md` and the Postman
 * collection. Which source said what matters, so each field records it:
 *
 * - The **module doc** supplies the three state flags (`isActive`,
 *   `isSelected`, `isLocked`), the five validation rules, the auto-selection
 *   rule, and the eight-endpoint list.
 * - The **Postman collection** is the contract for requests: four fields in
 *   both the create and update bodies, and `x-branch-id` on every call.
 *
 * Nothing below is inferred. Three facts shape the module:
 *
 * 1. **No response body is documented** for any of the eight endpoints — every
 *    Postman `body` is `""`. There is also no Data Structure table; the doc
 *    describes the flags in prose under "States". So the read shape is the
 *    request fields plus those three flags, and the flags are typed optional
 *    because it cannot be assumed they are returned.
 * 2. **The three flags are independent booleans, not one status enum.** A year
 *    can be selected *and* locked at once. `academicYearState` picks one label
 *    to lead with; the detail screen reports all three separately.
 * 3. **The lifecycle is one-way.** `activate`, `lock` and `select` each name a
 *    target state, and the collection documents **no inverse** — no
 *    deactivate, no unlock, no deselect. That is a contract fact with real
 *    consequences for the UI, not an oversight to route around.
 */

/**
 * An academic year as read back.
 *
 * `id` is not in any documented data structure, but `GET/PATCH/DELETE
 * /academic-years/:id` all take one and the Postman environment carries an
 * `{{academicYearId}}` variable — inferred from the contract itself rather
 * than guessed.
 *
 * `startDate` and `endDate` are typed as strings because the only recorded
 * samples are `"2025-04-01"` and `"2026-03-31"` — plain `YYYY-MM-DD`, with no
 * time and no zone. Reads tolerate a full ISO timestamp; see the mapper.
 *
 * The three flags are **optional**: they are documented fields of the entity,
 * but no response body is documented, so an absent flag means "not reported"
 * and never `false`. Reading an absent `isActive` as `false` would show a
 * working academic year as unavailable for data entry.
 */
export interface AcademicYearDto {
  id: string;
  /** Documented request field. Every year belongs to exactly one branch. */
  branchId: string;
  name: string;
  /** Documented `YYYY-MM-DD`. Must precede `endDate` — validation rule 1. */
  startDate: string;
  endDate: string;
  /** "Valid and available for data entry." Set by `PATCH /:id/activate`. */
  isActive?: boolean | null;
  /** "The current working year for the system." One per branch — rule 3. */
  isSelected?: boolean | null;
  /** "Prevents further modification or deletion." Set by `PATCH /:id/lock`. */
  isLocked?: boolean | null;
  /**
   * Record metadata — `AcademicYearDto` in the OpenAPI document
   * (`frontend-contract-answers.md` §4, G5/G16). Lists exclude soft-deleted
   * years, so `isDeleted` is false on everything a list returns.
   */
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** User id, or null. Not a name. */
  createdBy?: string | null;
  updatedBy?: string | null;
}

/**
 * Body for `POST /academic-years`, exactly as the Postman request defines it —
 * four fields, and no others.
 *
 * The three state flags are deliberately absent: they are documented fields of
 * the entity and of neither request body. `isActive` and `isSelected` are set
 * by the backend's own auto-selection rule on the first year of a branch, and
 * thereafter only by the dedicated lifecycle endpoints.
 */
export interface CreateAcademicYearRequest {
  name: string;
  startDate: string;
  endDate: string;
  branchId: string;
}

/**
 * Body for `PATCH /academic-years/:id`.
 *
 * The Postman update request sends the identical full body as create, and the
 * documentation states no partial-update rule — so an edit resends the whole
 * record. The same reasoning Organization, Branch, System Settings and
 * Maintenance follow.
 *
 * `branchId` is included because the recorded body includes it. Moving a year
 * between branches is not offered in the UI: the documentation scopes overlap
 * validation and single-selection *per branch*, and says nothing about what
 * happens to the attendance, marks, fees and admissions records that rule 2 of
 * the architecture section describes as linked to an `academicYearId`.
 */
export type UpdateAcademicYearRequest = CreateAcademicYearRequest;

/**
 * The lifecycle transitions the backend documents, as endpoint path segments.
 *
 * Each **names a target state** rather than flipping a flag, which is the
 * difference from the branch status toggle: `PATCH /:id/activate` is
 * idempotent, so it is safe to confirm and fire. What none of them has is an
 * inverse — see the module's lifecycle model.
 */
export const ACADEMIC_YEAR_TRANSITIONS = [
  "activate",
  "select",
  "lock",
] as const;

export type AcademicYearTransition = (typeof ACADEMIC_YEAR_TRANSITIONS)[number];
