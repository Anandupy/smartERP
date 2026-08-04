/**
 * Wire shapes for `/academic-units`.
 *
 * Transcribed from `backend/docs/modules/academic-unit.md` and the Postman
 * collection.
 *
 * - The **module doc** supplies the architecture, the hierarchy examples, four
 *   validation rules, the `level` field's semantics, and the `metadata`
 *   escape hatch. It has **no Data Structure table** and **no endpoint list**.
 * - The **Postman collection** is the contract for both requests and the
 *   endpoint set: ten fields in the create and update bodies, one field in the
 *   move body, and eight endpoints.
 *
 * Three facts shape the module:
 *
 * 1. **No response body is documented** for any of the eight endpoints — every
 *    Postman `body` is `""`.
 * 2. **`unitType` has no value set.** The doc gives six values across two
 *    examples (`CLASS`, `DIVISION`, `DEPARTMENT`, `YEAR`, `BATCH`) plus
 *    `SECTION` from the Postman sample, and then explicitly says: "AcademicUnitType
 *    serves mainly as UI tags. Always depend on tree structure and node
 *    references rather than hardcoding logic targeting a specific level." So
 *    the examples are offered as suggestions, the field accepts anything, and
 *    **no behaviour in this module branches on the value**.
 * 3. **`level` is server-computed and must never be sent.** The doc is explicit:
 *    "auto-calculated starting at 0 for roots… maintained across moves
 *    dynamically… Do not update manually." It is absent from every request body
 *    in the collection, and it is absent from this module's request types.
 */

/**
 * An academic unit as read back.
 *
 * `id` is documented by `GET /academic-units/:id`, which — unlike Academic
 * Year — this module does have.
 *
 * `level` is read-only and optional: the doc describes it, no response body
 * promises it, and nothing may write it.
 *
 * `isActive` is optional for the reason every other module's is: no response
 * body is documented, so an absent flag means "not reported" and never `false`.
 * Note that unlike Program and Branch, `isActive` **is** in the request body
 * here — so it can be set directly as well as toggled.
 */
export interface AcademicUnitDto {
  id: string;
  branchId: string;
  /** The owning program. Documented required in both request bodies. */
  programId: string;
  /** The academic year this structure belongs to. Required in both bodies. */
  academicYearId: string;
  /** The parent unit. `null` for a root of the program's structure. */
  parentId?: string | null;
  name: string;
  code?: string | null;
  /**
   * A UI tag, per the documentation's own instruction. Typed as a plain string
   * rather than a union: the doc names six values across examples and then
   * warns against hardcoding logic for any of them.
   */
  unitType?: string | null;
  /** Documented sibling ordering. Sample: `1`. */
  displayOrder?: number | null;
  isActive?: boolean | null;
  /**
   * Free-form JSON, documented as the extensibility escape hatch for "room
   * capacities, minimum students, lab requirements, custom shift timings".
   *
   * `unknown` rather than a guessed interface: the doc names example uses and
   * no schema, so this module renders it and round-trips it without
   * interpreting any key.
   */
  metadata?: Record<string, unknown> | null;
  /**
   * **Server-computed.** Documented as auto-calculated, starting at 0 for
   * roots and maintained across moves. Never sent — see the request types.
   */
  level?: number | null;
  /**
   * Present only in the `GET /academic-units/tree` response, if at all.
   *
   * The tree endpoint is documented by its Postman entry alone — no response
   * body, no shape. This module therefore does not depend on it: the tree
   * screen builds its hierarchy from the flat list with the shared `buildTree`.
   */
  children?: AcademicUnitDto[] | null;
}

/**
 * Body for `POST /academic-units`, exactly as the Postman request defines it —
 * ten fields, and no others.
 *
 * `level` is deliberately absent: the documentation forbids setting it.
 */
export interface CreateAcademicUnitRequest {
  branchId: string;
  programId: string;
  academicYearId: string;
  parentId: string | null;
  name: string;
  code: string | null;
  unitType: string | null;
  displayOrder: number | null;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
}

/**
 * Body for `PATCH /academic-units/:id`.
 *
 * The Postman update request sends the identical full body as create, and the
 * doc states no partial-update rule — so an edit resends the whole record.
 *
 * Note this body carries `parentId`, and there is *also* a dedicated
 * `PATCH /:id/move`. The two overlap, and which one the backend treats as
 * authoritative for a re-parent is undocumented; this module uses `move` for
 * re-parenting and leaves `parentId` unchanged on an ordinary edit. See
 * `docs/backend-gaps.md`.
 */
export type UpdateAcademicUnitRequest = CreateAcademicUnitRequest;

/**
 * Body for `PATCH /academic-units/:id/move` — one field.
 *
 * The only lifecycle endpoint in either academic module that carries a body,
 * which makes it the only one that can name a target rather than flipping a
 * flag. `null` moves a unit to the root of its program.
 */
export interface MoveAcademicUnitRequest {
  parentId: string | null;
}

/**
 * The unit types the documentation names, offered as suggestions only.
 *
 * Five come from the two hierarchy examples and one (`SECTION`) from the
 * Postman body. They are **not** an enum: the doc explicitly says the type is a
 * UI tag and warns against hardcoding logic for a particular level, so the form
 * offers these while still accepting anything, and nothing here branches on the
 * value.
 */
export const SUGGESTED_UNIT_TYPES = [
  "DEPARTMENT",
  "CLASS",
  "YEAR",
  "DIVISION",
  "SECTION",
  "BATCH",
] as const;
