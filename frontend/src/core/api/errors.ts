import axios, { type AxiosError } from "axios";

import { HTTP_STATUS } from "@/constants";
import {
  isApiErrorResponse,
  type ApiErrorKind,
  type FieldError,
  type NormalizedApiError,
} from "@/types/api";

/**
 * Typed error thrown by the API client after normalization. Consumers catch
 * `ApiError` and branch on `.kind` rather than inspecting raw Axios errors.
 */
export class ApiError extends Error implements NormalizedApiError {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code?: string;
  readonly requestId?: string;
  readonly timestamp?: string;
  readonly fieldErrors?: FieldError[];
  readonly cause?: unknown;

  constructor(normalized: NormalizedApiError) {
    super(normalized.message);
    this.name = "ApiError";
    this.kind = normalized.kind;
    this.status = normalized.status;
    this.code = normalized.code;
    this.requestId = normalized.requestId;
    this.timestamp = normalized.timestamp;
    this.fieldErrors = normalized.fieldErrors;
    this.cause = normalized.cause;
  }
}

/** Map an HTTP status code to a coarse error category. */
function kindFromStatus(status: number): ApiErrorKind {
  switch (status) {
    case HTTP_STATUS.UNAUTHORIZED:
      return "unauthorized";
    case HTTP_STATUS.FORBIDDEN:
      return "forbidden";
    case HTTP_STATUS.NOT_FOUND:
      return "notFound";
    case HTTP_STATUS.CONFLICT:
      return "conflict";
    case HTTP_STATUS.UNPROCESSABLE_ENTITY:
    case HTTP_STATUS.BAD_REQUEST:
      return "validation";
    case HTTP_STATUS.TOO_MANY_REQUESTS:
      return "rateLimit";
    default:
      return status >= 500 ? "server" : "unknown";
  }
}

/** Best-effort extraction of a human message from an unknown response body. */
function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }
  return fallback;
}

/** The envelope's `error` object, when the body has one. */
function errorObjectOf(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== "object") return undefined;
  const error = (body as Record<string, unknown>).error;
  return error && typeof error === "object"
    ? (error as Record<string, unknown>)
    : undefined;
}

/**
 * The machine code: `error.code` in the current envelope, top-level `code` in
 * the older one. Losing it made every non-validation failure fall back to
 * generic copy, hiding the backend's own explanation.
 */
function codeFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const topLevel = (body as Record<string, unknown>).code;
  if (typeof topLevel === "string") return topLevel;
  const nested = errorObjectOf(body)?.code;
  return typeof nested === "string" ? nested : undefined;
}

/**
 * Best-effort extraction of field-level validation errors. Looks for an
 * `errors`/`details` array of `{ field | path, message }` on the failure body,
 * or a single `error.details.field`, which names the field the envelope's own
 * `message` is about.
 */
function fieldErrorsFromBody(body: unknown): FieldError[] | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;

  const details = errorObjectOf(body)?.details;
  if (
    details &&
    typeof details === "object" &&
    !Array.isArray(details) &&
    typeof (details as Record<string, unknown>).field === "string" &&
    typeof record.message === "string"
  ) {
    return [
      {
        field: (details as Record<string, unknown>).field as string,
        message: record.message,
      },
    ];
  }

  const errors = record.errors ?? record.details;
  if (!Array.isArray(errors)) return undefined;

  const mapped = errors.flatMap((entry): FieldError[] => {
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const field = record.field ?? record.path;
      if (typeof field === "string" && typeof record.message === "string") {
        return [{ field, message: record.message }];
      }
    }
    return [];
  });

  return mapped.length > 0 ? mapped : undefined;
}

/**
 * Convert any thrown value from the transport into a stable, typed shape.
 * This is the single place that understands Axios internals.
 */
export function normalizeError(error: unknown): NormalizedApiError {
  if (axios.isCancel(error)) {
    return {
      kind: "canceled",
      status: null,
      message: "Request was canceled.",
      cause: error,
    };
  }

  if (axios.isAxiosError(error)) {
    return normalizeAxiosError(error);
  }

  return {
    kind: "unknown",
    status: null,
    message:
      error instanceof Error ? error.message : "An unknown error occurred.",
    cause: error,
  };
}

function normalizeAxiosError(error: AxiosError): NormalizedApiError {
  const requestId = error.response?.headers?.["x-request-id"] as
    string | undefined;

  if (error.code === "ECONNABORTED") {
    return {
      kind: "timeout",
      status: null,
      message: "The request timed out. Please try again.",
      requestId,
      cause: error,
    };
  }

  if (!error.response) {
    return {
      kind: "network",
      status: null,
      message: "Network error. Please check your connection.",
      requestId,
      cause: error,
    };
  }

  const { status, data } = error.response;

  // Prefer the structured backend failure envelope when present.
  if (isApiErrorResponse(data)) {
    return {
      kind: kindFromStatus(status),
      status,
      message: data.message,
      code: codeFromBody(data),
      requestId: data.requestId ?? requestId,
      timestamp: data.timestamp,
      fieldErrors: fieldErrorsFromBody(data),
      cause: error,
    };
  }

  const code = (data as Record<string, unknown> | undefined)?.code;
  return {
    kind: kindFromStatus(status),
    status,
    message: messageFromBody(data, error.message || "Request failed."),
    code: typeof code === "string" ? code : undefined,
    requestId,
    fieldErrors: fieldErrorsFromBody(data),
    cause: error,
  };
}

/** Convenience guard for consumers. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
