/**
 * Wire shapes for `/communication/templates`.
 *
 * Transcribed from `backend/postman/erp.postman_collection.json` (five
 * requests) and cross-checked against `docs/communication-module-ui-spec.md`,
 * which read the backend's Prisma model and controllers directly. The Postman
 * response examples are all the schema-generator's "Too many levels of
 * nesting to fake this schema" placeholder — the **field names** it emits are
 * still authoritative (they come from the real DTO), but no example carries a
 * real value or proves a field's optionality, so every response field below is
 * optional except `id`, which every read and write keys off.
 *
 * Three facts shape this module:
 *
 * 1. **`variables` has no single documented shape.** The create/update sample
 *    sends a `string[]` of placeholder names; the spec notes the backend model
 *    also allows a `Record<string, unknown>` or `null`. Both are typed.
 * 2. **Scope is two nullable ids**, not a picker: both null is the global
 *    default, org set with branch null is tenant-wide, both set is
 *    branch-specific. This module never asks a user to choose a scope level —
 *    new templates take the active workspace's org/branch, and editing a
 *    template preserves whatever scope it already has.
 * 3. **The PATCH body is documented identically to the POST body** — the
 *    Postman collection gives both requests the same thirteen fields, so an
 *    edit resends the complete record rather than a partial one.
 */

/** The five documented channels. */
export const COMMUNICATION_CHANNELS = [
  "EMAIL",
  "SMS",
  "WHATSAPP",
  "PUSH",
  "IN_APP",
] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

/** The six documented notification/template categories. */
export const NOTIFICATION_CATEGORIES = [
  "AUTHENTICATION",
  "ACADEMIC",
  "ADMISSIONS",
  "FEES",
  "ANNOUNCEMENT",
  "SYSTEM",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** The three documented lifecycle states. */
export const TEMPLATE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

/**
 * A message template as read back.
 *
 * `organizationId`/`branchId` are both nullable and independent — see the
 * scope semantics above. Every field past `id` is optional: no response body
 * is documented for any of the five endpoints, only the field *names* the
 * Postman schema generator emitted.
 */
export interface TemplateDto {
  id: string;
  organizationId?: string | null;
  branchId?: string | null;
  code?: string;
  name?: string;
  description?: string | null;
  channel?: CommunicationChannel;
  category?: NotificationCategory;
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  /** No single documented shape — see the module doc comment above. */
  variables?: string[] | Record<string, unknown> | null;
  language?: string;
  version?: number;
  status?: TemplateStatus;
  isDefault?: boolean | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Body for `POST /communication/templates` and `PATCH /communication/templates/:id`
 * — the thirteen fields the Postman collection documents for both.
 */
export interface TemplateWriteRequest {
  code: string;
  name: string;
  description: string | null;
  channel: CommunicationChannel;
  category: NotificationCategory;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  variables: string[];
  language: string;
  version: number;
  status: TemplateStatus;
  organizationId: string | null;
  branchId: string | null;
}

/** Documented list filters for `GET /communication/templates`. */
export interface TemplateListQuery {
  channel?: CommunicationChannel;
  status?: TemplateStatus;
  search?: string;
}

/**
 * Body for `POST /communication/templates/preview`.
 *
 * The endpoint identifies the template **either** by `templateId` **or** by
 * `code` (with `channel` supplied as the documented query parameter) —
 * supplying neither is rejected with `409`.
 */
export interface TemplatePreviewRequest {
  variables: Record<string, unknown>;
  templateId?: string;
  code?: string;
}

/**
 * Response of `POST /communication/templates/preview`.
 *
 * Not every channel renders every field — a channel with no `bodyHtml`
 * (SMS, WhatsApp, IN_APP) simply omits it, which is why all three body
 * fields are optional here rather than the record's own optionality being
 * re-guessed.
 */
export interface TemplatePreviewResponse {
  missingVariables?: string[];
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
}
