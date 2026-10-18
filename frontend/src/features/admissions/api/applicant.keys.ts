import { createQueryKeys } from "@/core/query";

import type { ApplicantListQuery } from "../types/applicant.dto";

/**
 * Query keys for applicants.
 *
 * `list` takes the real server query (search/status/page/limit/sortBy/
 * sortOrder) as its filter object — unlike most modules in this codebase,
 * every one of those parameters is genuinely sent to the server, so each
 * distinct combination is its own cache entry.
 */
const base = createQueryKeys("admission-applicants");

export const applicantKeys = {
  ...base,
  list: (query: ApplicantListQuery) =>
    ["admission-applicants", "list", query] as const,
  workflowHistory: (id: string) =>
    ["admission-applicants", "detail", id, "workflow-history"] as const,
  /** Legal actions — invalidated whenever the applicant or its documents change. */
  workflowActions: (id: string) =>
    ["admission-applicants", "detail", id, "workflow-actions"] as const,
  checklist: (id: string) =>
    ["admission-applicants", "detail", id, "checklist"] as const,
  /** The effective policy, per active branch. */
  workflowPolicy: (branchId: string) =>
    ["admission-workflow-policy", branchId] as const,
} as const;
