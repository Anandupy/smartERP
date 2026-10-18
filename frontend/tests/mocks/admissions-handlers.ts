import { http, HttpResponse } from "msw";

import { apiConfig } from "@/config";

import { successEnvelope } from "@tests/fixtures/api";
import {
  admissionPolicyDto,
  applicantChecklistDto,
  workflowActionsDto,
} from "@tests/fixtures/applicant";

const base = apiConfig.baseURL.replace(/\/$/, "");

/**
 * Defaults for the configurable-workflow reads: the STANDARD policy, no
 * offered actions and an empty checklist. Specs that care about a profile,
 * an action or a blocker override these with `server.use(...)`.
 */
export const admissionsHandlers = [
  http.get(`${base}/admissions/workflow/policy`, () =>
    HttpResponse.json(successEnvelope(admissionPolicyDto())),
  ),
  http.get(`${base}/admissions/applicants/:id/workflow/actions`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(workflowActionsDto({ applicantId: String(params.id) })),
    ),
  ),
  http.get(`${base}/admissions/applicants/:id/checklist`, ({ params }) =>
    HttpResponse.json(
      successEnvelope(
        applicantChecklistDto({ applicantId: String(params.id) }),
      ),
    ),
  ),
];
