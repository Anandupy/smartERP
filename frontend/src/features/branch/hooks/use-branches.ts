"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";

import { branchKeys } from "../api/branch.keys";
import { branchService } from "../api/branch.service";
import { ANY_STATE, ANY_TYPE, branchState } from "../constants";
import type {
  BranchDto,
  CreateBranchRequest,
  UpdateBranchRequest,
} from "../types/branch.dto";

/**
 * Every branch the backend will return.
 *
 * `GET /branches` is documented as listing **active** branches, so
 * `branches.length` is not the number of branches that exist, and nothing in
 * this module treats it as one.
 *
 * Sorted by name: the endpoint documents no `sortBy`, so ordering is the
 * client's to choose and should at least be deterministic between renders.
 */
export function useBranches() {
  const query = useQuery({
    queryKey: branchKeys.lists(),
    queryFn: branchService.list,
    meta: { skipErrorToast: true },
  });

  const branches = useMemo(() => {
    if (!query.data) return [];
    return [...query.data].sort((a, b) => a.name.localeCompare(b.name));
  }, [query.data]);

  return { ...query, branches };
}

/**
 * Branches of one organization.
 *
 * A separate documented endpoint rather than a filter over the list, so it gets
 * its own cache key. Gated on an id, since calling it with an empty string
 * would request `/branches/organization/`.
 */
export function useBranchesByOrganization(organizationId: string | null) {
  const query = useQuery({
    queryKey: branchKeys.byOrganization(organizationId ?? ""),
    queryFn: () => branchService.listByOrganization(organizationId ?? ""),
    enabled: Boolean(organizationId),
    meta: { skipErrorToast: true },
  });

  const branches = useMemo(() => {
    if (!query.data) return [];
    return [...query.data].sort((a, b) => a.name.localeCompare(b.name));
  }, [query.data]);

  return { ...query, branches };
}

/** One branch by id. */
export function useBranch(id: string) {
  return useQuery({
    queryKey: branchKeys.detail(id),
    queryFn: () => branchService.get(id),
    enabled: Boolean(id),
    meta: { skipErrorToast: true },
  });
}

export interface BranchFilters {
  search: string;
  state: string;
  institutionType: string;
}

/**
 * Narrow the loaded branches **in the client**.
 *
 * No branch endpoint documents a `page`, `limit`, `search`, `sortBy` or filter
 * parameter, so there is nothing to send. Rather than leave the directory's
 * controls dead, the whole collection is filtered here and the screen marks
 * server-side querying as pending — the arrangement the maintenance and
 * organization lists already use, for the same documented reason.
 */
export function filterBranches(
  branches: readonly BranchDto[],
  filters: BranchFilters,
): BranchDto[] {
  const needle = filters.search.trim().toLowerCase();

  return branches.filter((branch) => {
    if (filters.state !== ANY_STATE && branchState(branch) !== filters.state) {
      return false;
    }

    if (
      filters.institutionType !== ANY_TYPE &&
      branch.institutionType !== filters.institutionType
    ) {
      return false;
    }

    if (needle.length === 0) return true;

    return [
      branch.name,
      branch.code,
      branch.registrationNumber,
      branch.contactEmail,
      branch.affiliationName,
      branch.city,
      branch.country,
    ]
      .filter((field): field is string => typeof field === "string")
      .some((field) => field.toLowerCase().includes(needle));
  });
}

/** Create a branch. */
export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: CreateBranchRequest) => branchService.create(body),
    onSuccess: async (branch: BranchDto) => {
      await invalidateKeys(queryClient, [
        branchKeys.lists(),
        branchKeys.byOrganization(branch.organizationId),
      ]);
      toast.success(`${branch.name} created`);
    },
  });
}

/** Update a branch. The body is always complete — see the mapper. */
export function useUpdateBranch(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: UpdateBranchRequest) => branchService.update(id, body),
    onSuccess: async (branch: BranchDto) => {
      queryClient.setQueryData(branchKeys.detail(id), branch);
      await invalidateKeys(queryClient, [
        branchKeys.lists(),
        branchKeys.byOrganization(branch.organizationId),
      ]);
      toast.success("Branch updated");
    },
  });
}

/**
 * Toggle a branch's active flag.
 *
 * **Deliberately no optimistic update and no retry.** The endpoint takes no
 * body, so it flips whatever `isActive` currently is rather than setting a
 * requested value — which makes it non-idempotent. A retried or replayed call
 * would silently undo itself, and an optimistic flip would show a state the
 * server may not have reached. The cache is invalidated and the truth re-read.
 */
export function useToggleBranchStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: (id: string) => branchService.toggleStatus(id),
    onSuccess: async (branch: BranchDto, id) => {
      await invalidateKeys(queryClient, [
        branchKeys.lists(),
        branchKeys.detail(id),
        branchKeys.byOrganization(branch?.organizationId ?? ""),
      ]);
      toast.success("Branch status updated");
    },
  });
}

/**
 * Delete a branch — the documented soft delete.
 *
 * No optimistic removal: a branch disappearing from the directory before the
 * server has agreed would misreport an operation that takes a campus offline.
 */
export function useDeleteBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => branchService.remove(id),
    onSuccess: async (_result, id) => {
      await invalidateKeys(queryClient, [
        branchKeys.lists(),
        branchKeys.detail(id),
      ]);
      toast.success("Branch deleted");
    },
  });
}
