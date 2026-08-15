/**
 * Wire shapes for `/communication/delivery-logs`.
 *
 * The query side is fully documented by the Postman collection (ten
 * parameters, all named). The response side is the schema generator's
 * nesting-error placeholder, so field names below come from
 * `docs/communication-module-ui-spec.md` (§4.3, read from the Prisma model)
 * rather than a Postman example — every field past `id` is optional.
 *
 * **No detail endpoint exists.** The spec's endpoint inventory (§2C) lists
 * only the query and analytics routes; a delivery log's detail view is built
 * entirely from the row the list already returned, never a second fetch.
 *
 * `templateId` is documented as a loose reference with no foreign key, so the
 * UI must not assume the template it names still exists.
 */

/** The nine documented delivery states. */
export const DELIVERY_STATUSES = [
  "PENDING",
  "QUEUED",
  "SENT",
  "DELIVERED",
  "OPENED",
  "CLICKED",
  "FAILED",
  "BOUNCED",
  "RETRIED",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** One delivery attempt. */
export interface DeliveryLogDto {
  id: string;
  organizationId?: string | null;
  branchId?: string | null;
  channel?: string;
  provider?: string | null;
  recipient?: string;
  sender?: string | null;
  subject?: string | null;
  /** Loose reference — no foreign key. The named template may no longer exist. */
  templateId?: string | null;
  templateVersion?: number | null;
  status?: DeliveryStatus | string;
  latencyMs?: number | null;
  retryCount?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  openedAt?: string | null;
  clickedAt?: string | null;
  deliveredAt?: string | null;
  sentAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Every documented query parameter for `GET /communication/delivery-logs`. */
export interface DeliveryLogQuery {
  page?: number;
  limit?: number;
  channel?: string;
  status?: string;
  provider?: string;
  recipient?: string;
  /** ISO date strings. */
  startDate?: string;
  endDate?: string;
  organizationId?: string;
  branchId?: string;
}

/**
 * Pagination as this endpoint reports it — **flat on the envelope's `meta`**
 * (`total`, `page`, `limit`, `totalPages`), confirmed by the Postman response
 * example. This is neither of the platform's other two conventions
 * (`meta.pagination`, or `{ items, meta }` nested in `data`): it is its own
 * third shape, so it is read here rather than assumed.
 */
export interface DeliveryLogPageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const DELIVERY_LOG_PAGE_SIZE_DEFAULT = 25;
export const DELIVERY_LOG_PAGE_SIZE_MAX = 100;
