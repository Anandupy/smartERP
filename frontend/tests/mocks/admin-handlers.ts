import { http, HttpResponse } from "msw";

import { apiConfig } from "@/config";

import { successEnvelope } from "@tests/fixtures/api";
import { auditLogDto } from "@tests/fixtures/audit";
import { maintenanceRuleDto } from "@tests/fixtures/maintenance";
import { systemSettingsDto } from "@tests/fixtures/system-settings";

/**
 * Default MSW handlers for the three administration modules.
 *
 * Happy paths only, matching the documented request contracts. Failure
 * scenarios — an uninitialized installation, an unreadable summary payload, a
 * rejected write — are declared per test with `server.use(...)`.
 *
 * The summary and timeline handlers deliberately answer in *one* of the shapes
 * the undocumented endpoints might use. That is what the defensive readers
 * exist for, and the unit tests cover the other shapes directly.
 */
const base = apiConfig.baseURL.replace(/\/$/, "");

export const adminHandlers = [
  // System settings
  http.get(`${base}/system-settings`, () =>
    HttpResponse.json(successEnvelope(systemSettingsDto())),
  ),
  http.patch(`${base}/system-settings`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(systemSettingsDto(body), { message: "Settings updated" }),
    );
  }),
  http.post(`${base}/system-settings/init`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope(systemSettingsDto(body)), {
      status: 201,
    });
  }),

  // Maintenance rules
  http.get(`${base}/maintenance-rules`, () =>
    HttpResponse.json(successEnvelope([maintenanceRuleDto()])),
  ),
  http.get(`${base}/maintenance-rules/active/status`, () =>
    HttpResponse.json(successEnvelope({})),
  ),
  http.get(`${base}/maintenance-rules/:id`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(maintenanceRuleDto({ id: String(params.id) })),
    ),
  ),
  http.post(`${base}/maintenance-rules`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope(maintenanceRuleDto(body)), {
      status: 201,
    });
  }),
  http.patch(`${base}/maintenance-rules/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(maintenanceRuleDto({ ...body, id: String(params.id) })),
    );
  }),
  http.delete(`${base}/maintenance-rules/:id`, () =>
    HttpResponse.json(successEnvelope(null)),
  ),

  // Audit logs — order matters: the fixed segments must precede `:id`.
  http.get(`${base}/audit-logs/summary`, () =>
    HttpResponse.json(
      successEnvelope({
        total: 1,
        byModule: [{ module: "SYSTEM", count: 1 }],
        byAction: [{ action: "UPDATE", count: 1 }],
        bySeverity: [],
        byStatus: [],
      }),
    ),
  ),
  http.get(`${base}/audit-logs/timeline`, () =>
    HttpResponse.json(
      successEnvelope({ daily: [{ date: "2026-08-01", count: 1 }] }),
    ),
  ),
  http.get(`${base}/audit-logs/:id`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(
        auditLogDto({
          id: String(params.id),
          changes: [
            { field: "maintenanceMode", oldValue: false, newValue: true },
          ],
          metadata: { source: "test" },
        }),
      ),
    ),
  ),
  http.get(`${base}/audit-logs`, () =>
    HttpResponse.json(
      successEnvelope([auditLogDto()], {
        meta: {
          pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
        },
      }),
    ),
  ),
];
