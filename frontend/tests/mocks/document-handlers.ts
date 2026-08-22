import { http, HttpResponse } from "msw";

import { apiConfig } from "@/config";

import { successEnvelope } from "@tests/fixtures/api";
import { documentRequirementDto, documentTypeDto, secondDocumentRequirementDto, secondDocumentTypeDto } from "@tests/fixtures/document";

const base = apiConfig.baseURL.replace(/\/$/, "");

/**
 * Default handlers for `/document-types` and `/document-requirements` — the
 * two admin CRUD resources the Documents Management milestone added.
 * Individual specs override with `server.use(...)` for scenario-specific
 * responses, the same pattern `admission-masters-handlers.ts` uses.
 */
export const documentHandlers = [
  http.get(`${base}/document-types`, () =>
    HttpResponse.json(successEnvelope([documentTypeDto(), secondDocumentTypeDto()])),
  ),
  http.get(`${base}/document-types/:id`, ({ params }) =>
    HttpResponse.json(successEnvelope(documentTypeDto({ id: String(params.id) }))),
  ),
  http.post(`${base}/document-types`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope(documentTypeDto(body)), { status: 201 });
  }),
  http.patch(`${base}/document-types/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(documentTypeDto({ ...body, id: String(params.id) })),
    );
  }),
  http.delete(`${base}/document-types/:id`, () =>
    HttpResponse.json(successEnvelope(null)),
  ),

  http.get(`${base}/document-requirements`, () =>
    HttpResponse.json(
      successEnvelope([documentRequirementDto(), secondDocumentRequirementDto()]),
    ),
  ),
  http.get(`${base}/document-requirements/:id`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(documentRequirementDto({ id: String(params.id) })),
    ),
  ),
  http.post(`${base}/document-requirements`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope(documentRequirementDto(body)), {
      status: 201,
    });
  }),
  http.patch(`${base}/document-requirements/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(documentRequirementDto({ ...body, id: String(params.id) })),
    );
  }),
  http.delete(`${base}/document-requirements/:id`, () =>
    HttpResponse.json(successEnvelope(null)),
  ),
];
