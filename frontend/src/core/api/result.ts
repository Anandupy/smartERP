import { ApiError, normalizeError } from "./errors";

/**
 * A `Result` models an operation that either succeeds with a value or fails with
 * a typed error, without throwing. Useful in call sites (e.g. Server Actions,
 * form submits) that prefer to branch on outcome instead of using try/catch.
 */
export type Result<T, E = ApiError> =
  { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function isOk<T, E>(
  result: Result<T, E>,
): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(
  result: Result<T, E>,
): result is { ok: false; error: E } {
  return !result.ok;
}

/**
 * Run a promise and capture its outcome as a `Result`, normalizing any thrown
 * value into an `ApiError`. Never rejects.
 */
export async function toResult<T>(promise: Promise<T>): Promise<Result<T>> {
  try {
    return ok(await promise);
  } catch (error) {
    return err(
      error instanceof ApiError ? error : new ApiError(normalizeError(error)),
    );
  }
}
