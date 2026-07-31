import { describe, expect, it } from "vitest";

import { ApiError, isApiError, normalizeError } from "@/core/api";
import { getErrorMessage } from "@/lib";

describe("API error normalization", () => {
  it("normalizes unknown errors", () => {
    const normalized = normalizeError(new Error("boom"));
    expect(normalized.kind).toBe("unknown");
    expect(normalized.message).toBe("boom");
  });

  it("wraps normalized errors in a typed ApiError", () => {
    const error = new ApiError({
      kind: "forbidden",
      status: 403,
      message: "nope",
    });
    expect(isApiError(error)).toBe(true);
    expect(error.kind).toBe("forbidden");
  });

  it("maps error kinds to friendly copy", () => {
    const error = new ApiError({ kind: "network", status: null, message: "" });
    expect(getErrorMessage(error)).toMatch(/connection/i);
  });

  it("prefers server message for validation errors", () => {
    const error = new ApiError({
      kind: "validation",
      status: 422,
      message: "Email already taken",
    });
    expect(getErrorMessage(error)).toBe("Email already taken");
  });
});
