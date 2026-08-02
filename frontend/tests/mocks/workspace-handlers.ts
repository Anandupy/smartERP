import { http, HttpResponse } from "msw";

import { apiConfig } from "@/config";

import { identityDto } from "@tests/fixtures/workspace";
import { successEnvelope } from "@tests/fixtures/api";

/**
 * Default MSW handler for `GET /auth/me`.
 *
 * The happy path only: it answers with a user who has a real choice at every
 * level. Tests that need a different identity — one organization, no
 * organizations, a scoped role, a failure — declare it per test with
 * `server.use(...)` and the builders in `tests/fixtures/workspace`.
 */
const base = apiConfig.baseURL.replace(/\/$/, "");

export const workspaceHandlers = [
  http.get(`${base}/auth/me`, () =>
    HttpResponse.json(successEnvelope(identityDto())),
  ),
];
