import { http, HttpResponse } from "msw";

import { apiConfig } from "@/config";
// Imported from the registry module, not the feature barrel: this file is
// loaded by the global MSW setup, before any spec's `vi.mock("next/navigation")`
// is registered. Importing the barrel pulled every admission-masters screen —
// and through them the shared layout components — into the module cache bound
// to the *real* `next/navigation`, so every later spec rendering one of them
// got `usePathname() === null` and an unmocked router.
import { ADMISSION_MASTER_TYPES } from "@/features/admission-masters/config/admission-master-registry";

import { successEnvelope } from "@tests/fixtures/api";
import { admissionMasterDto, secondAdmissionMasterDto } from "@tests/fixtures/admission-master";

const base = apiConfig.baseURL.replace(/\/$/, "");

/**
 * Default handlers for every one of the 10 admission master resources.
 *
 * Built by iterating `ADMISSION_MASTER_TYPES` — the same registry the app
 * itself is driven by — so a typo in a resource path breaks a test rather
 * than silently serving the wrong shape. Individual specs override with
 * `server.use(...)` for scenario-specific responses.
 */
export const admissionMastersHandlers = ADMISSION_MASTER_TYPES.flatMap(
  (resource) => {
    const path = `${base}/admissions/masters/${resource}`;

    return [
      http.get(path, () =>
        HttpResponse.json(
          successEnvelope([admissionMasterDto(), secondAdmissionMasterDto()]),
        ),
      ),
      http.get(`${path}/:id`, ({ params }) =>
        HttpResponse.json(
          successEnvelope(admissionMasterDto({ id: String(params.id) })),
        ),
      ),
      http.post(path, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(admissionMasterDto(body)), {
          status: 201,
        });
      }),
      http.patch(`${path}/:id`, async ({ request, params }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          successEnvelope(admissionMasterDto({ ...body, id: String(params.id) })),
        );
      }),
      http.delete(`${path}/:id`, () =>
        HttpResponse.json(successEnvelope(null)),
      ),
    ];
  },
);
