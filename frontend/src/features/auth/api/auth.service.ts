import { api } from "@/core/api";

import type {
  AuthSessionDto,
  AuthTokensDto,
  ForgotPasswordRequest,
  LoginRequest,
  LogoutRequest,
  OtpRequest,
  RefreshRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  VerifyOtpRequest,
  VerifyOtpResponseDto,
} from "../types/auth.dto";

/**
 * Transport for the backend auth API — one function per endpoint, no state and
 * no domain rules.
 *
 * Every call goes through the shared `api` helper, so the versioned base URL,
 * dynamic headers, envelope unwrapping and `ApiError` normalization all come
 * from `core/api`. Paths are version-agnostic: the client resolves `/auth/login`
 * against `<origin>/v1`, so moving to v2 stays an environment change.
 *
 * Endpoints whose envelope carries no payload resolve to `null`; their message
 * is the envelope's, and the UI supplies its own copy.
 */
export const authService = {
  /** `POST /auth/login` → tokens only. Public. */
  login: (body: LoginRequest) =>
    api.post<AuthTokensDto, LoginRequest>("/auth/login", body),

  /** `POST /auth/refresh` → a rotated pair. Public; token travels in the body. */
  refresh: (body: RefreshRequest) =>
    api.post<AuthTokensDto, RefreshRequest>("/auth/refresh", body),

  /**
   * `POST /auth/logout`. Requires the access token *and* the refresh token;
   * `allDevices` is optional and the backend only honours the literal `"true"`.
   */
  logout: (body: LogoutRequest, allDevices = false) =>
    api.post<null, LogoutRequest>("/auth/logout", body, {
      params: allDevices ? { allDevices: "true" } : undefined,
    }),

  /**
   * `POST /auth/forgot-password` — sends an email containing a reset **link**.
   * Always succeeds, whether or not the address exists, to prevent account
   * enumeration.
   */
  forgotPassword: (body: ForgotPasswordRequest) =>
    api.post<null, ForgotPasswordRequest>("/auth/forgot-password", body),

  /** `POST /auth/reset-password` with the single-use token from that link. */
  resetPassword: (body: ResetPasswordRequest) =>
    api.post<null, ResetPasswordRequest>("/auth/reset-password", body),

  /** `POST /auth/send-otp`. Not part of password recovery — see the DTO notes. */
  sendOtp: (body: OtpRequest) =>
    api.post<null, OtpRequest>("/auth/send-otp", body),

  /** `POST /auth/verify-otp` → `{ success }`. Issues no token. */
  verifyOtp: (body: VerifyOtpRequest) =>
    api.post<VerifyOtpResponseDto, VerifyOtpRequest>("/auth/verify-otp", body),

  /** `POST /auth/resend-otp`. Throttled by a 60-second server-side cooldown. */
  resendOtp: (body: OtpRequest) =>
    api.post<null, OtpRequest>("/auth/resend-otp", body),

  /** `POST /auth/verify-email`. */
  verifyEmail: (body: VerifyEmailRequest) =>
    api.post<null, VerifyEmailRequest>("/auth/verify-email", body),

  /** `POST /auth/resend-verification`. */
  resendVerification: (body: ResendVerificationRequest) =>
    api.post<null, ResendVerificationRequest>(
      "/auth/resend-verification",
      body,
    ),

  /** `GET /auth/sessions` → the caller's active sessions. Authenticated. */
  getSessions: () => api.get<AuthSessionDto[]>("/auth/sessions"),

  /** `DELETE /auth/sessions/:id`. Authenticated. */
  revokeSession: (id: string) => api.delete<null>(`/auth/sessions/${id}`),

  /** `DELETE /auth/sessions` — revokes every session. Authenticated. */
  revokeAllSessions: () => api.delete<null>("/auth/sessions"),
} as const;
