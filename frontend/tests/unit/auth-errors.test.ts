import { describe, expect, it } from "vitest";

import { ApiError } from "@/core/api";
import { getAccountLockedMessage, isAccountLockedError } from "@/features/auth";

/** Build the failure the backend actually produces for a given code/message. */
function apiError(kind: ApiError["kind"], code: string, message: string) {
  return new ApiError({ kind, status: 403, code, message });
}

describe("account-lock detection", () => {
  it("recognizes the lockout the backend sends today", () => {
    const error = apiError(
      "forbidden",
      "ForbiddenException",
      "Account locked. Try again after 10 minutes",
    );

    expect(isAccountLockedError(error)).toBe(true);
    expect(getAccountLockedMessage(error)).toBe(
      "Account locked. Try again after 10 minutes",
    );
  });

  it("returns the backend message verbatim, whatever the duration", () => {
    // The message is displayed as-is; no duration is ever parsed out of it, so
    // changing the copy or the window server-side needs no frontend release.
    const error = apiError(
      "forbidden",
      "ForbiddenException",
      "Account locked. Try again after 3 minutes",
    );

    expect(getAccountLockedMessage(error)).toBe(
      "Account locked. Try again after 3 minutes",
    );
  });

  it("does NOT mistake an ordinary permission denial for a lockout", () => {
    // The backend sets `code` to the exception class name, so every 403 shares
    // this code. Matching on it alone would hijack unrelated failures.
    const error = apiError(
      "forbidden",
      "ForbiddenException",
      "You do not have permission to perform this action",
    );

    expect(isAccountLockedError(error)).toBe(false);
    expect(getAccountLockedMessage(error)).toBeNull();
  });

  it("ignores invalid credentials", () => {
    const error = new ApiError({
      kind: "unauthorized",
      status: 401,
      code: "UnauthorizedException",
      message: "Invalid credentials",
    });

    expect(isAccountLockedError(error)).toBe(false);
  });

  it("accepts a dedicated business code without needing the message", () => {
    // Forward compatibility: once the backend emits ACCOUNT_LOCKED, the message
    // match becomes redundant and can be deleted.
    const error = new ApiError({
      kind: "forbidden",
      status: 403,
      code: "ACCOUNT_LOCKED",
      message: "Locked for a while",
    });

    expect(isAccountLockedError(error)).toBe(true);
  });

  it("ignores values that are not API errors", () => {
    expect(isAccountLockedError(new Error("Account locked."))).toBe(false);
    expect(isAccountLockedError(null)).toBe(false);
  });
});
