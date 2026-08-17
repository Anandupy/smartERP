import { http, HttpResponse } from "msw";

import { apiConfig } from "@/config";

import { successEnvelope } from "@tests/fixtures/api";
import { adminHandlers } from "./admin-handlers";
import { admissionMastersHandlers } from "./admission-masters-handlers";
import { authHandlers } from "./auth-handlers";
import { communicationHandlers } from "./communication-handlers";
import { workspaceAdminHandlers } from "./workspace-admin-handlers";
import { workspaceHandlers } from "./workspace-handlers";

/**
 * Default MSW request handlers. Feature tests extend these via
 * `server.use(...)` for scenario-specific responses. Paths are matched against
 * the configured API base URL and use the backend success envelope.
 */
const base = apiConfig.baseURL.replace(/\/$/, "");

export const handlers = [
  ...authHandlers,
  ...workspaceHandlers,
  ...adminHandlers,
  ...admissionMastersHandlers,
  ...communicationHandlers,
  ...workspaceAdminHandlers,
  http.get(`${base}/health`, () =>
    HttpResponse.json(successEnvelope({ status: "ok" })),
  ),
  http.get(`${base}/examples`, () =>
    HttpResponse.json(
      successEnvelope([], {
        meta: {
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        },
      }),
    ),
  ),
];
