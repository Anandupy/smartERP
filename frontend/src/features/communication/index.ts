/**
 * Public surface of the Communication module.
 *
 * Scope: `/communication` — message templates, in-app notification creation,
 * delivery logs, delivery analytics and channel/provider settings. Built
 * against `docs/communication-module-ui-spec.md`, which read the backend's
 * Prisma models, controllers and Postman collection directly.
 *
 * **What is wired:** template CRUD-minus-delete plus server-side preview
 * rendering; delivery-log query and analytics; settings read/update; a
 * single-recipient in-app notification create.
 *
 * **What is deliberately absent, and marked with `BackendPendingNote` where
 * the Stitch-style brief implied it:** any broadcast/campaign/multi-channel
 * send, scheduling, an audience builder, provider credential configuration,
 * template delete/duplicate/version-history, a delivery-log detail endpoint,
 * and time-series/per-channel/per-provider analytics. None of these have a
 * documented endpoint — see the module doc's §0 and §13 for the full
 * inventory. The notification inbox, bell panel and per-user preferences
 * screens are real, documented endpoints too, but are out of this module's
 * scope (they are the "personal surface", not an admin screen) and ship in a
 * later phase.
 *
 * **Scope is ambient**, exactly as the Academic Unit and Program modules
 * treat it: `useCommunicationScope` reads the active organization and branch
 * from `useWorkspace()`, and no screen asks a user to type either id.
 */

// Screens
export {
  CommunicationOverviewScreen,
} from "./components/communication-overview-screen";
export {
  TemplatesDirectoryScreen,
} from "./components/templates/templates-directory-screen";
export {
  TemplateDetailsScreen,
  type TemplateDetailsScreenProps,
} from "./components/templates/template-details-screen";
export { CreateTemplateScreen } from "./components/templates/create-template-screen";
export {
  EditTemplateScreen,
  type EditTemplateScreenProps,
} from "./components/templates/edit-template-screen";
export { DeliveryLogsScreen } from "./components/delivery-logs/delivery-logs-screen";
export {
  CommunicationAnalyticsScreen,
} from "./components/analytics/communication-analytics-screen";
export {
  CommunicationSettingsScreen,
} from "./components/settings/communication-settings-screen";
export {
  SendNotificationScreen,
} from "./components/notifications/send-notification-screen";

// Composable pieces
export { ChannelBadge, type ChannelBadgeProps } from "./components/channel-badge";
export {
  TemplateStatusBadge,
  type TemplateStatusBadgeProps,
} from "./components/template-status-badge";
export {
  DeliveryStatusBadge,
  type DeliveryStatusBadgeProps,
} from "./components/delivery-status-badge";
export {
  CommunicationNoScopeState,
} from "./components/communication-scope-gate";
export { TemplateForm, type TemplateFormProps } from "./components/templates/template-form";
export { TemplatesTable, type TemplatesTableProps } from "./components/templates/templates-table";
export {
  TemplatePreviewDrawer,
  type TemplatePreviewDrawerProps,
} from "./components/templates/template-preview-drawer";
export {
  DeliveryLogTable,
  type DeliveryLogTableProps,
} from "./components/delivery-logs/delivery-log-table";
export {
  DeliveryLogDetailDrawer,
  type DeliveryLogDetailDrawerProps,
} from "./components/delivery-logs/delivery-log-detail-drawer";
export {
  CommunicationSettingsForm,
  type CommunicationSettingsFormProps,
} from "./components/settings/communication-settings-form";

// Backend integration
export { communicationService } from "./api/communication.service";
export { communicationKeys } from "./api/communication.keys";
export {
  useCommunicationScope,
  type CommunicationScope,
} from "./hooks/use-communication-scope";
export {
  useCreateTemplate,
  useTemplate,
  useTemplatePreview,
  useTemplates,
  useUpdateTemplate,
} from "./hooks/use-templates";
export { useDeliveryLogs } from "./hooks/use-delivery-logs";
export { useDeliveryAnalytics } from "./hooks/use-delivery-analytics";
export {
  useCommunicationSettings,
  useUpdateCommunicationSettings,
} from "./hooks/use-communication-settings";
export { useSendNotification } from "./hooks/use-send-notification";
export {
  fromVariablesText,
  TEMPLATE_SCOPE_LABEL,
  templateScopeLevel,
  toTemplateFormValues,
  toTemplateRequest,
  toVariablesText,
  type TemplateScopeLevel,
} from "./mappers/template.mapper";
export {
  toSettingsFormValues,
  toSettingsRequest,
} from "./mappers/settings.mapper";
export {
  countActiveDeliveryLogFilters,
  deliveryLogFilterDefaults,
  toDeliveryLogQuery,
  type DeliveryLogFilters,
} from "./utils/delivery-log-query";

// Contracts
export {
  COMMUNICATION_CHANNELS,
  NOTIFICATION_CATEGORIES,
  TEMPLATE_STATUSES,
  type CommunicationChannel,
  type NotificationCategory,
  type TemplateDto,
  type TemplateListQuery,
  type TemplatePreviewRequest,
  type TemplatePreviewResponse,
  type TemplateStatus,
  type TemplateWriteRequest,
} from "./types/template.dto";
export {
  DELIVERY_STATUSES,
  DELIVERY_LOG_PAGE_SIZE_DEFAULT,
  DELIVERY_LOG_PAGE_SIZE_MAX,
  type DeliveryLogDto,
  type DeliveryLogQuery,
  type DeliveryStatus,
} from "./types/delivery-log.dto";
export type {
  DeliveryAnalyticsDto,
  DeliveryAnalyticsQuery,
} from "./types/analytics.dto";
export {
  PROVIDER_TYPES,
  type CommunicationSettingsDto,
  type CommunicationSettingsQuery,
  type CommunicationSettingsWriteRequest,
  type ProviderType,
} from "./types/settings.dto";
export {
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_STATUSES,
  type CreateNotificationRequest,
  type InAppNotificationDto,
  type NotificationPriority,
  type NotificationStatus,
} from "./types/notification.dto";
export {
  templateFormDefaults,
  templateFormSchema,
  type TemplateFormValues,
} from "./schemas/template.schema";
export {
  communicationSettingsFormSchema,
  type CommunicationSettingsFormValues,
} from "./schemas/settings.schema";
export {
  sendNotificationFormDefaults,
  sendNotificationFormSchema,
  type SendNotificationFormValues,
} from "./schemas/notification.schema";
export {
  ANY,
  CATEGORY_OPTIONS,
  CHANNEL_OPTIONS,
  COMMUNICATION_AUDIT_MODULE,
  DATE_PRESETS,
  DELIVERY_STATUS_OPTIONS,
  LIVE_PROVIDERS,
  PRIORITY_OPTIONS,
  PROVIDER_OPTIONS,
  TEMPLATE_DIRECTORY_PAGE_SIZE,
  TEMPLATE_STATUS_OPTIONS,
  categoryLabel,
  channelLabel,
  templateStatusTone,
  deliveryStatusTone,
  type DatePreset,
} from "./constants";
