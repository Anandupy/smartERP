import { api } from "@/core/api";

import type {
  AdmissionMasterDto,
  AdmissionMasterRequest,
} from "../types/admission-master.dto";

export interface AdmissionMasterService {
  list: (includeInactive: boolean) => Promise<AdmissionMasterDto[]>;
  get: (id: string) => Promise<AdmissionMasterDto>;
  create: (body: AdmissionMasterRequest) => Promise<AdmissionMasterDto>;
  update: (
    id: string,
    body: AdmissionMasterRequest,
  ) => Promise<AdmissionMasterDto>;
  remove: (id: string) => Promise<void>;
}

/**
 * Transport for `/v1/admissions/masters/<resource>`.
 *
 * Hand-written per resource rather than shared through `createResourceService`
 * — the same reason branch, academic-year and organization are: the factory's
 * `list` appends `?page=…&pageSize=…`, and the only query parameter any of
 * these ten endpoints documents is `includeInactive`, which the collection
 * marks **Required** on every list request.
 *
 * Paths carry no version segment — the client resolves them against the
 * configured `<origin>/v1` base. `x-branch-id` is not passed here: it is
 * supplied automatically by the platform's `headerRegistry`
 * (`core/workspace/workspace-headers.ts`) once the workspace scope is
 * `ready`, and every caller in this module is gated on having an active
 * branch first (`useAdmissionMastersBranch`).
 */
export function createAdmissionMasterService(
  resource: string,
): AdmissionMasterService {
  const base = `/admissions/masters/${resource}`;

  return {
    list: (includeInactive) =>
      api.get<AdmissionMasterDto[]>(base, { params: { includeInactive } }),
    get: (id) => api.get<AdmissionMasterDto>(`${base}/${id}`),
    create: (body) =>
      api.post<AdmissionMasterDto, AdmissionMasterRequest>(base, body),
    update: (id, body) =>
      api.patch<AdmissionMasterDto, AdmissionMasterRequest>(
        `${base}/${id}`,
        body,
      ),
    remove: (id) => api.delete<void>(`${base}/${id}`),
  };
}
