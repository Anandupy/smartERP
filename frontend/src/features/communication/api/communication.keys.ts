import { createQueryKeys } from "@/core/query";

import type { DeliveryAnalyticsQuery } from "../types/analytics.dto";
import type { DeliveryLogQuery } from "../types/delivery-log.dto";
import type { CommunicationSettingsQuery } from "../types/settings.dto";
import type { TemplateListQuery } from "../types/template.dto";

/**
 * Query keys for the Communication module.
 *
 * Filters are part of every list/query key because the server does the
 * filtering — two different filter sets are two different responses. Settings
 * and analytics are keyed by scope for the same reason: they are singletons
 * *per organization/branch*, not globally, so the active workspace must be
 * part of the key or switching branches would show stale figures.
 */
const templatesBase = createQueryKeys("communication-templates");
const deliveryLogsBase = createQueryKeys("communication-delivery-logs");
const settingsBase = createQueryKeys("communication-settings");

export const communicationKeys = {
  templates: {
    ...templatesBase,
    list: (query: TemplateListQuery) =>
      ["communication-templates", "list", query] as const,
  },
  deliveryLogs: {
    ...deliveryLogsBase,
    list: (query: DeliveryLogQuery) =>
      ["communication-delivery-logs", "list", query] as const,
    analytics: (query: DeliveryAnalyticsQuery) =>
      ["communication-delivery-logs", "analytics", query] as const,
  },
  settings: {
    ...settingsBase,
    scope: (query: CommunicationSettingsQuery) =>
      ["communication-settings", "scope", query] as const,
  },
} as const;
