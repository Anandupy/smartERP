"use client";

import { useMutation } from "@tanstack/react-query";

import { authService } from "../api/auth.service";
import {
  toForgotPasswordRequest,
  toResetPasswordRequest,
} from "../mappers/auth.mapper";
import type {
  ForgotPasswordFormValues,
  ResetPasswordFormValues,
} from "../schemas/recovery.schema";

/**
 * Password recovery mutations.
 *
 * The backend flow is link-based: `forgot-password` emails a single-use token
 * and `reset-password` consumes it. Neither step involves an OTP — see
 * `docs/authentication.md`.
 *
 * These are transport only. The screens already own their own navigation and
 * flow state, and they advance on a resolved `onSubmit`, so putting routing
 * here as well would move the user twice.
 *
 * Both suppress the global error toast: their forms render failures inline.
 */

/**
 * Request a reset email.
 *
 * The backend answers identically whether or not the address exists, to prevent
 * account enumeration — so a success means "the request was accepted", never
 * "an account exists". The UI must not imply otherwise.
 */
export function useForgotPassword() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (values: ForgotPasswordFormValues) =>
      authService.forgotPassword(toForgotPasswordRequest(values)),
  });
}

/**
 * Consume the emailed token and set the new password.
 *
 * The token comes from the link's query string, not from client state: the
 * email is the proof of ownership. A successful reset revokes every existing
 * session server-side, so the user must sign in again afterwards.
 */
export function useResetPassword(token: string) {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (values: ResetPasswordFormValues) =>
      authService.resetPassword(toResetPasswordRequest(values, token)),
  });
}
