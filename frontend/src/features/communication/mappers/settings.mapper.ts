import type { CommunicationSettingsFormValues } from "../schemas/settings.schema";
import type {
  CommunicationSettingsDto,
  CommunicationSettingsWriteRequest,
} from "../types/settings.dto";

/**
 * The only translation between the settings form and the wire.
 *
 * Booleans default `true` when unreported — the doc states `GET` answers with
 * defaults (all `true`) rather than `404` when nothing has been saved, so an
 * absent flag here means "the documented default", never "off".
 */
export function toSettingsFormValues(
  settings: CommunicationSettingsDto,
): CommunicationSettingsFormValues {
  return {
    emailEnabled: settings.emailEnabled ?? true,
    smsEnabled: settings.smsEnabled ?? true,
    whatsappEnabled: settings.whatsappEnabled ?? true,
    pushEnabled: settings.pushEnabled ?? true,
    otpEnabled: settings.otpEnabled ?? true,
    trackingEnabled: settings.trackingEnabled ?? true,
    analyticsEnabled: settings.analyticsEnabled ?? true,
    retryEnabled: settings.retryEnabled ?? true,
    defaultEmailProvider: settings.defaultEmailProvider ?? "SMTP",
    defaultSmsProvider: settings.defaultSmsProvider ?? "CUSTOM",
    defaultWhatsappProvider: settings.defaultWhatsappProvider ?? "META_WHATSAPP",
    defaultPushProvider: settings.defaultPushProvider ?? "FIREBASE_FCM",
  };
}

/**
 * Form values → the complete documented request body. No partial-update rule
 * is documented, so every write rebuilds all twelve fields rather than
 * diffing against what changed.
 */
export function toSettingsRequest(
  values: CommunicationSettingsFormValues,
): CommunicationSettingsWriteRequest {
  return { ...values };
}
