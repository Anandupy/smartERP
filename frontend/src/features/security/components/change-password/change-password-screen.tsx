"use client";

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
import { Card, CardContent } from "@/components/ui/card";
import {
  changePasswordFormDefaults,
  changePasswordFormSchema,
  useChangePassword,
} from "@/features/auth";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared";
import { PageHeader } from "@/shared/components/layout";

/**
 * Change Password — `POST /auth/change-password`.
 *
 * Distinct from `POST /auth/reset-password`: that endpoint is the token-based
 * recovery flow triggered by `forgot-password`, this one requires the
 * account's current password. Both revoke every refresh token for the
 * account, so a successful change signs this device out too — `useChangePassword`
 * handles that redirect.
 */
export function ChangePasswordScreen() {
  const changePassword = useChangePassword();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(changePasswordFormSchema, {
    defaultValues: changePasswordFormDefaults,
    mode: "onSubmit",
  });

  const newPassword = form.watch("newPassword") ?? "";
  const isSubmitting = form.formState.isSubmitting || changePassword.isPending;

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await changePassword.mutateAsync(values);
    } catch (error) {
      const boundToFields = applyServerFieldErrors(error, form.setError);
      if (!boundToFields) setSubmitError(error);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Change Password"
        description="Update the password used to sign in."
      />

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {submitError ? (
                <Alert variant="destructive">
                  <TriangleAlert aria-hidden="true" />
                  <AlertTitle>We couldn&apos;t update your password</AlertTitle>
                  <AlertDescription>
                    {getErrorMessage(submitError)}
                  </AlertDescription>
                </Alert>
              ) : null}

              <PasswordField
                control={form.control}
                name="currentPassword"
                label="Current password"
                placeholder="Enter your current password"
                autoComplete="current-password"
                disabled={isSubmitting}
                startIcon={<Lock />}
              />

              <PasswordField
                control={form.control}
                name="newPassword"
                label="New password"
                placeholder="Enter a new password"
                autoComplete="new-password"
                disabled={isSubmitting}
                startIcon={<Lock />}
              />

              <div className="bg-muted/50 border-border/60 rounded-lg border p-4">
                <PasswordStrengthMeter value={newPassword} />
              </div>

              <PasswordField
                control={form.control}
                name="confirmPassword"
                label="Confirm new password"
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                disabled={isSubmitting}
                startIcon={<Lock />}
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Spinner size="sm" label="Updating password" />
                  ) : null}
                  {isSubmitting ? "Updating…" : "Update password"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
