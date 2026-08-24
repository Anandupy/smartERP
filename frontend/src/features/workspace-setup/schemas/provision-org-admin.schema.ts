import { z } from "zod";

import { emailSchema, nonEmptyString } from "@/schemas";

/**
 * Form schema for provisioning an `ORG_ADMIN`.
 *
 * Mirrors `CreateUserDto`'s own validation exactly (`@Matches` on username,
 * `@MinLength(8)` on password) rather than inventing stricter frontend rules —
 * see the same principle documented in `system-settings.schema.ts`.
 */
export const provisionOrgAdminFormSchema = z.object({
  fullName: nonEmptyString,
  username: z
    .string()
    .trim()
    .min(1, "Required")
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only"),
  email: emailSchema,
  phone: nonEmptyString,
  password: z.string().min(8, "Must be at least 8 characters"),
  /** Empty string means "no organization yet" — sent as `undefined`. */
  organizationId: z.string(),
});

export type ProvisionOrgAdminFormValues = z.infer<
  typeof provisionOrgAdminFormSchema
>;

export function provisionOrgAdminFormDefaults(
  organizationId = "",
): ProvisionOrgAdminFormValues {
  return {
    fullName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    organizationId,
  };
}
