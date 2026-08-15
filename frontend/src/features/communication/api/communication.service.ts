import { api } from "@/core/api";
import { compact } from "@/utils";

import type {
  DeliveryAnalyticsDto,
  DeliveryAnalyticsQuery,
} from "../types/analytics.dto";
import type { DeliveryLogDto, DeliveryLogQuery } from "../types/delivery-log.dto";
import type {
  CreateNotificationRequest,
  InAppNotificationDto,
} from "../types/notification.dto";
import type {
  CommunicationSettingsDto,
  CommunicationSettingsQuery,
  CommunicationSettingsWriteRequest,
} from "../types/settings.dto";
import type {
  CommunicationChannel,
  TemplateDto,
  TemplateListQuery,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
  TemplateWriteRequest,
} from "../types/template.dto";

/**
 * Transport for `/communication`.
 *
 * Written out rather than built from `createResourceService`: every list here
 * documents its own query parameters and its own pagination convention, and
 * two resources (settings, analytics) are singletons addressed by scope query
 * parameters rather than by id — the factory's shape would not fit either.
 *
 * Paths carry no version segment — the client resolves them against the
 * configured `<origin>/v1` base.
 */
export const communicationService = {
  // -- Templates -------------------------------------------------------

  /** `GET /communication/templates?channel=&status=&search=`. No pagination is documented. */
  templates: {
    list: (query: TemplateListQuery = {}) =>
      api.get<TemplateDto[]>("/communication/templates", {
        params: compact(query),
      }),

    /** `GET /communication/templates/:id`. */
    get: (id: string) => api.get<TemplateDto>(`/communication/templates/${id}`),

    /** `POST /communication/templates`. SUPER_ADMIN / ORG_ADMIN per the spec's role matrix. */
    create: (body: TemplateWriteRequest) =>
      api.post<TemplateDto, TemplateWriteRequest>(
        "/communication/templates",
        body,
      ),

    /**
     * `PATCH /communication/templates/:id`. The documented body is identical
     * to create's — the whole record, not a partial one.
     */
    update: (id: string, body: TemplateWriteRequest) =>
      api.patch<TemplateDto, TemplateWriteRequest>(
        `/communication/templates/${id}`,
        body,
      ),

    /**
     * `POST /communication/templates/preview?channel=`.
     *
     * Identifies the template by `templateId` **or** `code`; the backend
     * rejects neither being present with `409`. Returns `201` on success.
     */
    preview: (
      body: TemplatePreviewRequest,
      channel: CommunicationChannel,
    ) =>
      api.post<TemplatePreviewResponse, TemplatePreviewRequest>(
        "/communication/templates/preview",
        body,
        { params: { channel } },
      ),
  },

  // -- Delivery logs -----------------------------------------------------

  /**
   * `GET /communication/delivery-logs` → the page.
   *
   * Uses `getEnvelope`: pagination is documented flat on the envelope's
   * `meta` (`total`, `page`, `limit`, `totalPages`) rather than nested inside
   * `data` or under `meta.pagination` — see `types/delivery-log.dto.ts`.
   */
  deliveryLogs: {
    list: (query: DeliveryLogQuery = {}) =>
      api.getEnvelope<DeliveryLogDto[]>("/communication/delivery-logs", {
        params: compact(query),
      }),

    /**
     * `GET /communication/delivery-logs/analytics?organizationId=&branchId=`.
     * Six counters and three rates — no date range, no channel filter.
     */
    analytics: (query: DeliveryAnalyticsQuery) =>
      api.get<DeliveryAnalyticsDto>("/communication/delivery-logs/analytics", {
        params: compact(query),
      }),
  },

  // -- Settings ------------------------------------------------------------

  settings: {
    /**
     * `GET /communication/settings?organizationId=&branchId=`. Documented to
     * return defaults rather than `404` when nothing has been saved yet.
     */
    get: (query: CommunicationSettingsQuery) =>
      api.get<CommunicationSettingsDto>("/communication/settings", {
        params: compact(query),
      }),

    /**
     * `PATCH /communication/settings?organizationId=&branchId=`. Body is
     * always complete — see the mapper.
     */
    update: (
      query: CommunicationSettingsQuery,
      body: CommunicationSettingsWriteRequest,
    ) =>
      api.patch<CommunicationSettingsDto, CommunicationSettingsWriteRequest>(
        "/communication/settings",
        body,
        { params: compact(query) },
      ),
  },

  // -- Notifications ---------------------------------------------------

  /**
   * `POST /communication/notifications` — "Create an In-app Notification
   * (Admin/Service Use)". A single-recipient write; see the DTO comment for
   * why this is never represented as a broadcast.
   */
  notifications: {
    create: (body: CreateNotificationRequest) =>
      api.post<InAppNotificationDto, CreateNotificationRequest>(
        "/communication/notifications",
        body,
      ),
  },
} as const;
