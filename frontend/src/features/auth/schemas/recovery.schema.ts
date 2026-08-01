import { z } from "zod";

import { PASSWORD_RULES } from "@/lib";
import { emailSchema } from "@/schemas";

/**
 * Password-recovery schemas, one per step of the flow.
 *
 * Client-side validation is a UX affordance only — it shapes the message the
 * user sees first. The backend remains the authority, and its field errors are
 * bound back onto these forms via `applyServerFieldErrors`.
 */

/** Step 1 — request a recovery code. Maps to `POST /auth/forgot-password`. */
export const forgotPasswordFormSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;

export const forgotPasswordFormDefaults: ForgotPasswordFormValues = {
  email: "",
};

/** Length of the one-time codes the backend issues. */
export const OTP_LENGTH = 6;

/** Step 2 — verify the code. Maps to `POST /auth/verify-otp`. */
export const otpFormSchema = z.object({
  otp: z
    .string()
    .regex(
      new RegExp(`^\\d{${OTP_LENGTH}}$`),
      `Enter the ${OTP_LENGTH}-digit code`,
    ),
});

export type OtpFormValues = z.infer<typeof otpFormSchema>;

export const otpFormDefaults: OtpFormValues = { otp: "" };

/**
 * Step 3 — set the new password. Maps to `POST /auth/reset-password`.
 *
 * The policy rules are read from `lib/password-strength`, the same source the
 * meter and checklist render, so the schema can never disagree with what the
 * screen advertises.
 */
export const resetPasswordFormSchema = z
  .object({
    // `ZodType` defaults its Input parameter to `unknown`, which would erase the
    // form's input type through the chain — pin both sides to `string`.
    password: PASSWORD_RULES.reduce(
      (schema, rule) => schema.refine(rule.test, { message: rule.label }),
      z.string().min(1, "Enter a new password") as z.ZodType<string, string>,
    ),
    confirmPassword: z.string().min(1, "Re-enter your new password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

export const resetPasswordFormDefaults: ResetPasswordFormValues = {
  password: "",
  confirmPassword: "",
};
