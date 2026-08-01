"use client";

import { useMutation } from "@tanstack/react-query";

import { authService } from "../api/auth.service";
import type { OtpPurpose } from "../types/auth.dto";

/**
 * One-time-code mutations.
 *
 * **Not part of password recovery.** The backend resets passwords with an
 * emailed link, and `verify-otp` returns only `{ success }` — it issues no
 * token that `reset-password` could consume. These endpoints exist for the
 * other purposes in `OtpPurpose`: `LOGIN`, `MFA`, `EMAIL_VERIFY`,
 * `PHONE_VERIFY`.
 *
 * They are wired now so the OTP screens stay live for those flows. Server-side
 * limits worth knowing: codes are six digits, valid ten minutes, capped at five
 * attempts, with a sixty-second resend cooldown.
 */

export function useSendOtp() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (input: { identifier: string; purpose: OtpPurpose }) =>
      authService.sendOtp(input),
  });
}

export function useResendOtp() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (input: { identifier: string; purpose: OtpPurpose }) =>
      authService.resendOtp(input),
  });
}

export function useVerifyOtp() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (input: {
      identifier: string;
      purpose: OtpPurpose;
      otp: string;
    }) => authService.verifyOtp(input),
  });
}

export function useVerifyEmail() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (input: { email: string; otp: string }) =>
      authService.verifyEmail(input),
  });
}

export function useResendVerification() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (input: { email: string }) =>
      authService.resendVerification(input),
  });
}
