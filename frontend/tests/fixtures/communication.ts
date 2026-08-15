import type {
  CommunicationSettingsDto,
  DeliveryAnalyticsDto,
  DeliveryLogDto,
  InAppNotificationDto,
  TemplateDto,
} from "@/features/communication";

/** Builders for Communication module fixtures, matching the documented fields. */

export function templateDto(overrides: Partial<TemplateDto> = {}): TemplateDto {
  return {
    id: "template-1",
    organizationId: "org-1",
    branchId: "branch-1",
    code: "PASSWORD_RESET",
    name: "Password Reset Request Email",
    description: "Sent when a user requests a password reset.",
    channel: "EMAIL",
    category: "AUTHENTICATION",
    subject: "Reset Your Password",
    bodyHtml: "<p>Hello {{userName}}</p>",
    bodyText: "Hello {{userName}}",
    variables: ["userName", "resetLink", "minutes"],
    language: "en",
    version: 1,
    status: "DRAFT",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

export function publishedTemplateDto(
  overrides: Partial<TemplateDto> = {},
): TemplateDto {
  return templateDto({
    id: "template-2",
    code: "WELCOME_SMS",
    name: "Welcome SMS",
    channel: "SMS",
    category: "SYSTEM",
    subject: null,
    bodyHtml: null,
    bodyText: "Welcome, {{userName}}!",
    variables: ["userName"],
    status: "PUBLISHED",
    ...overrides,
  });
}

export function deliveryLogDto(
  overrides: Partial<DeliveryLogDto> = {},
): DeliveryLogDto {
  return {
    id: "log-1",
    organizationId: "org-1",
    branchId: "branch-1",
    channel: "EMAIL",
    provider: "SMTP",
    recipient: "student@example.com",
    subject: "Reset Your Password",
    templateId: "template-1",
    templateVersion: 1,
    status: "DELIVERED",
    latencyMs: 420,
    retryCount: 0,
    sentAt: "2026-01-05T10:00:00.000Z",
    deliveredAt: "2026-01-05T10:00:02.000Z",
    createdAt: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}

export function failedDeliveryLogDto(
  overrides: Partial<DeliveryLogDto> = {},
): DeliveryLogDto {
  return deliveryLogDto({
    id: "log-2",
    recipient: "parent@example.com",
    status: "FAILED",
    errorCode: "PROVIDER_TIMEOUT",
    errorMessage: "The provider did not respond in time.",
    deliveredAt: null,
    ...overrides,
  });
}

export function deliveryAnalyticsDto(
  overrides: Partial<DeliveryAnalyticsDto> = {},
): DeliveryAnalyticsDto {
  return {
    total: 100,
    sent: 100,
    delivered: 90,
    failed: 8,
    bounced: 2,
    metrics: {
      deliveryRate: 0.9,
      failureRate: 0.08,
      bounceRate: 0.02,
    },
    ...overrides,
  };
}

export function communicationSettingsDto(
  overrides: Partial<CommunicationSettingsDto> = {},
): CommunicationSettingsDto {
  return {
    id: "settings-1",
    organizationId: "org-1",
    branchId: "branch-1",
    emailEnabled: true,
    smsEnabled: true,
    whatsappEnabled: true,
    pushEnabled: true,
    otpEnabled: true,
    trackingEnabled: false,
    analyticsEnabled: true,
    retryEnabled: true,
    defaultEmailProvider: "SMTP",
    defaultSmsProvider: "CUSTOM",
    defaultWhatsappProvider: "META_WHATSAPP",
    defaultPushProvider: "FIREBASE_FCM",
    ...overrides,
  };
}

export function inAppNotificationDto(
  overrides: Partial<InAppNotificationDto> = {},
): InAppNotificationDto {
  return {
    id: "notification-1",
    organizationId: "org-1",
    branchId: "branch-1",
    userId: "user-1",
    title: "Fee due reminder",
    content: "Your fee installment is due tomorrow.",
    category: "FEES",
    priority: "NORMAL",
    status: "UNREAD",
    isPinned: false,
    createdAt: "2026-01-06T09:00:00.000Z",
    ...overrides,
  };
}
