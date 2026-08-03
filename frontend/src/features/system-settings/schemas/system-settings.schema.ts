import { z } from "zod";

import { emailSchema, nonEmptyString } from "@/schemas";

import { SYSTEM_ENVIRONMENTS } from "../types/system-settings.dto";

/**
 * Form schemas for system settings.
 *
 * The backend documents **types and one enum**, and no validation rules —
 * no lengths, no formats, no patterns. So these schemas assert exactly what
 * the documented data structure asserts (a required string is required, the
 * environment is one of three values) and nothing more. Anything stricter
 * would be a rule the frontend made up, and the first legitimate value it
 * rejected would be a bug with no backend to blame.
 *
 * Server-side rules still reach the user: a failed write comes back as an
 * `ApiError` with `fieldErrors`, which `applyServerFieldErrors` binds to the
 * offending field.
 */

/** `GET`/`PATCH` identity fields — the General Settings screen. */
export const generalSettingsFormSchema = z.object({
  productName: nonEmptyString,
  productCode: nonEmptyString,
  version: nonEmptyString,
  environment: z.enum(SYSTEM_ENVIRONMENTS),
});

export type GeneralSettingsFormValues = z.infer<
  typeof generalSettingsFormSchema
>;

/** Maintenance mode and support channels — the Maintenance & Support screen. */
export const maintenanceSupportFormSchema = z.object({
  maintenanceMode: z.boolean(),
  /**
   * Documented as optional, so an empty box is valid. It is sent as `null`
   * rather than `""` — see the mapper.
   */
  maintenanceMessage: z.string().trim(),
  supportEmail: emailSchema,
  supportPhone: nonEmptyString,
});

export type MaintenanceSupportFormValues = z.infer<
  typeof maintenanceSupportFormSchema
>;

/**
 * First-time initialization: every documented field at once, since `POST
 * /system-settings/init` takes the whole record and runs only once.
 */
export const initSettingsFormSchema = generalSettingsFormSchema.extend(
  maintenanceSupportFormSchema.shape,
);

export type InitSettingsFormValues = z.infer<typeof initSettingsFormSchema>;

/** Defaults for the initialization form. Blank, never pre-filled with samples. */
export const initSettingsFormDefaults: InitSettingsFormValues = {
  productName: "",
  productCode: "",
  version: "",
  environment: "DEV",
  maintenanceMode: false,
  maintenanceMessage: "",
  supportEmail: "",
  supportPhone: "",
};
