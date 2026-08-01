"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ArrowRight, Mail, TriangleAlert } from "@/assets/icons";
import {
  Form,
  TextField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared";

import {
  forgotPasswordFormDefaults,
  forgotPasswordFormSchema,
  type ForgotPasswordFormValues,
} from "../schemas/recovery.schema";
import { useRecoveryStore } from "../store/recovery-store";

export interface ForgotPasswordFormProps {
  /**
   * Recovery request handler. Unset in this phase, so the form validates and
   * advances without a network call. Wiring `POST /auth/forgot-password`
   * later means passing its `mutateAsync` here — nothing else changes.
   */
  onSubmit?: (values: ForgotPasswordFormValues) => Promise<void>;
}

/**
 * Step 1 of recovery: ask where to send the code.
 *
 * On success it records the identifier in the flow store and advances to the
 * confirmation screen. Errors follow the platform's two paths — field-bound via
 * `applyServerFieldErrors`, form-level via `getErrorMessage` in an `Alert`.
 */
export function ForgotPasswordForm({ onSubmit }: ForgotPasswordFormProps) {
  const router = useRouter();
  const startRecovery = useRecoveryStore((state) => state.startRecovery);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(forgotPasswordFormSchema, {
    defaultValues: forgotPasswordFormDefaults,
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit?.(values);
      startRecovery(values.email);
      router.push(ROUTES.auth.emailSent);
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
            <AlertTitle>We couldn&apos;t send the code</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <TextField
          control={form.control}
          name="email"
          type="email"
          label="Institutional email"
          placeholder="admin@institution.edu"
          autoComplete="email"
          disabled={isSubmitting}
          startIcon={<Mail />}
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
              <Spinner size="sm" label="Sending reset code" />
              Sending…
            </>
          ) : (
            <>
              Send reset code
              <ArrowRight aria-hidden="true" data-icon="inline-end" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
