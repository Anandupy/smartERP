import { z } from "zod";

import { emailSchema } from "@/schemas";

/**
 * Login credentials.
 *
 * Client-side validation is a UX affordance only — it shapes the message the
 * user sees first. The backend remains the authority, and its field errors are
 * bound back onto this form via `applyServerFieldErrors`.
 */
export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
  rememberMe: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const loginFormDefaults: LoginFormValues = {
  email: "",
  password: "",
  rememberMe: false,
};
