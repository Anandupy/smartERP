import { api } from "@/core/api";
import { compact } from "@/utils";

import type {
  AdmitApplicantRequest,
  AdmitApplicantResponse,
  ApplicantDto,
  ApplicantListPage,
  ApplicantListQuery,
  ApplicantRequest,
  CheckDuplicateApplicantsRequest,
  CheckDuplicateApplicantsResponse,
  WorkflowHistoryEntry,
  WorkflowTransitionRequest,
} from "../types/applicant.dto";

/**
 * Transport for `/v1/admissions/applicants` and the workflow/admit endpoints
 * that operate on one applicant.
 *
 * Written out rather than built from `createResourceService`, because this
 * module's list endpoint nests pagination **inside** `data` as `{ items,
 * meta }` (the same convention already pinned for Audit Logs) rather than
 * lifting it onto the envelope's `meta.pagination` — `createResourceService`
 * assumes the latter.
 *
 * `x-branch-id` and `x-academic-year-id` are required on every request but
 * are never passed by hand — the platform's `headerRegistry` attaches them
 * automatically once the workspace scope is `ready`. Every hook in this
 * module gates on both being active first.
 */
export const applicantService = {
  /**
   * `GET /admissions/applicants` → `{ items, meta }`. Real server-side
   * search/filter/sort/paging — see `docs/admission-lifecycle-module.md`
   * §3.3.
   */
  list: (query: ApplicantListQuery = {}) =>
    api.get<ApplicantListPage>("/admissions/applicants", {
      params: compact(query),
    }),

  /**
   * `GET /admissions/applicants/:id` → the expanded read (FK ids resolved to
   * nested objects).
   */
  get: (id: string) => api.get<ApplicantDto>(`/admissions/applicants/${id}`),

  /**
   * `POST /admissions/applicants`. Runs a duplicate check but does not block
   * on it — the response is the applicant alone.
   */
  create: (body: ApplicantRequest) =>
    api.post<ApplicantDto, ApplicantRequest>("/admissions/applicants", body),

  /** `PATCH /admissions/applicants/:id`. Body is always complete. */
  update: (id: string, body: ApplicantRequest) =>
    api.patch<ApplicantDto, ApplicantRequest>(
      `/admissions/applicants/${id}`,
      body,
    ),

  /**
   * `DELETE /admissions/applicants/:id` — soft delete, only reachable from
   * `DRAFT` or `CANCELLED` per the documented lock rule.
   */
  remove: (id: string) => api.delete<void>(`/admissions/applicants/${id}`),

  /**
   * `POST /admissions/applicants/:applicantId/workflow/transition`. The
   * caller names an action, never a destination — the engine owns where it
   * leads. Returns the applicant's full new state.
   */
  transition: (id: string, body: WorkflowTransitionRequest) =>
    api.post<ApplicantDto, WorkflowTransitionRequest>(
      `/admissions/applicants/${id}/workflow/transition`,
      body,
    ),

  /**
   * `GET /admissions/applicants/:applicantId/workflow/history`. Newest
   * first, scoped to one branch — never crosses it.
   */
  workflowHistory: (id: string) =>
    api.get<WorkflowHistoryEntry[]>(
      `/admissions/applicants/${id}/workflow/history`,
    ),

  /**
   * `POST /admissions/applicants/:applicantId/admit` — the final admission
   * transaction. Only reachable from `SEAT_CONFIRMED`. See
   * `docs/admission-lifecycle-module.md` §8.6 for the complete contract.
   */
  admit: (id: string, body: AdmitApplicantRequest) =>
    api.post<AdmitApplicantResponse, AdmitApplicantRequest>(
      `/admissions/applicants/${id}/admit`,
      body,
    ),

  /**
   * `POST /admissions/applicants/check-duplicates` — advisory only. Matches
   * on Aadhaar, primary mobile, or name and date of birth within the branch.
   */
  checkDuplicates: (body: CheckDuplicateApplicantsRequest) =>
    api.post<CheckDuplicateApplicantsResponse, CheckDuplicateApplicantsRequest>(
      "/admissions/applicants/check-duplicates",
      body,
    ),
} as const;
