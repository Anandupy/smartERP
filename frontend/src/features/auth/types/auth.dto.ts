/**
 * Wire contracts for the backend auth API.
 *
 * These mirror the verified backend exactly — request bodies come from the
 * NestJS DTOs, responses from what the controller returns through the global
 * response interceptor. Form-facing types live in `schemas/`; the mappers in
 * `mappers/` translate between the two, so a backend change lands here and
 * nowhere else.
 *
 * Contract source: `docs/authentication.md`.
 */

/** `OtpPurpose` as declared in the backend Prisma schema. */
export const OTP_PURPOSES = [
  "LOGIN",
  "PASSWORD_RESET",
  "EMAIL_VERIFY",
  "PHONE_VERIFY",
  "MFA",
  "PAYMENT",
  "ADMISSION",
] as const;

export type OtpPurpose = (typeof OTP_PURPOSES)[number];

// ---------------------------------------------------------------- requests --

/** `POST /auth/login`. `identifier` accepts email, username, or phone. */
export interface LoginRequest {
  identifier: string;
  password: string;
}

/** `POST /auth/refresh` — the token travels in the body, never a cookie. */
export interface RefreshRequest {
  refreshToken: string;
}

/** `POST /auth/logout`. Requires the access token *and* the refresh token. */
export interface LogoutRequest {
  refreshToken: string;
}

/** `POST /auth/forgot-password` — emails a reset **link**, not a code. */
export interface ForgotPasswordRequest {
  email: string;
}

/** `POST /auth/reset-password`. `token` arrives in the emailed link. */
export interface ResetPasswordRequest {
  token: string;
  password: string;
}

/**
 * `POST /auth/change-password`. Authenticated — requires the current
 * password, unlike `reset-password`'s single-use token. The backend then
 * revokes every refresh token for the account.
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** `POST /auth/send-otp` and `POST /auth/resend-otp`. */
export interface OtpRequest {
  identifier: string;
  purpose: OtpPurpose;
}

/** `POST /auth/verify-otp`. `otp` is exactly six digits. */
export interface VerifyOtpRequest extends OtpRequest {
  otp: string;
}

/** `POST /auth/verify-email`. */
export interface VerifyEmailRequest {
  email: string;
  otp: string;
}

/** `POST /auth/resend-verification`. */
export interface ResendVerificationRequest {
  email: string;
}

// --------------------------------------------------------------- responses --

/** The only payload `login` and `refresh` return. */
export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

/** `verify-otp` unwraps to `{ success: true }`. */
export interface VerifyOtpResponseDto {
  success: boolean;
}

/** One row of `GET /auth/sessions`. */
export interface AuthSessionDto {
  id: string;
  device: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** ISO-8601. The backend exposes no `lastActive` or `isCurrent`. */
  createdAt: string;
}

/**
 * Claims carried by the access token.
 *
 * The backend signs `{ sub, email, role, organizationId, branchId }` and offers
 * no `/auth/me`, so this is the only description of the signed-in user
 * available at login. Read for display only — the server verifies the
 * signature, the client never does.
 */
export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: string;
  organizationId?: string | null;
  branchId?: string | null;
  /** Expiry, in seconds since the epoch. */
  exp?: number;
  iat?: number;
}
