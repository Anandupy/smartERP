/**
 * Wire shapes for `/organizations`.
 *
 * Transcribed from `backend/docs/modules/organization-settings.md` (titled
 * "Organization Module" — it documents the organization entity, not a separate
 * settings resource) and the Postman collection's request bodies. **Nothing
 * here is inferred.**
 *
 * Documented endpoints:
 *   POST   /organizations       → create
 *   GET    /organizations       → "List all **active** organizations"
 *   GET    /organizations/:id   → one organization
 *   PATCH  /organizations/:id   → update
 *   DELETE /organizations/:id   → deactivate (soft delete → `INACTIVE`)
 *
 * Three things shape everything downstream, and each is a documented fact
 * rather than a reading of one:
 *
 * 1. **No response body is recorded for any of the five endpoints** — every
 *    Postman `body` is `""`. The read shape below is the documented Data
 *    Structure; anything absent from that table is absent here too.
 * 2. **`status` is a documented field but is not in the request body.** It is
 *    server-managed: nothing in the contract lets a client set or change it,
 *    which is why there is no status control anywhere in this module.
 * 3. **`DELETE` is a soft delete.** The documentation is explicit that an
 *    organization is marked `INACTIVE` rather than removed.
 */

/** Documented status values. There is no `DRAFT`, `EXPIRED` or `DELETED`. */
export const ORGANIZATION_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
] as const;

export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

/**
 * An organization as read back.
 *
 * `id` is not in the documented Data Structure, but `GET/PATCH/DELETE
 * /organizations/:id` all take one, so a record demonstrably has an id — that
 * is the only field here inferred from an endpoint rather than the table, and
 * it is inferred from the contract itself rather than guessed.
 *
 * `logoUrl` is documented optional; `addressLine2` is optional because the
 * table lists the address as "Line1, Line2, …" without marking either
 * required, and a one-line address is ordinary. Everything else the table
 * lists is required.
 */
export interface OrganizationDto {
  id: string;
  name: string;
  /** Documented as a unique, slug-safe lowercase string. */
  code: string;
  logoUrl?: string | null;
  contactEmail: string;
  contactPhone: string;
  /**
   * Documented as `DateTime`; the Postman sample sends a date-only
   * `"2030-12-31"`. Requests follow the sample — see the mapper.
   */
  masterExpiryDate: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
  timezone: string;
  currency: string;
  /** Server-managed. Never sent by this client. */
  status?: OrganizationStatus | null;
}

/**
 * Body for `POST /organizations`, exactly as the Postman request defines it —
 * fourteen fields, in that order, and no others. `status` is deliberately
 * absent: it is not part of the documented request.
 */
export interface CreateOrganizationRequest {
  name: string;
  code: string;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  masterExpiryDate: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
  timezone: string;
  currency: string;
}

/**
 * Body for `PATCH /organizations/:id`.
 *
 * The Postman update request sends the identical full body as create, and the
 * documentation states no partial-update rule — so an edit resends the whole
 * record rather than assuming a subset is accepted. Same reasoning as System
 * Settings and Maintenance.
 */
export type UpdateOrganizationRequest = CreateOrganizationRequest;
