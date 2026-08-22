import { http, HttpResponse } from "msw";

import { apiConfig } from "@/config";

import { successEnvelope } from "@tests/fixtures/api";
import { numberingConfigDto, secondNumberingConfigDto } from "@tests/fixtures/numbering";

const base = apiConfig.baseURL.replace(/\/$/, "");

/** Default handlers for `/numbering/configs`. */
export const numberingHandlers = [
  http.get(`${base}/numbering/configs`, () =>
    HttpResponse.json(successEnvelope([numberingConfigDto(), secondNumberingConfigDto()])),
  ),
  http.post(`${base}/numbering/configs`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(successEnvelope(numberingConfigDto(body)), { status: 201 });
  }),
  http.patch(`${base}/numbering/configs/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      successEnvelope(numberingConfigDto({ ...body, id: String(params.id) })),
    );
  }),
  http.post(`${base}/numbering/configs/:id/preview`, async ({ request }) => {
    const body = (await request.json()) as { sampleValue: number };
    return HttpResponse.json(
      successEnvelope({
        purpose: "STUDENT_CODE",
        sampleValue: body.sampleValue,
        rendered: `STU${String(body.sampleValue).padStart(10, "0")}`,
      }),
    );
  }),
];
