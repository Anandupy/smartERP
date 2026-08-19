"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";
import { useWorkspace } from "@/core/workspace";

import { guardianKeys } from "../api/guardian.keys";
import { guardianService } from "../api/guardian.service";
import type {
  GuardianRequest,
  MapGuardianRequest,
} from "../types/guardian.dto";

/**
 * The branch every guardian request is scoped to — `x-branch-id` only, no
 * academic year (module doc §5.2). Mirrors `useApplicantScope`/
 * `useAdmissionMastersBranch`.
 */
export function useGuardianBranch() {
  const { branch, isReady } = useWorkspace();
  return isReady ? branch : null;
}

/**
 * Guardians mapped to one applicant, with the guardian record expanded.
 * `GET /admissions/guardians/applicant/:applicantId`.
 */
export function useApplicantGuardians(applicantId: string) {
  const branch = useGuardianBranch();

  const query = useQuery({
    queryKey: guardianKeys.byApplicant(applicantId),
    queryFn: () => guardianService.listByApplicant(applicantId),
    enabled: Boolean(branch) && Boolean(applicantId),
    meta: { skipErrorToast: true },
  });

  return { ...query, mappings: query.data ?? [] };
}

/**
 * Search existing guardians for sibling reuse — debounced by the caller,
 * capped at 10 matches server-side, and an empty query returns an empty
 * array without a request (module doc §5.6).
 */
export function useGuardianSearch(q: string) {
  const branch = useGuardianBranch();

  const query = useQuery({
    queryKey: guardianKeys.search(q.trim()),
    queryFn: () => guardianService.search(q),
    enabled: Boolean(branch) && q.trim().length > 0,
    meta: { skipErrorToast: true },
  });

  return { ...query, results: query.data ?? [] };
}

/** One guardian by id. */
export function useGuardian(id: string | null) {
  const branch = useGuardianBranch();

  return useQuery({
    queryKey: guardianKeys.detail(id ?? ""),
    queryFn: () => guardianService.get(id ?? ""),
    enabled: Boolean(branch) && Boolean(id),
    meta: { skipErrorToast: true },
  });
}

/** Create a guardian — resolves a Person when `dob` is supplied. */
export function useCreateGuardian() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: GuardianRequest) => guardianService.create(body),
  });
}

/** Update a guardian. The body is always complete — see the mapper. */
export function useUpdateGuardian(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: GuardianRequest) => guardianService.update(id, body),
    onSuccess: async (guardian) => {
      queryClient.setQueryData(guardianKeys.detail(id), guardian);
      toast.success("Guardian updated");
    },
  });
}

/**
 * Map a guardian to an applicant. Idempotent server-side — calling it again
 * for the same guardian updates the existing link rather than duplicating
 * it, so this is also how "edit this mapping's flags" is implemented.
 */
export function useMapGuardianToApplicant(applicantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: MapGuardianRequest) =>
      guardianService.mapToApplicant(applicantId, body),
    onSuccess: async () => {
      await invalidateKeys(queryClient, [
        guardianKeys.byApplicant(applicantId),
      ]);
      toast.success("Guardian mapped");
    },
  });
}

/** Remove a guardian's mapping from an applicant. The guardian record itself survives. */
export function useRemoveGuardianMapping(applicantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guardianId: string) =>
      guardianService.removeMapping(applicantId, guardianId),
    onSuccess: async () => {
      await invalidateKeys(queryClient, [
        guardianKeys.byApplicant(applicantId),
      ]);
      toast.success("Guardian mapping removed");
    },
  });
}

/**
 * A ward's active guardianships (Person ↔ Person), org-scoped — the durable
 * relationship that survives conversion, distinct from the applicant-scoped
 * mapping above (module doc §5.1, §5.6). Only meaningful once the ward has a
 * resolved `personId`.
 */
export function useWardGuardianships(wardPersonId: string | null) {
  const query = useQuery({
    queryKey: guardianKeys.wardGuardianships(wardPersonId ?? ""),
    queryFn: () => guardianService.listWardGuardianships(wardPersonId ?? ""),
    enabled: Boolean(wardPersonId),
    meta: { skipErrorToast: true },
  });

  const guardianships = useMemo(() => query.data ?? [], [query.data]);
  return { ...query, guardianships };
}
