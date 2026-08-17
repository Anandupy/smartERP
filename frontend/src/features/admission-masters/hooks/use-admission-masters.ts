"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";
import { useWorkspace } from "@/core/workspace";

import { admissionMasterClient } from "../api/admission-master-clients";
import type { AdmissionMasterType } from "../config/admission-master-registry";
import { admissionMasterConfig } from "../config/admission-master-registry";
import {
  toAdmissionMasterRequest,
  toAdmissionMasterToggleRequest,
} from "../mappers/admission-master.mapper";
import type { AdmissionMasterFormValues } from "../schemas/admission-master.schema";
import type { AdmissionMasterDto } from "../types/admission-master.dto";

/**
 * The branch every admission master request is scoped to.
 *
 * `x-branch-id` is a required header on every one of the 10 masters' requests
 * in the collection, and the platform's `headerRegistry` attaches it
 * automatically once the workspace scope is `ready` — but only then. There is
 * exactly one place the app is allowed to learn the active branch from —
 * `useWorkspace()` — so this hook is the module's single point of contact
 * with it, mirroring `academic-year`'s `useAcademicYearBranch`.
 *
 * Returns `null` until the scope is `ready`, which is what gates every query
 * below: firing a read before then would ask the server for the masters of no
 * branch.
 */
export function useAdmissionMastersBranch() {
  const { branch, isReady } = useWorkspace();
  return isReady ? branch : null;
}

/**
 * Every record of one master, for the active branch.
 *
 * Always fetched with `includeInactive=true` — the one query parameter these
 * endpoints document, and marked **Required** on every list request. Active
 * and Inactive filtering happens client-side over this single fetch (see
 * `filterAdmissionMasters`) rather than refetching per filter change, since
 * `includeInactive` is boolean, not a status enum.
 */
export function useAdmissionMasterList(type: AdmissionMasterType) {
  const branch = useAdmissionMastersBranch();
  const { service, keys } = admissionMasterClient(type);

  const query = useQuery({
    queryKey: keys.list({ branchId: branch?.id ?? "" }),
    queryFn: () => service.list(true),
    enabled: Boolean(branch),
    meta: { skipErrorToast: true },
  });

  const masters = useMemo(() => {
    if (!query.data) return [];
    return [...query.data].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [query.data]);

  return { ...query, masters };
}

/** One record by id. */
export function useAdmissionMaster(type: AdmissionMasterType, id: string) {
  const branch = useAdmissionMastersBranch();
  const { service, keys } = admissionMasterClient(type);

  return useQuery({
    queryKey: keys.detail(id),
    queryFn: () => service.get(id),
    enabled: Boolean(branch) && Boolean(id),
    meta: { skipErrorToast: true },
  });
}

export interface AdmissionMasterFilters {
  search: string;
  /** `"ANY" | "active" | "inactive"` — see `ANY_STATUS` in `constants.ts`. */
  status: string;
}

/**
 * Narrow the loaded records **in the client**.
 *
 * `includeInactive` is the only query parameter documented on any master's
 * list endpoint — there is no `search` or `status` to send, so the whole
 * fetched collection is filtered here, the same arrangement branch and
 * academic-year use for the same documented reason.
 */
export function filterAdmissionMasters(
  masters: readonly AdmissionMasterDto[],
  filters: AdmissionMasterFilters,
): AdmissionMasterDto[] {
  const needle = filters.search.trim().toLowerCase();

  return masters.filter((master) => {
    if (filters.status === "active" && !master.isActive) return false;
    if (filters.status === "inactive" && master.isActive) return false;

    if (needle.length === 0) return true;

    return [master.code, master.name, master.description ?? ""].some(
      (field) => field.toLowerCase().includes(needle),
    );
  });
}

/** Create a record of one master. */
export function useCreateAdmissionMaster(type: AdmissionMasterType) {
  const queryClient = useQueryClient();
  const branch = useAdmissionMastersBranch();
  const { service, keys } = admissionMasterClient(type);

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (values: AdmissionMasterFormValues) =>
      service.create(toAdmissionMasterRequest(values)),
    onSuccess: async (master) => {
      await invalidateKeys(queryClient, [
        keys.list({ branchId: branch?.id ?? "" }),
      ]);
      toast.success(`${master.name} created`);
    },
  });
}

/** Update a record. The body is always complete — see the mapper. */
export function useUpdateAdmissionMaster(
  type: AdmissionMasterType,
  id: string,
) {
  const queryClient = useQueryClient();
  const branch = useAdmissionMastersBranch();
  const { service, keys } = admissionMasterClient(type);

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: ({
      values,
      source,
    }: {
      values: AdmissionMasterFormValues;
      source: AdmissionMasterDto;
    }) => service.update(id, toAdmissionMasterRequest(values, source)),
    onSuccess: async (master) => {
      queryClient.setQueryData(keys.detail(id), master);
      await invalidateKeys(queryClient, [
        keys.list({ branchId: branch?.id ?? "" }),
        keys.detail(id),
      ]);
      toast.success(`${admissionMasterConfig(type).singularLabel} updated`);
    },
  });
}

/**
 * Activate or deactivate a record.
 *
 * There is no dedicated status endpoint for any admission master — unlike
 * branch, academic-year or academic-unit, the collection has only the one
 * generic `PATCH /:id`, and its documented body is the complete record. So
 * this resends the whole record with `isActive` flipped
 * (`toAdmissionMasterToggleRequest`) rather than a partial body.
 */
export function useToggleAdmissionMasterActive(type: AdmissionMasterType) {
  const queryClient = useQueryClient();
  const branch = useAdmissionMastersBranch();
  const { service, keys } = admissionMasterClient(type);

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (master: AdmissionMasterDto) =>
      service.update(master.id, toAdmissionMasterToggleRequest(master)),
    onSuccess: async (master) => {
      queryClient.setQueryData(keys.detail(master.id), master);
      await invalidateKeys(queryClient, [
        keys.list({ branchId: branch?.id ?? "" }),
        keys.detail(master.id),
      ]);
      toast.success(
        master.isActive
          ? `${master.name} activated`
          : `${master.name} deactivated`,
      );
    },
  });
}

/**
 * Delete a record — the documented soft delete.
 *
 * No optimistic removal: a record vanishing from the directory before the
 * server has agreed would misreport an operation that, per every "Soft
 * delete" folder name in the collection, the backend documents no restore
 * endpoint for.
 */
export function useDeleteAdmissionMaster(type: AdmissionMasterType) {
  const queryClient = useQueryClient();
  const branch = useAdmissionMastersBranch();
  const { service, keys } = admissionMasterClient(type);

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (id: string) => service.remove(id),
    onSuccess: async (_result, id) => {
      await invalidateKeys(queryClient, [
        keys.list({ branchId: branch?.id ?? "" }),
        keys.detail(id),
      ]);
      toast.success(`${admissionMasterConfig(type).singularLabel} deleted`);
    },
  });
}
