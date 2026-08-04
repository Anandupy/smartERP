import { http, HttpResponse } from "msw";

import { apiConfig } from "@/config";

import {
  academicUnitDto,
  childUnitDto,
  secondChildUnitDto,
} from "@tests/fixtures/academic-unit";
import {
  academicYearDto,
  lockedAcademicYearDto,
} from "@tests/fixtures/academic-year";
import { successEnvelope } from "@tests/fixtures/api";
import { auditLogDto } from "@tests/fixtures/audit";
import { branchDto, secondBranchDto } from "@tests/fixtures/branch";
import { maintenanceRuleDto } from "@tests/fixtures/maintenance";
import {
  organizationDto,
  secondOrganizationDto,
} from "@tests/fixtures/organization";
import {
  childProgramDto,
  programDto,
  secondProgramDto,
} from "@tests/fixtures/program";
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

  // Organizations
  http.get(`${base}/organizations`, () =>
    HttpResponse.json(
      successEnvelope([organizationDto(), secondOrganizationDto()]),
    ),
  ),
  http.get(`${base}/organizations/:id`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(organizationDto({ id: String(params.id) })),
    ),
  ),
  http.post(`${base}/organizations`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope(organizationDto(body)), {
      status: 201,
    });
  }),
  http.patch(`${base}/organizations/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(organizationDto({ ...body, id: String(params.id) })),
    );
  }),
  http.delete(`${base}/organizations/:id`, () =>
    HttpResponse.json(successEnvelope(null)),
  ),

  // Branches — the fixed `organization` segment must precede `:id`.
  http.get(`${base}/branches/organization/:orgId`, () =>
    HttpResponse.json(successEnvelope([branchDto(), secondBranchDto()])),
  ),
  http.get(`${base}/branches/:id`, ({ params }) =>
    HttpResponse.json(successEnvelope(branchDto({ id: String(params.id) }))),
  ),
  http.get(`${base}/branches`, () =>
    HttpResponse.json(successEnvelope([branchDto(), secondBranchDto()])),
  ),
  http.post(`${base}/branches`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope(branchDto(body)), { status: 201 });
  }),
  http.patch(`${base}/branches/:id/status`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(branchDto({ id: String(params.id), isActive: false })),
    ),
  ),
  http.patch(`${base}/branches/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(branchDto({ ...body, id: String(params.id) })),
    );
  }),
  http.delete(`${base}/branches/:id`, () =>
    HttpResponse.json(successEnvelope(null)),
  ),

  // Academic years — the fixed `current` segment must precede `:id`, and the
  // three transition paths must precede the bare `PATCH /:id` update.
  http.get(`${base}/academic-years/current`, () =>
    HttpResponse.json(successEnvelope(academicYearDto())),
  ),
  http.get(`${base}/academic-years`, () =>
    HttpResponse.json(
      successEnvelope([academicYearDto(), lockedAcademicYearDto()]),
    ),
  ),
  http.post(`${base}/academic-years`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope(academicYearDto(body)), {
      status: 201,
    });
  }),
  http.patch(`${base}/academic-years/:id/activate`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(
        academicYearDto({ id: String(params.id), isActive: true }),
      ),
    ),
  ),
  http.patch(`${base}/academic-years/:id/select`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(
        academicYearDto({ id: String(params.id), isSelected: true }),
      ),
    ),
  ),
  http.patch(`${base}/academic-years/:id/lock`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(
        academicYearDto({ id: String(params.id), isLocked: true }),
      ),
    ),
  ),
  http.patch(`${base}/academic-years/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(academicYearDto({ ...body, id: String(params.id) })),
    );
  }),
  http.delete(`${base}/academic-years/:id`, () =>
    HttpResponse.json(successEnvelope(null)),
  ),

  // Programs — the fixed `tree` segment must precede `:id`, and `:id/status`
  // must precede the bare `PATCH /:id`.
  http.get(`${base}/programs/tree`, () =>
    HttpResponse.json(
      successEnvelope([
        { ...programDto(), children: [childProgramDto()] },
        secondProgramDto(),
      ]),
    ),
  ),
  http.get(`${base}/programs/:id`, ({ params }) =>
    HttpResponse.json(successEnvelope(programDto({ id: String(params.id) }))),
  ),
  http.get(`${base}/programs`, () =>
    HttpResponse.json(successEnvelope([programDto(), secondProgramDto()])),
  ),
  http.post(`${base}/programs`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope(programDto(body)), {
      status: 201,
    });
  }),
  http.patch(`${base}/programs/:id/status`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(programDto({ id: String(params.id), isActive: false })),
    ),
  ),
  http.patch(`${base}/programs/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(programDto({ ...body, id: String(params.id) })),
    );
  }),
  http.delete(`${base}/programs/:id`, () =>
    HttpResponse.json(successEnvelope(null)),
  ),

  // Academic units — `tree` before `:id`, and the two action paths before the
  // bare `PATCH /:id`.
  http.get(`${base}/academic-units/tree`, () =>
    HttpResponse.json(
      successEnvelope([
        {
          ...academicUnitDto(),
          children: [childUnitDto(), secondChildUnitDto()],
        },
      ]),
    ),
  ),
  http.get(`${base}/academic-units/:id`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(academicUnitDto({ id: String(params.id) })),
    ),
  ),
  http.get(`${base}/academic-units`, () =>
    HttpResponse.json(
      successEnvelope([
        academicUnitDto(),
        childUnitDto(),
        secondChildUnitDto(),
      ]),
    ),
  ),
  http.post(`${base}/academic-units`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope(academicUnitDto(body)), {
      status: 201,
    });
  }),
  http.patch(`${base}/academic-units/:id/move`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(academicUnitDto({ ...body, id: String(params.id) })),
    );
  }),
  http.patch(`${base}/academic-units/:id/status`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(
        academicUnitDto({ id: String(params.id), isActive: false }),
      ),
    ),
  ),
  http.patch(`${base}/academic-units/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(academicUnitDto({ ...body, id: String(params.id) })),
    );
  }),
  http.delete(`${base}/academic-units/:id`, () =>
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
