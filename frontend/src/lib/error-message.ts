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

/** Resolve a friendly, display-ready message from any thrown value. */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    // Prefer a specific server message when the category is validation.
    if (error.kind === "validation" && error.message) return error.message;
    return MESSAGES[error.kind];
  }
  if (error instanceof Error && error.message) return error.message;
  return MESSAGES.unknown;
}

/** Extract field-level errors for form binding, when present. */
export function getFieldErrors(error: unknown) {
  return isApiError(error) ? (error as ApiError).fieldErrors : undefined;
}
