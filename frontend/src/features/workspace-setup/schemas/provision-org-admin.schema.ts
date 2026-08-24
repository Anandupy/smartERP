import { z } from "zod";

import { isValidE164, DEFAULT_PHONE_COUNTRY_CODE } from "@/lib";
import {
  emailSchema,
  nonEmptyString,
  phoneCountryCodeSchema,
  phoneNumberSchema,
} from "@/schemas";

/**
 * Form schema for provisioning an `ORG_ADMIN`.
 *
 * Mirrors `CreateUserDto`'s own validation exactly (`@Matches` on username,
 * `@MinLength(8)` on password) rather than inventing stricter frontend rules —
 * see the same principle documented in `system-settings.schema.ts`. Phone is
 * the one field validated in two parts and re-combined by a `superRefine`:
 * `CreateUserDto.phone` requires E.164, which `PhoneField`'s two inputs never
 * hold directly — see `@/lib/phone`.
 */
export const provisionOrgAdminFormSchema = z
  .object({
    fullName: nonEmptyString,
    username: z
      .string()
      .trim()
      .min(1, "Required")
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only"),
    email: emailSchema,
    phoneCountryCode: phoneCountryCodeSchema,
    phoneNumber: phoneNumberSchema,
    password: z.string().min(8, "Must be at least 8 characters"),
    /** Empty string means "no organization yet" — sent as `undefined`. */
    organizationId: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!isValidE164(values.phoneCountryCode + values.phoneNumber)) {
      ctx.addIssue({
        code: "custom",
        path: ["phoneNumber"],
        message: "Enter a valid phone number, including the country code",
      });
    }
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
    phoneCountryCode: DEFAULT_PHONE_COUNTRY_CODE,
    phoneNumber: "",
    password: "",
    organizationId,
  };
}
