/**
 * Wire shapes for `/branches`.
 *
 * Transcribed from **two** backend documents plus the Postman collection.
 * Which one said what matters, because neither is complete alone:
 *
 * - `backend/docs/modules/branch.md` documents the three enums
 *   (`institutionType`, `affiliationType`, `structureMode`),
 *   `registrationNumber`, and the request-context pipeline. It has **no Data
 *   Structure table** and its endpoint list omits two endpoints.
 * - `backend/docs/modules/branch-settings.md` — despite the filename, this is a
 *   second document titled "Branch Module" describing the same entity. It
 *   supplies the Data Structure (including `isActive` and `isDeleted`), the
 *   full seven-endpoint list, and the role matrix.
 * - The **Postman collection** is the contract for requests: seventeen fields
 *   in both the create and update bodies.
 *
 * Every field below appears in one of those. Nothing is inferred, and the
 * doc-to-doc mismatch is reported in `docs/backend-gaps.md` rather than
 * resolved by picking a favourite.
 *
 * Two facts shape the module:
 *
 * 1. **No response body is documented** for any of the seven endpoints — every
 *    Postman `body` is `""`. The read shape is the documented Data Structure
 *    plus the request fields.
 * 2. **Status is a pair of booleans, not an enum.** `isActive` and `isDeleted`
 *    are documented fields; neither is in a request body. `isActive` is changed
 *    only through `PATCH /branches/:id/status`, and `isDeleted` only through
 *    the documented soft delete.
 */

/** Documented institution types. */
export const INSTITUTION_TYPES = [
  "SCHOOL",
  "JUNIOR_COLLEGE",
  "DEGREE_COLLEGE",
  "UNIVERSITY",
  "ENGINEERING",
  "MEDICAL",
  "OTHER",
] as const;

export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

/** Documented affiliation types. */
export const AFFILIATION_TYPES = ["BOARD", "UNIVERSITY", "OTHER"] as const;

export type AffiliationType = (typeof AFFILIATION_TYPES)[number];

/**
 * Documented structure modes.
 *
 * `DEFAULT` is the ERP's standard organizational structure; `CUSTOM` allows
 * programs, batches and sections to be defined manually by the Program module.
 */
export const STRUCTURE_MODES = ["DEFAULT", "CUSTOM"] as const;

export type StructureMode = (typeof STRUCTURE_MODES)[number];

/**
 * A branch as read back.
 *
 * `id` is not in either Data Structure, but `GET/PATCH/DELETE /branches/:id`
 * all take one — the only field inferred from an endpoint rather than a table,
 * and inferred from the contract itself rather than guessed.
 *
 * `isActive` and `isDeleted` are documented fields but are **optional here**,
 * because no response body is documented and so it cannot be assumed they are
 * returned. Every consumer treats an absent flag as unknown rather than false.
 */
export interface BranchDto {
  id: string;
  organizationId: string;
  name: string;
  /** Documented as a unique, slug-safe lowercase string. */
  code: string;
  /** Documented as unique across the system **if provided**. */
  registrationNumber?: string | null;
  institutionType?: InstitutionType | null;
  affiliationType?: AffiliationType | null;
  affiliationName?: string | null;
  logoUrl?: string | null;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
  structureMode?: StructureMode | null;
  /** Server-managed. Changed only via `PATCH /branches/:id/status`. */
  isActive?: boolean | null;
  /** Server-managed. Set by the documented soft delete. */
  isDeleted?: boolean | null;
}

/**
 * Body for `POST /branches`, exactly as the Postman request defines it —
 * seventeen fields, and no others. `isActive` and `isDeleted` are deliberately
 * absent: they are documented fields of the entity and of neither request.
 */
export interface CreateBranchRequest {
  organizationId: string;
  name: string;
  code: string;
  registrationNumber: string | null;
  institutionType: InstitutionType;
  affiliationType: AffiliationType | null;
  affiliationName: string | null;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
  structureMode: StructureMode;
}

/**
 * Body for `PATCH /branches/:id`.
 *
 * The Postman update request sends the identical full body as create, and
 * neither document states a partial-update rule — so an edit resends the whole
 * record. The same reasoning as System Settings, Maintenance and Organization.
 */
export type UpdateBranchRequest = CreateBranchRequest;
