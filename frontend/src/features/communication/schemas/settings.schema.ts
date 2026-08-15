import { z } from "zod";

import { nonEmptyString } from "@/schemas";

/**
 * Form schema for Communication Settings — the twelve documented writable
 * fields (`types/settings.dto.ts`), one to one. Providers are validated only
 * as non-empty: the documented value set (`PROVIDER_TYPES`) drives the
 * `SelectField` options, so the schema's job is just to reject an empty
 * selection, not to re-assert the enum the control already enforces.
 */
export const communicationSettingsFormSchema = z.object({
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  otpEnabled: z.boolean(),
  trackingEnabled: z.boolean(),
  analyticsEnabled: z.boolean(),
  retryEnabled: z.boolean(),
  defaultEmailProvider: nonEmptyString,
  defaultSmsProvider: nonEmptyString,
  defaultWhatsappProvider: nonEmptyString,
  defaultPushProvider: nonEmptyString,
});

export type CommunicationSettingsFormValues = z.infer<
  typeof communicationSettingsFormSchema
>;
