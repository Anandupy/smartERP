"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";
import { useWorkspace } from "@/core/workspace";

import { applicantKeys } from "../api/applicant.keys";
import { applicantService } from "../api/applicant.service";
import type {
  AdmitApplicantRequest,
  ApplicantDto,
  ApplicantListQuery,
  ApplicantRequest,
  CheckDuplicateApplicantsRequest,
  WorkflowAction,
} from "../types/applicant.dto";

/**
 * The branch + academic year every applicant request is scoped to.
 *
 * Applicant is documented as **both** branch- and academic-year scoped
 * (`x-branch-id` and `x-academic-year-id` are both required headers on every
 * request in the collection) — one level tighter than Admission Masters or
 * Academic Year, which need only a branch. `headerRegistry` attaches both
 * automatically once the workspace scope is `ready`; this hook is the
 * module's single point of contact with `useWorkspace()`, mirroring
 * `useAcademicYearBranch`/`useAdmissionMastersBranch`.
 *
 * Returns `null` until *both* are active, which is what gates every query
 * below.
 */
export function useApplicantScope() {
  const { branch, academicYear, isReady } = useWorkspace();
  if (!isReady || !branch || !academicYear) return null;
  return { branch, academicYear };
}

/**
 * A page of applicants, server-paginated and server-filtered.
 *
 * Unlike most modules in this codebase, `GET /admissions/applicants`
 * documents real `search`, `status`, `page`, `limit`, `sortBy` and
 * `sortOrder` parameters (`docs/admission-lifecycle-module.md` §3.3), so
 * every one is sent and nothing is narrowed in the browser.
 *
 * `placeholderData` keeps the previous page on screen while the next loads.
 */
export function useApplicants(query: ApplicantListQuery) {
  const scope = useApplicantScope();

  const result = useQuery({
    queryKey: applicantKeys.list(query),
    queryFn: () => applicantService.list(query),
    enabled: Boolean(scope),
    meta: { skipErrorToast: true },
    placeholderData: (previous) => previous,
  });

  return {
    ...result,
    applicants: result.data?.items ?? [],
    pagination: result.data?.meta ?? null,
  };
}

/** One applicant by id, with the detail read's FK expansions. */
export function useApplicant(id: string) {
  const scope = useApplicantScope();

  return useQuery({
    queryKey: applicantKeys.detail(id),
    queryFn: () => applicantService.get(id),
    enabled: Boolean(scope) && Boolean(id),
    meta: { skipErrorToast: true },
  });
}

/** Create an applicant — always starts life as `DRAFT`. */
export function useCreateApplicant() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: ApplicantRequest) => applicantService.create(body),
    onSuccess: async (applicant: ApplicantDto) => {
      await invalidateKeys(queryClient, [applicantKeys.lists()]);
      toast.success(`${applicant.displayName} — draft saved`);
    },
  });
}

/** Update an applicant. The body is always complete — see the mapper. */
export function useUpdateApplicant(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: ApplicantRequest) => applicantService.update(id, body),
    onSuccess: async (applicant: ApplicantDto) => {
      queryClient.setQueryData(applicantKeys.detail(id), applicant);
      await invalidateKeys(queryClient, [applicantKeys.lists()]);
      toast.success("Application updated");
    },
  });
}

/**
 * Delete an applicant — the documented soft delete, only reachable from
 * `DRAFT` or `CANCELLED` per the applicant lock rule.
 */
export function useDeleteApplicant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => applicantService.remove(id),
    onSuccess: async (_result, id) => {
      await invalidateKeys(queryClient, [
        applicantKeys.lists(),
        applicantKeys.detail(id),
      ]);
      toast.success("Application deleted");
    },
  });
}

/** Newest-first workflow history for one applicant. */
export function useApplicantWorkflowHistory(id: string) {
  const scope = useApplicantScope();

  const query = useQuery({
    queryKey: applicantKeys.workflowHistory(id),
    queryFn: () => applicantService.workflowHistory(id),
    enabled: Boolean(scope) && Boolean(id),
    meta: { skipErrorToast: true },
  });

  return { ...query, history: query.data ?? [] };
}

/**
 * Apply a workflow transition. One mutation, many `action` values — the
 * backend documents a single generic endpoint, not one route per action
 * (`docs/admission-lifecycle-module.md` §4.3). `ADMITTED` is deliberately
 * unreachable here: it is `orchestratedOnly` and reached only through
 * `useAdmitApplicant`.
 *
 * **No optimistic update.** Every edge in this machine is either
 * consequential (an offer, a rejection) or literally irreversible from the
 * UI's point of view, so the cache is invalidated and the server's answer is
 * read back rather than guessed.
 */
export function useApplicantWorkflowTransition(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: ({
      action,
      remarks,
    }: {
      action: WorkflowAction;
      remarks?: string;
    }) => applicantService.transition(id, { action, remarks }),
    onSuccess: async (applicant: ApplicantDto) => {
      queryClient.setQueryData(applicantKeys.detail(id), applicant);
      await invalidateKeys(queryClient, [
        applicantKeys.lists(),
        applicantKeys.detail(id),
        applicantKeys.workflowHistory(id),
      ]);
      toast.success(`Application moved to ${applicant.admissionStatus}`);
    },
  });
}

/**
 * The final admission transaction — `POST .../admit`. Creates the Student,
 * the Admission and the first Enrollment and moves the applicant to
 * `ADMITTED`, all in one backend transaction (module doc §8.6). Only
 * reachable from `SEAT_CONFIRMED`.
 *
 * `retry: false`: a retried admit against an applicant the first call already
 * admitted would surface `409 APPLICANT_ALREADY_ADMITTED` — which the
 * contract explicitly says to treat as success, not as a reason to try again
 * automatically.
 */
export function useAdmitApplicant(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    meta: { skipErrorToast: true },
    mutationFn: (body: AdmitApplicantRequest) =>
      applicantService.admit(id, body),
    onSuccess: async () => {
      await invalidateKeys(queryClient, [
        applicantKeys.lists(),
        applicantKeys.detail(id),
        applicantKeys.workflowHistory(id),
      ]);
      toast.success("Admission completed");
    },
  });
}

/**
 * Advisory duplicate check — matches on Aadhaar, primary mobile, or name and
 * date of birth within the branch. Never blocks; the caller decides what to
 * do with `hasDuplicates`.
 */
export function useCheckDuplicateApplicants() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: CheckDuplicateApplicantsRequest) =>
      applicantService.checkDuplicates(body),
  });
}
