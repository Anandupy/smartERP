import type { AuthUser, TokenPair } from "@/core/auth";

import type { ForgotPasswordFormValues } from "../schemas/recovery.schema";
import type { LoginFormValues } from "../schemas/login.schema";
import type {
  AccessTokenClaims,
  AuthTokensDto,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
} from "../types/auth.dto";
import { decodeAccessToken } from "../utils/jwt";

/**
 * Translation between form values and wire DTOs.
 *
 * Every shape difference between the UI and the backend is resolved here and
 * nowhere else, so a contract change is a one-file edit and each rule is
 * unit-testable in isolation.
 */

/**
 * Login form → `POST /auth/login`.
 *
 * Two deliberate transformations:
 * - `email` becomes `identifier`, which the backend also accepts as a username
 *   or phone number.
 * - `rememberMe` is **dropped**. It is a client-only decision about token
 *   persistence, and the backend runs `forbidNonWhitelisted`, so sending it
 *   would fail the request with a 400.
 */
export function toLoginRequest(values: LoginFormValues): LoginRequest {
  return {
    identifier: values.email.trim(),
    password: values.password,
  };
}

/** Forgot-password form → `POST /auth/forgot-password`. */
export function toForgotPasswordRequest(
  values: ForgotPasswordFormValues,
): ForgotPasswordRequest {
  return { email: values.email.trim() };
}

/**
 * Reset-password form + the token from the emailed link →
 * `POST /auth/reset-password`. `confirmPassword` never leaves the client.
 */
export function toResetPasswordRequest(
  values: { password: string },
  token: string,
): ResetPasswordRequest {
  return { token, password: values.password };
}

/** Wire tokens → the platform's `TokenPair`, carrying the decoded expiry. */
export function toTokenPair(tokens: AuthTokensDto): TokenPair {
  const claims = decodeAccessToken(tokens.accessToken);
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: claims?.exp ? claims.exp * 1000 : undefined,
  };
}

/**
 * Access-token claims → `AuthUser`.
 *
 * The backend returns only tokens from `/auth/login` and exposes no
 * `/auth/me`, so the claims are the entire identity available at sign-in.
 * Two fields have no source and are filled honestly rather than invented:
 *
 * - `name` falls back to the email, because no name claim exists.
 * - `permissions` is empty, so every `can()` check fails closed until
 *   `GET /authorization/me/effective-permissions` is wired. Failing closed
 *   hides UI the user may in fact be entitled to, which is the safe direction.
 *
 * Both resolve the moment the backend adds `/auth/me` — see
 * `docs/authentication.md`.
 */
export function toAuthUser(claims: AccessTokenClaims): AuthUser {
  return {
    id: claims.sub,
    email: claims.email,
    name: claims.email,
    roles: claims.role ? [claims.role] : [],
    permissions: [],
  };
}
