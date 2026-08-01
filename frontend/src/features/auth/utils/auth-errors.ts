import { ApiError, isApiError } from "@/core/api";

/**
 * Account-lock detection — the **only** place this rule may live.
 *
 * The backend's `GlobalExceptionFilter` sets `code` to the thrown exception's
 * class name, so a lockout arrives as a plain `ForbiddenException`, identical
 * to every other 403 in the system. Matching on the code alone would route a
 * permission denial to the Account Locked screen.
 *
 * Until a dedicated business code exists, detection therefore requires the code
 * *and* a message match. That is deliberately narrow and deliberately isolated:
 * when the backend adds `ACCOUNT_LOCKED`, only `LOCK_CODES` changes and the
 * message fallback can be deleted.
 *
 * The message itself is never parsed for a duration — the backend computes the
 * remaining minutes and the UI shows its text verbatim, so changing the copy or
 * the lockout window server-side needs no frontend release.
 */

/** Codes that identify a lockout on their own, once the backend emits one. */
const LOCK_CODES = ["ACCOUNT_LOCKED"] as const;

/** The generic code a lockout currently arrives as. */
const GENERIC_FORBIDDEN_CODE = "ForbiddenException";

/** Narrow match against the backend's lockout copy. */
const LOCK_MESSAGE_PATTERN = /account\s+(is\s+)?locked/i;

/** `true` when this failure means the account is locked out. */
export function isAccountLockedError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  const apiError = error as ApiError;

  if (apiError.code && LOCK_CODES.includes(apiError.code as never)) return true;

  return (
    apiError.kind === "forbidden" &&
    apiError.code === GENERIC_FORBIDDEN_CODE &&
    LOCK_MESSAGE_PATTERN.test(apiError.message)
  );
}

/**
 * The backend's lockout message, verbatim, or `null` when the error is not a
 * lockout. Callers display this as-is — never re-word it, never extract the
 * duration from it.
 */
export function getAccountLockedMessage(error: unknown): string | null {
  if (!isAccountLockedError(error)) return null;
  return (error as ApiError).message;
}
