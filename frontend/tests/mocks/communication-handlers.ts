import { http, HttpResponse } from "msw";

import { apiConfig } from "@/config";

import {
  communicationSettingsDto,
  deliveryAnalyticsDto,
  deliveryLogDto,
  failedDeliveryLogDto,
  inAppNotificationDto,
  publishedTemplateDto,
  templateDto,
} from "@tests/fixtures/communication";
import { successEnvelope } from "@tests/fixtures/api";

/**
 * Default MSW handlers for the Communication module.
 *
 * Happy paths matching the documented request contracts — see
 * `docs/communication-module-ui-spec.md`. Failure scenarios (409 on preview,
 * a rejected settings write) are declared per test with `server.use(...)`.
 *
 * The delivery-log list answers with the documented flat pagination shape —
 * `total`/`page`/`limit`/`totalPages` directly on the envelope's `meta`, not
 * nested under `meta.pagination` and not inside `data` — see
 * `types/delivery-log.dto.ts`.
 */
const base = apiConfig.baseURL.replace(/\/$/, "");

export const communicationHandlers = [
  // Templates — `preview` must precede the bare `GET /:id`.
  http.post(`${base}/communication/templates/preview`, async ({ request }) => {
    const body = (await request.json()) as {
      variables?: Record<string, unknown>;
    };
    const supplied = Object.entries(body.variables ?? {})
      .filter(
        ([, value]) => typeof value === "string" && value.trim().length > 0,
      )
      .map(([name]) => name);
    return HttpResponse.json(
      successEnvelope({
        subject: "Reset Your Password",
        bodyHtml: "<p>Hello Test User</p>",
        bodyText: "Hello Test User",
        missingVariables: ["resetLink", "minutes"].filter(
          (name) => !supplied.includes(name),
        ),
      }),
      { status: 201 },
    );
  }),
  http.get(`${base}/communication/templates/:id`, ({ params }) =>
    HttpResponse.json(successEnvelope(templateDto({ id: String(params.id) }))),
  ),
  http.get(`${base}/communication/templates`, () =>
    HttpResponse.json(successEnvelope([templateDto(), publishedTemplateDto()])),
  ),
  http.post(`${base}/communication/templates`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope(templateDto(body)), {
      status: 201,
    });
  }),
  http.patch(
    `${base}/communication/templates/:id`,
    async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        successEnvelope(templateDto({ ...body, id: String(params.id) })),
      );
    },
  ),

  // Delivery logs
  http.get(`${base}/communication/delivery-logs/analytics`, () =>
    HttpResponse.json(successEnvelope(deliveryAnalyticsDto())),
  ),
  http.get(`${base}/communication/delivery-logs`, () =>
    HttpResponse.json(
      successEnvelope([deliveryLogDto(), failedDeliveryLogDto()], {
        meta: { total: 2, page: 1, limit: 25, totalPages: 1 },
      }),
    ),
  ),

  // Settings
  http.get(`${base}/communication/settings`, () =>
    HttpResponse.json(successEnvelope(communicationSettingsDto())),
  ),
  http.patch(`${base}/communication/settings`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(communicationSettingsDto(body), {
        message: "Settings updated",
      }),
    );
  }),

  // Notifications
  http.post(`${base}/communication/notifications`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope(inAppNotificationDto(body)), {
      status: 201,
    });
  }),
];
