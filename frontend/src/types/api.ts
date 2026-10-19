/**
 * Transport contracts mirroring the backend response envelopes.
 *
 * The backend always returns exactly one of two shapes:
 *
 *   success → { success: true,  message, data, meta, error: null }
 *   failure → { success: false, message, data: null, meta, error: { code, details },
 *               requestId, timestamp }
 *
 * Older failures carried `code` at the top level instead of in `error`; both
 * are still read (backend/docs/core/response-contract.md §2).
 *
 * These types describe the wire format only. Concrete DTOs (`data` payloads)
 * live in feature modules — there is no business logic here.
 */

/** Pagination descriptor carried in `meta.pagination` for list endpoints. */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Envelope metadata. Open-ended, with well-known optional fields typed. */
export interface ApiMeta {
  requestId?: string;
  timestamp?: string;
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

/** Backend success envelope. */
export interface ApiResponse<TData> {
  success: true;
  message: string | null;
  data: TData;
  meta: ApiMeta | null;
  error: null;
}

/** Backend failure envelope. */
export interface ApiErrorResponse {
  success: false;
  message: string;
  /** The machine code and whatever structured detail the failure carries. */
  error?: {
    code?: string;
    details?: Record<string, unknown> | null;
  } | null;
  /** The pre-contract position of the code. */
  code?: string;
  requestId?: string;
  timestamp?: string;
}

/** Either envelope, discriminated by `success`. */
export type ApiEnvelope<TData> = ApiResponse<TData> | ApiErrorResponse;

/** Query params common to list endpoints. */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
}

/**
 * Discriminated categories a raw transport error is normalized into, so UI can
 * branch on `kind` instead of sniffing status codes everywhere.
 */
export type ApiErrorKind =
  | "network"
  | "timeout"
  | "canceled"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "validation"
  | "conflict"
  | "rateLimit"
  | "server"
  | "unknown";

/** Field-level validation issues surfaced from a failed request. */
export interface FieldError {
  field: string;
  message: string;
}

/** The normalized error every consumer of the API client can rely on. */
export interface NormalizedApiError {
  kind: ApiErrorKind;
  status: number | null;
  message: string;
  /** Machine-readable code from the failure envelope (e.g. "AUTH_EXPIRED"). */
  code?: string;
  requestId?: string;
  timestamp?: string;
  fieldErrors?: FieldError[];
  /** The untouched original error, for logging/debugging only. */
  cause?: unknown;
}

/** Runtime guard: does an unknown body look like the failure envelope? */
export function isApiErrorResponse(body: unknown): body is ApiErrorResponse {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as Record<string, unknown>).success === false &&
    typeof (body as Record<string, unknown>).message === "string"
  );
}

/** Runtime guard: does an unknown body look like the success envelope? */
export function isApiResponse<TData = unknown>(
  body: unknown,
): body is ApiResponse<TData> {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as Record<string, unknown>).success === true &&
    "data" in (body as Record<string, unknown>)
  );
}
