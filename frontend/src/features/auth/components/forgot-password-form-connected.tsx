"use client";

import { useForgotPassword } from "../hooks/use-password-recovery";
import { ForgotPasswordForm } from "./forgot-password-form";

/**
 * Binds the reset-request mutation to the presentational form.
 *
 * The mutation owns navigation, so the form keeps its single responsibility:
 * validate, submit, report.
 */
export function ForgotPasswordFormConnected() {
  const forgotPassword = useForgotPassword();

  return (
    <ForgotPasswordForm
      onSubmit={async (values) => {
        await forgotPassword.mutateAsync(values);
      }}
    />
  );
}
