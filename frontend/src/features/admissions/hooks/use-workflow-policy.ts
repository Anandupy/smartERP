"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";
import { useWorkspace } from "@/core/workspace";

import { applicantKeys } from "../api/applicant.keys";
import { applicantService } from "../api/applicant.service";
import type { AdmitApplicantRequest } from "../types/applicant.dto";
import type {
  ClearConfigValueRequest,
  SetConfigValueRequest,
} from "../types/workflow-policy.dto";
import { useApplicantScope } from "./use-applicants";

/**
 * The admission policy in force for the active branch.
 *
 * Needs only a branch — the endpoint is branch-scoped, not year-scoped.
 * Resolved by the backend (BRANCH → ORGANIZATION → SYSTEM → default); the UI
 * never decides a profile itself.
 */
export function useAdmissionPolicy() {
  const { branch, isReady } = useWorkspace();
  const branchId = isReady ? (branch?.id ?? null) : null;

  return useQuery({
    queryKey: applicantKeys.workflowPolicy(branchId ?? ""),
    queryFn: () => applicantService.workflowPolicy(),
    enabled: Boolean(branchId),
    meta: { skipErrorToast: true },
  });
}

/**
 * The actions legal for one applicant and this caller, with the reason each
 * blocked one is blocked. The single source for every workflow button.
 */
export function useApplicantWorkflowActions(id: string) {
  const scope = useApplicantScope();

  return useQuery({
    queryKey: applicantKeys.workflowActions(id),
    queryFn: () => applicantService.workflowActions(id),
    enabled: Boolean(scope) && Boolean(id),
    meta: { skipErrorToast: true },
  });
}

/** The document checklist for one applicant, as the workflow guards see it. */
export function useApplicantChecklist(id: string) {
  const scope = useApplicantScope();

  return useQuery({
    queryKey: applicantKeys.checklist(id),
    queryFn: () => applicantService.checklist(id),
    enabled: Boolean(scope) && Boolean(id),
    meta: { skipErrorToast: true },
  });
}

/**
 * SIMPLE_ADMISSION's one-step admission. `retry: false` for the same reason
 * as `useAdmitApplicant`: a retry after a success that the response lost
 * answers `409 APPLICANT_ALREADY_ADMITTED`, which must not be retried blindly.
 */
export function useDirectAdmitApplicant(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    meta: { skipErrorToast: true },
    mutationFn: (body: AdmitApplicantRequest) =>
      applicantService.directAdmit(id, body),
    onSuccess: async () => {
      await invalidateKeys(queryClient, [
        applicantKeys.lists(),
        applicantKeys.detail(id),
      ]);
      toast.success("Student admitted");
    },
  });
}

/** Set one admission policy value for the active organization or branch. */
export function useSetAdmissionPolicyValue() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: ({ key, body }: { key: string; body: SetConfigValueRequest }) =>
      applicantService.setPolicyValue(key, body),
    onSuccess: async () => {
      await invalidateKeys(queryClient, [["admission-workflow-policy"]]);
      toast.success("Admission policy updated");
    },
  });
}

/** Clear an override; the organization or platform value applies again. */
export function useClearAdmissionPolicyValue() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: ({
      key,
      body,
    }: {
      key: string;
      body: ClearConfigValueRequest;
    }) => applicantService.clearPolicyValue(key, body),
    onSuccess: async () => {
      await invalidateKeys(queryClient, [["admission-workflow-policy"]]);
      toast.success("Override removed");
    },
  });
}
