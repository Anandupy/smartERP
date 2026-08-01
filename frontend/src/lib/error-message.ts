import { ApiError, isApiError } from "@/core/api";
import type { ApiErrorKind } from "@/types/api";

/**
 * Maps normalized API error categories to user-facing copy. Centralized so the
 * whole app speaks with one voice and messages are trivial to localize later.
 */
const MESSAGES: Record<ApiErrorKind, string> = {
  network: "Can't reach the server. Check your connection and try again.",
  timeout: "The request took too long. Please try again.",
  canceled: "The request was canceled.",
  unauthorized: "Your session has expired. Please sign in again.",
  forbidden: "You don't have permission to do that.",
  notFound: "We couldn't find what you were looking for.",
  validation: "Some of the information provided is invalid.",
  conflict: "That action conflicts with the current state. Please refresh.",
  rateLimit: "Too many requests. Please slow down and try again shortly.",
  server: "Something went wrong on our end. Please try again later.",
  unknown: "An unexpected error occurred.",
};

/**
 * Resolve a friendly, display-ready message from any thrown value.
 *
 * A server-authored message always wins over the generic copy above. The
 * backend states *why* a request failed — "Invalid credentials" — while the
 * category can only describe *what kind* of failure it was, and for
 * `unauthorized` that generic copy ("your session has expired") is actively
 * misleading on a login form.
 *
 * `code` is the discriminator: `normalizeError` sets it only when a response
 * body carried one, so its presence means `message` came from the server and
 * not from Axios. That matters because the transport-level messages ("Network
 * Error") are worse than the copy here, and the backend's exception filter
 * already sanitizes its own — no stack traces, no database internals.
 *
 * Validation failures keep preferring their message even without a code, which
 * is the behavior this function has always had: those messages name the field
 * at fault and are useless when generalized.
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    const hasServerMessage = Boolean(error.code) || error.kind === "validation";
    if (hasServerMessage && error.message) return error.message;
    return MESSAGES[error.kind];
  }
  if (error instanceof Error && error.message) return error.message;
  return MESSAGES.unknown;
}

/** Extract field-level errors for form binding, when present. */
export function getFieldErrors(error: unknown) {
  return isApiError(error) ? (error as ApiError).fieldErrors : undefined;
}
