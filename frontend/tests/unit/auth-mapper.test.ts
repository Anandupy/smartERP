import { describe, expect, it } from "vitest";

import {
  decodeAccessToken,
  toAuthUser,
  toForgotPasswordRequest,
  toLoginRequest,
  toResetPasswordRequest,
  toTokenPair,
} from "@/features/auth";
import { makeAccessToken } from "@tests/mocks/auth-handlers";

describe("toLoginRequest", () => {
  it("renames email to the backend's identifier field", () => {
    const request = toLoginRequest({
      email: "admin@institution.edu",
      password: "s3cret",
      rememberMe: false,
    });

    expect(request).toEqual({
      identifier: "admin@institution.edu",
      password: "s3cret",
    });
  });

  it("never sends rememberMe", () => {
    // The backend runs `forbidNonWhitelisted`, so an extra property is a 400 —
    // and remembering the session is purely a client-side storage decision.
    const request = toLoginRequest({
      email: "admin@institution.edu",
      password: "s3cret",
      rememberMe: true,
    });

    expect(request).not.toHaveProperty("rememberMe");
    expect(Object.keys(request).sort()).toEqual(["identifier", "password"]);
  });

  it("trims the identifier", () => {
    expect(
      toLoginRequest({
        email: "  admin@institution.edu  ",
        password: "s3cret",
        rememberMe: false,
      }).identifier,
    ).toBe("admin@institution.edu");
  });
});

describe("toForgotPasswordRequest", () => {
  it("sends only the email", () => {
    expect(toForgotPasswordRequest({ email: " user@school.com " })).toEqual({
      email: "user@school.com",
    });
  });
});

describe("toResetPasswordRequest", () => {
  it("pairs the link token with the new password and drops the confirmation", () => {
    const request = toResetPasswordRequest(
      { password: "NewPassword123!" },
      "a4f7b2c9",
    );

    expect(request).toEqual({ token: "a4f7b2c9", password: "NewPassword123!" });
    expect(request).not.toHaveProperty("confirmPassword");
  });
});

describe("token and identity mapping", () => {
  it("carries the access token's expiry into the token pair", () => {
    const exp = Math.floor(Date.now() / 1000) + 900;
    const tokens = {
      accessToken: makeAccessToken({ exp }),
      refreshToken: "refresh-1",
    };

    expect(toTokenPair(tokens)).toEqual({
      accessToken: tokens.accessToken,
      refreshToken: "refresh-1",
      expiresAt: exp * 1000,
    });
  });

  it("builds the session identity from the token's claims", () => {
    const claims = decodeAccessToken(
      makeAccessToken({
        sub: "user-9",
        email: "dean@school.com",
        role: "STAFF",
      }),
    );
    expect(claims).not.toBeNull();

    const user = toAuthUser(claims!);
    expect(user.id).toBe("user-9");
    expect(user.email).toBe("dean@school.com");
    expect(user.roles).toEqual(["STAFF"]);
  });

  it("falls back to the email for the display name, which has no claim", () => {
    const claims = decodeAccessToken(
      makeAccessToken({ email: "dean@school.com" }),
    );
    expect(toAuthUser(claims!).name).toBe("dean@school.com");
  });

  it("starts with no permissions so every check fails closed", () => {
    // Permissions live on a separate endpoint; until it is wired, hiding UI the
    // user may be entitled to is the safe direction.
    const claims = decodeAccessToken(makeAccessToken());
    expect(toAuthUser(claims!).permissions).toEqual([]);
  });
});

describe("decodeAccessToken", () => {
  it("returns null for a malformed token rather than a partial identity", () => {
    expect(decodeAccessToken("not-a-jwt")).toBeNull();
    expect(decodeAccessToken("")).toBeNull();
    expect(decodeAccessToken("a.b.c")).toBeNull();
  });

  it("rejects a payload missing the identity claims", () => {
    const noSub = btoa(JSON.stringify({ email: "x@y.z" }));
    expect(decodeAccessToken(`header.${noSub}.sig`)).toBeNull();
  });
});
