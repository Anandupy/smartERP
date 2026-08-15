/**
 * Wire shapes for `POST /communication/notifications` — documented as
 * "Create an In-app Notification (Admin/Service Use)".
 *
 * This is deliberately **not** a multi-channel send. The spec (§0, §2B) is
 * explicit that no broadcast, campaign or ad-hoc SMS/WhatsApp/email endpoint
 * exists anywhere in the collection; this one call creates a single row in one
 * user's in-app inbox. `userId` is required, so it can never address more than
 * one recipient per call — the Send Notification screen states this rather
 * than implying a broader reach.
 */

export const NOTIFICATION_PRIORITIES = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const NOTIFICATION_STATUSES = ["UNREAD", "READ", "ARCHIVED"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/** Body for `POST /communication/notifications` — the ten documented fields. */
export interface CreateNotificationRequest {
  userId: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  isPinned: boolean;
  organizationId: string | null;
  branchId: string | null;
}

/**
 * The created notification, per the Postman response example's field names.
 * All optional past `id`: the example is the schema generator's placeholder,
 * so no field's presence is proven.
 */
export interface InAppNotificationDto {
  id: string;
  organizationId?: string | null;
  branchId?: string | null;
  userId?: string;
  title?: string;
  content?: string;
  category?: string;
  priority?: string;
  status?: NotificationStatus | string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: string | null;
  isPinned?: boolean;
  readAt?: string | null;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
