"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
import {
  Form,
  OtpField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared";

import {
  OTP_LENGTH,
  otpFormDefaults,
  otpFormSchema,
  type OtpFormValues,
} from "../schemas/recovery.schema";
import { useRecoveryStore } from "../store/recovery-store";

export interface OtpVerificationFormProps {
  /**
   * Verification handler. Unset in this phase, so the form validates and
   * advances without a network call. Wiring `POST /auth/verify-otp` later means
   * passing its `mutateAsync` here and handing the returned reset token to
   * `completeVerification`.
   */
  onSubmit?: (values: OtpFormValues) => Promise<{ resetToken?: string } | void>;
}

/**
 * Step 3 of recovery: verify the one-time code.
 *
 * `OtpField` carries the input behavior (paste, arrow keys, autofill); this
 * form adds validation, the submitting state, and error presentation.
 */
export function OtpVerificationForm({ onSubmit }: OtpVerificationFormProps) {
  const router = useRouter();
  const completeVerification = useRecoveryStore(
    (state) => state.completeVerification,
  );
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(otpFormSchema, {
    defaultValues: otpFormDefaults,
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const result = await onSubmit?.(values);
      completeVerification(result?.resetToken ?? null);
      router.push(ROUTES.auth.resetPassword);
    } catch (error) {
      const boundToFields = applyServerFieldErrors(error, form.setError);
      if (!boundToFields) setSubmitError(error);
    }
  });

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>That code didn&apos;t work</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <OtpField
          control={form.control}
          name="otp"
          label={`${OTP_LENGTH}-digit verification code`}
          length={OTP_LENGTH}
          autoFocus
          disabled={isSubmitting}
        />

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="h-12 w-full"
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" label="Verifying code" />
              Verifying…
            </>
          ) : (
            "Verify and continue"
          )}
        </Button>
      </form>
    </Form>
  );
}
