import {
  Bell,
  BellRing,
  Mail,
  MessageCircle,
  Smartphone,
  type LucideIcon,
} from "@/assets/icons";
import type { StatusBadgeTone } from "@/shared/components/data-display";

import {
  COMMUNICATION_CHANNELS,
  NOTIFICATION_CATEGORIES,
  TEMPLATE_STATUSES,
  type CommunicationChannel,
  type NotificationCategory,
  type TemplateStatus,
} from "./types/template.dto";
import { DELIVERY_STATUSES, type DeliveryStatus } from "./types/delivery-log.dto";
import { PROVIDER_TYPES } from "./types/settings.dto";
import {
  NOTIFICATION_PRIORITIES,
  type NotificationPriority,
} from "./types/notification.dto";

/** Filter value meaning "don't narrow on this field". */
export const ANY = "ANY";

/** Rows per page for the (client-filtered) Templates Directory. */
export const TEMPLATE_DIRECTORY_PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

export const CHANNEL_ICON: Record<CommunicationChannel, LucideIcon> = {
  EMAIL: Mail,
  SMS: Smartphone,
  WHATSAPP: MessageCircle,
  PUSH: BellRing,
  IN_APP: Bell,
};

export const CHANNEL_LABEL: Record<CommunicationChannel, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  PUSH: "Push",
  IN_APP: "In-app",
};

export const CHANNEL_OPTIONS = [
  { value: ANY, label: "All channels" },
  ...COMMUNICATION_CHANNELS.map((channel) => ({
    value: channel,
    label: CHANNEL_LABEL[channel],
  })),
];

/** A channel value from a live record, which may be one this module has never seen. */
export function channelLabel(channel: string | undefined): string {
  if (!channel) return "—";
  return CHANNEL_LABEL[channel as CommunicationChannel] ?? channel;
}

export function channelIcon(channel: string | undefined): LucideIcon | undefined {
  return channel ? CHANNEL_ICON[channel as CommunicationChannel] : undefined;
}

// ---------------------------------------------------------------------------
// Notification / template category
// ---------------------------------------------------------------------------

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  AUTHENTICATION: "Authentication",
  ACADEMIC: "Academic",
  ADMISSIONS: "Admissions",
  FEES: "Fees",
  ANNOUNCEMENT: "Announcement",
  SYSTEM: "System",
};

export const CATEGORY_OPTIONS = NOTIFICATION_CATEGORIES.map((category) => ({
  value: category,
  label: CATEGORY_LABEL[category],
}));

export function categoryLabel(category: string | undefined): string {
  if (!category) return "—";
  return CATEGORY_LABEL[category as NotificationCategory] ?? category;
}

// ---------------------------------------------------------------------------
// Template status — DRAFT neutral, PUBLISHED success, ARCHIVED muted
// ---------------------------------------------------------------------------

export const TEMPLATE_STATUS_TONE: Record<TemplateStatus, StatusBadgeTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

export const TEMPLATE_STATUS_LABEL: Record<TemplateStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const TEMPLATE_STATUS_OPTIONS = [
  { value: ANY, label: "All statuses" },
  ...TEMPLATE_STATUSES.map((status) => ({
    value: status,
    label: TEMPLATE_STATUS_LABEL[status],
  })),
];

export function templateStatusTone(status: string | undefined): StatusBadgeTone {
  if (!status) return "neutral";
  return TEMPLATE_STATUS_TONE[status as TemplateStatus] ?? "neutral";
}

// ---------------------------------------------------------------------------
// Delivery status — tone-mapped per docs/communication-module-ui-spec.md §12
// ---------------------------------------------------------------------------

const DELIVERY_STATUS_TONE_MAP: Record<DeliveryStatus, StatusBadgeTone> = {
  SENT: "success",
  DELIVERED: "success",
  FAILED: "danger",
  BOUNCED: "danger",
  PENDING: "neutral",
  QUEUED: "neutral",
  RETRIED: "neutral",
  OPENED: "info",
  CLICKED: "info",
};

export function deliveryStatusTone(status: string | undefined): StatusBadgeTone {
  if (!status) return "neutral";
  return DELIVERY_STATUS_TONE_MAP[status as DeliveryStatus] ?? "neutral";
}

export const DELIVERY_STATUS_OPTIONS = [
  { value: ANY, label: "All statuses" },
  ...DELIVERY_STATUSES.map((status) => ({ value: status, label: status })),
];

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const PROVIDER_OPTIONS = PROVIDER_TYPES.map((provider) => ({
  value: provider,
  label: provider.replaceAll("_", " "),
}));

/** Only SMTP has a real backend implementation — see the settings screen's caption. */
export const LIVE_PROVIDERS: readonly string[] = ["SMTP"];

// ---------------------------------------------------------------------------
// Notification priority
// ---------------------------------------------------------------------------

export const PRIORITY_TONE: Record<NotificationPriority, StatusBadgeTone> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "danger",
};

export const PRIORITY_OPTIONS = NOTIFICATION_PRIORITIES.map((priority) => ({
  value: priority,
  label: priority.charAt(0) + priority.slice(1).toLowerCase(),
}));

// ---------------------------------------------------------------------------
// Delivery log date-range presets — mirrors the audit module's
// ---------------------------------------------------------------------------

export const DATE_PRESETS = [
  { value: "ALL", label: "All time", days: null },
  { value: "24H", label: "Last 24 hours", days: 1 },
  { value: "7D", label: "Last 7 days", days: 7 },
  { value: "30D", label: "Last 30 days", days: 30 },
  { value: "90D", label: "Last 90 days", days: 90 },
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number]["value"];

/**
 * The audit event map documents no `communication.*` event — so an activity
 * trail embedded on the overview screen would have nothing to show. See
 * `docs/backend-gaps.md` conventions: this module records the gap rather than
 * pinning a trail that would silently render empty.
 */
export const COMMUNICATION_AUDIT_MODULE = "SYSTEM";
