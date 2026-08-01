"use client";

import { useResetPassword } from "../hooks/use-password-recovery";
import { ResetPasswordForm } from "./reset-password-form";

export interface ResetPasswordFormConnectedProps {
  /** The single-use token from the emailed reset link. */
  token: string;
}

/**
 * Binds the reset mutation to the presentational form, supplying the token
 * from the link so the form never has to know where it came from.
 */
export function ResetPasswordFormConnected({
  token,
}: ResetPasswordFormConnectedProps) {
  const resetPassword = useResetPassword(token);

  return (
    <ResetPasswordForm
      onSubmit={async (values) => {
        await resetPassword.mutateAsync(values);
      }}
    />
  );
}
