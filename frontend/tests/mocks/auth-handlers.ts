import { http, HttpResponse } from "msw";

import { apiConfig } from "@/config";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";

/**
 * Default MSW handlers for the auth API, matching the verified backend
 * contract in `docs/authentication.md`.
 *
 * These are the happy paths; failure scenarios are declared per test with
 * `server.use(...)` alongside the builders below.
 */
const base = apiConfig.baseURL.replace(/\/$/, "");

/**
 * A JWT-shaped token whose payload carries the claims the backend signs.
 * Only the payload segment is real — nothing client-side verifies signatures.
 */
export function makeAccessToken(claims: Record<string, unknown> = {}): string {
  const payload = {
    sub: "user-1",
    email: "admin@institution.edu",
    role: "ORG_ADMIN",
    organizationId: "org-1",
    branchId: null,
    exp: Math.floor(Date.now() / 1000) + 900,
    ...claims,
  };
  const encode = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

export const authTokens = {
  accessToken: makeAccessToken(),
  refreshToken: "refresh-token-1",
};

/** The backend's failure envelope for a rejected sign-in. */
export const invalidCredentialsEnvelope = errorEnvelope({
  code: "UnauthorizedException",
  message: "Invalid credentials",
});

/**
 * The lockout response. Its `code` is the generic Nest class name — the same
 * one any other 403 carries — which is exactly why detection also inspects the
 * message. The duration is the backend's to state.
 */
export const accountLockedEnvelope = errorEnvelope({
  code: "ForbiddenException",
  message: "Account locked. Try again after 7 minutes",
});

export const authHandlers = [
  http.post(`${base}/auth/login`, () =>
    HttpResponse.json(
      successEnvelope(authTokens, { message: "Login successful" }),
      { status: 201 },
    ),
  ),
  http.post(`${base}/auth/refresh`, () =>
    HttpResponse.json(
      successEnvelope(
        { accessToken: makeAccessToken(), refreshToken: "refresh-token-2" },
        { message: "Token refreshed" },
      ),
      { status: 201 },
    ),
  ),
  http.post(`${base}/auth/logout`, () =>
    HttpResponse.json(
      successEnvelope(null, { message: "Logged out successfully" }),
      { status: 201 },
    ),
  ),
  http.post(`${base}/auth/forgot-password`, () =>
    HttpResponse.json(
      successEnvelope(null, {
        message:
          "If the email matches an account in our system, a password reset link will be sent shortly.",
      }),
      { status: 201 },
    ),
  ),
  http.post(`${base}/auth/reset-password`, () =>
    HttpResponse.json(
      successEnvelope(null, { message: "Password reset successfully" }),
      { status: 201 },
    ),
  ),
  http.get(`${base}/auth/sessions`, () =>
    HttpResponse.json(
      successEnvelope([
        {
          id: "session-1",
          device: "Desktop",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
          createdAt: "2026-08-01T10:00:00.000Z",
        },
      ]),
    ),
  ),
  http.delete(`${base}/auth/sessions/:id`, () =>
    HttpResponse.json(successEnvelope(null)),
  ),
  http.delete(`${base}/auth/sessions`, () =>
    HttpResponse.json(successEnvelope(null)),
  ),
];
