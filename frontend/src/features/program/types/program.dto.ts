/**
 * Wire shapes for `/programs`.
 *
 * Transcribed from `backend/docs/modules/program.md` and the Postman
 * collection. Which source said what matters, because the two **do not agree**:
 *
 * - The **module doc** supplies the concept, the optional parent-child
 *   hierarchy, the seven-endpoint table with its access column, and four
 *   validation rules. It has **no Data Structure table**.
 * - The **Postman collection** is the contract for requests: six fields in both
 *   the create and update bodies — including `level`, which the module doc
 *   never mentions.
 *
 * The mismatch is recorded in `docs/backend-gaps.md` rather than resolved by
 * picking a favourite: `level` is **sent**, because Postman is the request
 * contract, and typed **optional on read**, because no data structure promises
 * it comes back.
 *
 * Two further facts shape the module:
 *
 * 1. **No response body is documented** for any of the seven endpoints — every
 *    Postman `body` is `""`. The read shape is the request fields plus the one
 *    field the endpoint list implies (`isActive`, via the status toggle).
 * 2. **The status toggle takes no request body**, so it flips `isActive`
 *    rather than setting it — the same non-idempotent shape the branch toggle
 *    has, and it is treated with the same caution.
 */

/**
 * A program as read back.
 *
 * `id` is not in any documented data structure, but `GET/PATCH/DELETE
 * /programs/:id` all take one — inferred from the contract itself rather than
 * guessed.
 *
 * `medium`, `stream` and `parentId` are optional: the doc describes the
 * hierarchy as "optional", and its uniqueness rule (rule 1) combines
 * `branchId + name + medium + stream` in a way that reads as though a program
 * may legitimately have neither a medium nor a stream — "Primary" in the doc's
 * own example carries a medium but the parent "School" carries nothing.
 *
 * `isActive` is optional for the same reason every other module's is: no
 * response body is documented, so an absent flag means "not reported" and never
 * `false`.
 */
export interface ProgramDto {
  id: string;
  branchId: string;
  name: string;
  /**
   * **Postman only.** Absent from the module doc entirely, including from its
   * uniqueness rule. The single recorded sample is `"SCHOOL"`, so no value set
   * can be offered — see `docs/backend-gaps.md`.
   */
  level?: string | null;
  /** Documented in the concept and in uniqueness rule 1. Sample: `"English"`. */
  medium?: string | null;
  /** Documented likewise. Sample: `"Science (PCM)"`. */
  stream?: string | null;
  /** The optional parent. `null` for a top-level program. */
  parentId?: string | null;
  /** Server-managed. Changed only via `PATCH /programs/:id/status`. */
  isActive?: boolean | null;
  /**
   * Present only in the `GET /programs/tree` response, if at all.
   *
   * The tree endpoint is documented by name and by nothing else — no response
   * body, no shape. This module therefore **does not depend on it**: the tree
   * screen builds its hierarchy from the flat list with the shared
   * `buildTree`, and this field exists only so a nested payload is not a type
   * error if one arrives.
   */
  children?: ProgramDto[] | null;
}

/**
 * Body for `POST /programs`, exactly as the Postman request defines it — six
 * fields, and no others.
 *
 * `isActive` is deliberately absent: it is implied by the status toggle
 * endpoint and is in neither request body.
 */
export interface CreateProgramRequest {
  branchId: string;
  name: string;
  level: string | null;
  medium: string | null;
  stream: string | null;
  parentId: string | null;
}

/**
 * Body for `PATCH /programs/:id`.
 *
 * The Postman update request sends the identical full body as create, and the
 * doc states no partial-update rule — so an edit resends the whole record. The
 * same reasoning Organization, Branch, Academic Year, System Settings and
 * Maintenance follow.
 */
export type UpdateProgramRequest = CreateProgramRequest;
