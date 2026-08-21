import { http, HttpResponse } from "msw";

import { apiConfig } from "@/config";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import {
  healthCheckResultDto,
  livenessDto,
  menuDetailDto,
  menuListItemDto,
  moduleDetailDto,
  moduleListItemDto,
  navigationTreeDto,
  secondModuleListItemDto,
  setupStatusDto,
  workspaceConfigurationDto,
} from "@tests/fixtures/workspace-admin";

/**
 * Default MSW handlers for the Workspace Admin module.
 *
 * `/live`, `/ready` and `/health` are matched against `apiConfig.root`
 * (unversioned) — every other route here is matched against
 * `apiConfig.baseURL` (`/v1`-relative), matching exactly how
 * `health.service.ts` calls them with an explicit `baseURL` override.
 */
const base = apiConfig.baseURL.replace(/\/$/, "");
const root = apiConfig.root.replace(/\/$/, "");

export const workspaceAdminHandlers = [
  // Modules
  http.get(`${base}/admin/navigation/modules`, () =>
    HttpResponse.json(
      successEnvelope([moduleListItemDto(), secondModuleListItemDto()]),
    ),
  ),
  http.get(`${base}/admin/navigation/modules/:id`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(moduleDetailDto({ id: String(params.id) })),
    ),
  ),
  http.post(`${base}/admin/navigation/modules`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope({ ...moduleDetailDto(), ...body }),
      { status: 201 },
    );
  }),
  http.patch(`${base}/admin/navigation/modules/:id/status`, async ({ request, params }) => {
    const body = (await request.json()) as { isActive: boolean };
    return HttpResponse.json(
      successEnvelope(moduleDetailDto({ id: String(params.id), isActive: body.isActive })),
    );
  }),
  http.patch(`${base}/admin/navigation/modules/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(moduleDetailDto({ ...body, id: String(params.id) })),
    );
  }),
  http.delete(`${base}/admin/navigation/modules/:id`, () =>
    HttpResponse.json(successEnvelope({ success: true })),
  ),

  // Menus
  http.get(`${base}/admin/navigation/menus`, () =>
    HttpResponse.json(successEnvelope([menuListItemDto()])),
  ),
  http.get(`${base}/admin/navigation/menus/:id`, ({ params }) =>
    HttpResponse.json(successEnvelope(menuDetailDto({ id: String(params.id) }))),
  ),
  http.post(`${base}/admin/navigation/menus`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope({ ...menuDetailDto(), ...body }), {
      status: 201,
    });
  }),
  http.patch(`${base}/admin/navigation/menus/:id/move`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope({ ...menuDetailDto({ id: String(params.id) }), ...body }),
    );
  }),
  http.patch(`${base}/admin/navigation/menus/:id/status`, async ({ request, params }) => {
    const body = (await request.json()) as { status: string };
    return HttpResponse.json(
      successEnvelope(menuDetailDto({ id: String(params.id), status: body.status as never })),
    );
  }),
  http.post(`${base}/admin/navigation/menus/:id/duplicate`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(
        menuDetailDto({
          id: `${String(params.id)}-copy`,
          code: "ADMISSIONS_APPLICANTS_COPY_0001",
          status: "DISABLED",
        }),
      ),
      { status: 201 },
    ),
  ),
  http.put(`${base}/admin/navigation/menus/reorder`, () =>
    HttpResponse.json(successEnvelope({ success: true })),
  ),
  http.patch(`${base}/admin/navigation/menus/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope({ ...menuDetailDto({ id: String(params.id) }), ...body }),
    );
  }),
  http.delete(`${base}/admin/navigation/menus/:id`, () =>
    HttpResponse.json(successEnvelope({ success: true })),
  ),

  // Navigation, configuration, setup
  http.get(`${base}/workspace/navigation`, () =>
    HttpResponse.json(successEnvelope(navigationTreeDto())),
  ),
  http.post(`${base}/workspace/configuration`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(workspaceConfigurationDto(body as never)),
      { status: 201 },
    );
  }),
  // Default: no layer has been defined for any scope yet. Tests that need an
  // existing layer override this with `server.use(...)`.
  http.get(`${base}/workspace/configuration/:scopeType`, () =>
    HttpResponse.json(
      errorEnvelope({
        code: "NOT_FOUND",
        message: "No configuration layer exists for this scope",
      }),
      { status: 404 },
    ),
  ),
  http.get(`${base}/workspace/setup/status`, () =>
    HttpResponse.json(successEnvelope(setupStatusDto())),
  ),

  // Health — unversioned, unauthenticated.
  http.get(`${root}/live`, () =>
    HttpResponse.json(successEnvelope(livenessDto())),
  ),
  http.get(`${root}/ready`, () =>
    HttpResponse.json(successEnvelope(healthCheckResultDto())),
  ),
  http.get(`${root}/health`, () =>
    HttpResponse.json(successEnvelope(healthCheckResultDto())),
  ),
];
