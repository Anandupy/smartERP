import { describe, expect, it } from "vitest";

import { ApiError } from "@/core/api";
import { getErrorMessage } from "@/lib";

describe("getErrorMessage", () => {
  it("prefers the backend's reason over the category copy", () => {
    // Regression: a 401 from /auth/login was rendered as "Your session has
    // expired. Please sign in again." on the login form, because every kind
    // except `validation` fell through to the generic copy.
    const error = new ApiError({
      kind: "unauthorized",
      code: "UnauthorizedException",
      message: "Invalid credentials",
      status: 401,
    });

    expect(getErrorMessage(error)).toBe("Invalid credentials");
  });

  it("keeps using the backend message for other envelope failures", () => {
    expect(
      getErrorMessage(
        new ApiError({
          kind: "forbidden",
          code: "ForbiddenException",
          message: "Account locked. Try again after 10 minutes",
          status: 403,
        }),
      ),
    ).toBe("Account locked. Try again after 10 minutes");

    expect(
      getErrorMessage(
        new ApiError({
          kind: "validation",
          code: "BadRequestException",
          message: "password should not be empty",
          status: 400,
        }),
      ),
    ).toBe("password should not be empty");
  });

  it("falls back to friendly copy for transport failures", () => {
    // These carry no `code`, so their message came from Axios — "Network
    // Error" is worse than the curated copy.
    expect(
      getErrorMessage(
        new ApiError({
          kind: "network",
          message: "Network error. Please check your connection.",
          status: null,
        }),
      ),
    ).toBe("Can't reach the server. Check your connection and try again.");

    expect(
      getErrorMessage(
        new ApiError({
          kind: "timeout",
          message: "The request timed out. Please try again.",
          status: null,
        }),
      ),
    ).toBe("The request took too long. Please try again.");
  });

  it("falls back when a response carried no envelope", () => {
    expect(
      getErrorMessage(
        new ApiError({
          kind: "server",
          message: "Request failed.",
          status: 500,
        }),
      ),
    ).toBe("Something went wrong on our end. Please try again later.");
  });

  it("handles values that are not API errors", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage(null)).toBe("An unexpected error occurred.");
  });
});
