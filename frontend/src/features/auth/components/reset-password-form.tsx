"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Lock, TriangleAlert } from "@/assets/icons";
import {
  Form,
  PasswordField,
  PasswordStrengthMeter,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared";

import {
  resetPasswordFormDefaults,
  resetPasswordFormSchema,
  type ResetPasswordFormValues,
} from "../schemas/recovery.schema";
import { useRecoveryStore } from "../store/recovery-store";

export interface ResetPasswordFormProps {
  /**
   * Reset handler. The single-use token is supplied by the container from the
   * emailed link's query string — not by this form and not by client state,
   * because possession of the email is what authorizes the change.
   */
  onSubmit?: (values: ResetPasswordFormValues) => Promise<void>;
}

/**
 * Step 4 of recovery: choose a new password.
 *
 * The strength meter and the schema both read the policy from
 * `lib/password-strength`, so what the checklist promises and what validation
 * enforces cannot drift apart.
 */
export function ResetPasswordForm({ onSubmit }: ResetPasswordFormProps) {
  const router = useRouter();
  const resetFlow = useRecoveryStore((state) => state.reset);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(resetPasswordFormSchema, {
    defaultValues: resetPasswordFormDefaults,
    mode: "onSubmit",
  });

  const password = form.watch("password") ?? "";

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit?.(values);
      resetFlow();
      router.push(ROUTES.auth.passwordSuccess);
    } catch (error) {
      const boundToFields = applyServerFieldErrors(error, form.setError);
      if (!boundToFields) setSubmitError(error);
    }
  });

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>We couldn&apos;t update your password</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <PasswordField
          control={form.control}
          name="password"
          label="New password"
          placeholder="Enter a new password"
          autoComplete="new-password"
          disabled={isSubmitting}
          startIcon={<Lock />}
          inputClassName="h-11"
        />

        <div className="bg-muted/50 border-border/60 rounded-lg border p-4">
          <PasswordStrengthMeter value={password} />
        </div>

        <PasswordField
          control={form.control}
          name="confirmPassword"
          label="Confirm new password"
          placeholder="Re-enter your new password"
          autoComplete="new-password"
          disabled={isSubmitting}
          startIcon={<Lock />}
          inputClassName="h-11"
        />

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="h-12 w-full"
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" label="Updating password" />
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </Form>
  );
}
