/**
 * Wire shapes for `/audit-logs`.
 *
 * The query side of this contract is the best-documented in the milestone: the
 * Audit Log Query API section names every pagination, sorting and filter
 * parameter, and the Postman request lists them again. The **response** side is
 * documented only as the `AuditLog` table, and the two do not entirely agree —
 * a difference this file records rather than resolves:
 *
 * - `severity`, `status`, `executionTime`, `traceId`, `correlationId`,
 *   `httpMethod` and `route` are **filterable and sortable** but appear in no
 *   column of the documented `AuditLog` table. They are typed optional here, so
 *   the UI can show them when present without assuming they will be.
 * - The documented `sortBy` values are `timestamp | severity | module |
 *   executionTime`; the Postman sample sends `createdAt`, which is not among
 *   them. `SORTABLE_FIELDS` follows the documentation.
 * - No value set is documented for `severity` or `status`, so both are typed
 *   `string`. `action` and `module` do have documented vocabularies.
 * - `metadata` and `changes` are excluded from list rows unless
 *   `includeDetails=true`, and the detail endpoint always includes them.
 * - **The list nests its pagination inside `data`** as `{ items, meta }` — see
 *   `AuditLogPage`. This is one of the platform's two list conventions and the
 *   one this endpoint documents; reading the other produces an empty table.
 */

/** Documented action categories. */
export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "EXECUTE",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Documented functional modules that publish audited events. */
export const AUDIT_MODULES = [
  "ADMISSIONS",
  "AUTHORIZATION",
  "WORKSPACE",
  "ORGANIZATION",
  "AUTH",
  "ACADEMIC",
  "SYSTEM",
] as const;

export type AuditModule = (typeof AUDIT_MODULES)[number];

/** Documented `sortBy` values. Note that `createdAt` is **not** one of them. */
export const AUDIT_SORT_FIELDS = [
  "timestamp",
  "severity",
  "module",
  "executionTime",
] as const;

export type AuditSortField = (typeof AUDIT_SORT_FIELDS)[number];

/** Documented field-level diff entry inside `changes`. */
export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/** One audit record. */
export interface AuditLogDto {
  id: string;
  timestamp: string;
  eventName: string;
  /** Documented as a `String`; the known categories are in `AUDIT_ACTIONS`. */
  action: string;
  /** Documented as a `String`; the known modules are in `AUDIT_MODULES`. */
  module: string;
  aggregateType: string;
  aggregateId: string;
  userId?: string | null;
  userEmail?: string | null;
  role?: string | null;
  organizationId?: string | null;
  branchId?: string | null;
  academicYearId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;

  /** Present only when `includeDetails=true`, or on the detail endpoint. */
  metadata?: Record<string, unknown> | null;
  changes?: AuditChange[] | null;

  /**
   * Filterable and sortable per the query API, but absent from the documented
   * `AuditLog` table — so optional, and rendered only when supplied.
   */
  severity?: string | null;
  status?: string | null;
  executionTime?: number | null;
  traceId?: string | null;
  correlationId?: string | null;
  httpMethod?: string | null;
  route?: string | null;
}

/**
 * Every documented query parameter for `GET /audit-logs`, and for the summary
 * and timeline endpoints, which the documentation states accept the same set.
 */
export interface AuditLogQuery {
  page?: number;
  /** Documented default 50, maximum 100. */
  limit?: number;
  sortBy?: AuditSortField;
  sortOrder?: "asc" | "desc";
  search?: string;

  userId?: string;
  role?: string;
  module?: string;
  aggregateType?: string;
  aggregateId?: string;
  action?: string;
  severity?: string;
  status?: string;
  organizationId?: string;
  branchId?: string;
  academicYearId?: string;
  requestId?: string;
  traceId?: string;
  correlationId?: string;
  httpMethod?: string;
  route?: string;

  /** ISO date strings. */
  startDate?: string;
  endDate?: string;

  minExecutionTime?: number;
  maxExecutionTime?: number;

  /** Documented default `false`; excludes `metadata` and `changes` when unset. */
  includeDetails?: boolean;
}

/**
 * Pagination as this endpoint reports it — **inside `data`**, not on the
 * envelope's `meta`.
 *
 * The platform has two list conventions and each endpoint documents which one
 * it uses. `/audit-logs` is documented with `ApiPaginatedItemsEnvelope`: the
 * payload is `{ items, meta }` and `meta.pagination` is never populated. Note
 * the page size is named `limit` here, matching the query parameter, where the
 * envelope convention names it `pageSize`.
 */
export interface AuditPageMeta {
  total: number;
  page: number;
  /** Records per page. The envelope convention calls this `pageSize`. */
  limit: number;
  totalPages: number;
}

/** The payload of `GET /audit-logs`: one page and its pagination. */
export interface AuditLogPage {
  items: AuditLogDto[];
  meta: AuditPageMeta;
}

/** Documented pagination defaults, so the UI and the backend start in step. */
export const AUDIT_PAGE_SIZE_DEFAULT = 50;
export const AUDIT_PAGE_SIZE_MAX = 100;
