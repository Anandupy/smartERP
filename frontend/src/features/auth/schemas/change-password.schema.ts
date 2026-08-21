import { z } from "zod";

import { PASSWORD_RULES } from "@/lib";

/**
 * Change-password form. Maps to `POST /auth/change-password`, the
 * authenticated counterpart to the token-based `reset-password` recovery
 * flow — it requires the account's current password instead of an emailed
 * token.
 *
 * The new-password rules are read from the same `lib/password-strength`
 * source `resetPasswordFormSchema` uses, so the two flows can never disagree
 * about policy. The backend's own floor is looser (`MinLength(8)` on
 * `ChangePasswordDto`) — this schema enforces the stricter UX policy the app
 * advertises everywhere else, which always satisfies the backend's.
 */
export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    // `ZodType` defaults its Input parameter to `unknown`, which would erase
    // the form's input type through the chain — pin both sides to `string`.
    newPassword: PASSWORD_RULES.reduce(
      (schema, rule) => schema.refine(rule.test, { message: rule.label }),
      z.string().min(1, "Enter a new password") as z.ZodType<string, string>,
    ),
    confirmPassword: z.string().min(1, "Re-enter your new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;

export const changePasswordFormDefaults: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};
