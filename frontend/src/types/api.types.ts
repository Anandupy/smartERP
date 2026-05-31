// ============================================================
// API Types — Mirrors the backend GlobalResponseInterceptor
// All API responses conform to this envelope.
// ============================================================

/**
 * Standard API response envelope from the backend.
 * Every response from /v1/* follows this shape.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  meta: ApiMeta;
  error: ApiError | null;
}

/**
 * Pagination metadata returned in list responses.
 */
export interface ApiMeta {
  requestId?: string;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

/**
 * Error shape returned when success is false.
 */
export interface ApiError {
  code: string;
  details?: unknown;
}

/**
 * Normalized error thrown by the API client.
 * Consumers catch this type from hooks.
 */
export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code: string,
    requestId?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

/**
 * Paginated list response — used by list endpoints.
 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Common query parameters for list endpoints.
 */
export interface ListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
