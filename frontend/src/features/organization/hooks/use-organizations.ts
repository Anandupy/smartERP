"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";

import { organizationKeys } from "../api/organization.keys";
import { organizationService } from "../api/organization.service";
import { ANY_STATUS } from "../constants";
import type {
  CreateOrganizationRequest,
  OrganizationDto,
  UpdateOrganizationRequest,
} from "../types/organization.dto";

/**
 * Every organization the backend will return.
 *
 * Named `useOrganizations`, not `useAllOrganizations`, but worth being precise
 * about: `GET /organizations` is documented as listing **active**
 * organizations. Callers must not treat `organizations.length` as the total
 * number of organizations that exist, and nothing in this module does.
 *
 * Sorted by name so the directory has a stable order — the endpoint documents
 * no `sortBy`, so ordering is the client's to choose and should at least be
 * deterministic between renders.
 */
export function useOrganizations() {
  const query = useQuery({
    queryKey: organizationKeys.lists(),
    queryFn: organizationService.list,
    meta: { skipErrorToast: true },
  });

  const organizations = useMemo(() => {
    if (!query.data) return [];
    return [...query.data].sort((a, b) => a.name.localeCompare(b.name));
  }, [query.data]);

  return { ...query, organizations };
}

/** One organization by id. */
export function useOrganization(id: string) {
  return useQuery({
    queryKey: organizationKeys.detail(id),
    queryFn: () => organizationService.get(id),
    enabled: Boolean(id),
    meta: { skipErrorToast: true },
  });
}

export interface OrganizationFilters {
  search: string;
  status: string;
}

/**
 * Narrow the loaded organizations **in the client**.
 *
 * `GET /organizations` documents no `page`, `limit`, `search`, `sortBy` or
 * filter parameters, so there is nothing to send. Rather than leave the
 * directory's controls dead, the whole collection is filtered here and the
 * screen marks server-side querying as pending — the same arrangement the
 * maintenance rules list uses, and for the same documented reason.
 *
 * The status filter can only ever narrow what the endpoint already returned.
 * Since that is documented to be the active organizations, filtering to
 * `INACTIVE` legitimately yields nothing; the screen explains that rather than
 * showing a bare empty table.
 */
export function filterOrganizations(
  organizations: readonly OrganizationDto[],
  filters: OrganizationFilters,
): OrganizationDto[] {
  const needle = filters.search.trim().toLowerCase();

  return organizations.filter((organization) => {
    if (
      filters.status !== ANY_STATUS &&
      organization.status !== filters.status
    ) {
      return false;
    }

    if (needle.length === 0) return true;

    return [
      organization.name,
      organization.code,
      organization.contactEmail,
      organization.city,
      organization.country,
    ]
      .filter((field): field is string => typeof field === "string")
      .some((field) => field.toLowerCase().includes(needle));
  });
}

/** Create an organization. */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: CreateOrganizationRequest) =>
      organizationService.create(body),
    onSuccess: async (organization: OrganizationDto) => {
      await invalidateKeys(queryClient, [organizationKeys.lists()]);
      toast.success(`${organization.name} created`);
    },
  });
}

/** Update an organization. The body is always complete — see the mapper. */
export function useUpdateOrganization(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: UpdateOrganizationRequest) =>
      organizationService.update(id, body),
    onSuccess: async (organization: OrganizationDto) => {
      queryClient.setQueryData(organizationKeys.detail(id), organization);
      await invalidateKeys(queryClient, [organizationKeys.lists()]);
      toast.success("Organization updated");
    },
  });
}

/**
 * Deactivate an organization — the documented soft delete.
 *
 * No optimistic update: an organization vanishing from the directory before
 * the server has agreed would misreport the one operation in this module that
 * changes who can reach the platform. Both the detail and list caches are
 * invalidated, because the record survives with a new status rather than
 * disappearing.
 */
export function useDeactivateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => organizationService.deactivate(id),
    onSuccess: async (_result, id) => {
      await invalidateKeys(queryClient, [
        organizationKeys.lists(),
        organizationKeys.detail(id),
      ]);
      toast.success("Organization deactivated");
    },
  });
}
