"use client";

import Link from "next/link";
import { useState } from "react";

import { Lock, Mail, TriangleAlert } from "@/assets/icons";
import {
  CheckboxField,
  Form,
  PasswordField,
  TextField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROUTES } from "@/constants";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared";

import { LOGIN_SSO_PROVIDERS } from "../constants";
import {
  loginFormDefaults,
  loginFormSchema,
  type LoginFormValues,
} from "../schemas/login.schema";

export interface LoginFormProps {
  /**
   * Credential submission handler. Left unset in this phase: the screen is UI
   * only, so the form validates, reports, and resets without any network call.
   * When the auth mutation lands it is passed in here — nothing else changes.
   */
  onSubmit?: (values: LoginFormValues) => Promise<void>;
}

/**
 * The sign-in form.
 *
 * Owns validation (Zod via `useZodForm`), the submitting state, and error
 * presentation. Failures are surfaced two ways, both driven by the platform's
 * normalized `ApiError`: field-level messages bound through
 * `applyServerFieldErrors`, and a form-level `Alert` with copy from
 * `getErrorMessage`, so the same code path works once a real backend is wired.
 */
export function LoginForm({ onSubmit }: LoginFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(loginFormSchema, {
    defaultValues: loginFormDefaults,
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    if (!onSubmit) return;

    try {
      await onSubmit(values);
    } catch (error) {
      // Bind whatever the server blamed on a field; keep the rest form-level.
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
            <AlertTitle>Sign-in failed</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <TextField
          control={form.control}
          name="email"
          type="email"
          label="Institutional email"
          placeholder="admin@university.edu"
          autoComplete="email"
          disabled={isSubmitting}
          startIcon={<Mail />}
          inputClassName="h-11"
        />

        <PasswordField
          control={form.control}
          name="password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
          disabled={isSubmitting}
          startIcon={<Lock />}
          inputClassName="h-11"
          labelAction={
            <Link
              href={ROUTES.auth.forgotPassword}
              className="text-primary focus-visible:ring-ring/50 rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
            >
              Forgot password?
            </Link>
          }
        />

        <CheckboxField
          control={form.control}
          name="rememberMe"
          label="Remember me on this device"
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
              <Spinner size="sm" label="Signing in" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>

        <div className="relative">
          <Separator />
          <span className="bg-card text-muted-foreground absolute inset-0 mx-auto w-fit -translate-y-1/2 px-3 text-xs">
            Or continue with
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LOGIN_SSO_PROVIDERS.map((provider) => (
            <Tooltip key={provider.id}>
              <TooltipTrigger asChild>
                {/* A disabled <button> emits no pointer or focus events, so the
                    trigger is a focusable wrapper and the button carries the
                    reason in its own accessible name. */}
                <span tabIndex={0} className="rounded-lg">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled
                    aria-label={`${provider.label} — single sign-on is not enabled for this workspace yet`}
                    className="h-11 w-full"
                  >
                    {provider.label}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Single sign-on is not enabled for this workspace yet.
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </form>
    </Form>
  );
}
