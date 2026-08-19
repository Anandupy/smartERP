import { api } from "@/core/api";

import type {
  ApplicantGuardianMappingDto,
  GuardianDto,
  GuardianRequest,
  GuardianSearchResult,
  GuardianshipDto,
  MapGuardianRequest,
} from "../types/guardian.dto";

/**
 * Transport for `/v1/admissions/guardians` and the read-only
 * `/v1/admissions/guardianships/*` surface.
 *
 * `x-branch-id` only on the guardian CRUD and mapping routes — **no**
 * `x-academic-year-id` — Guardian is not academic-year scoped (module doc
 * §5.2). The `guardianships` reads carry neither scope header: they are
 * organization-scoped (module doc §5.6).
 */
export const guardianService = {
  /** `POST /admissions/guardians`. Resolves a Person when `dob` is present. */
  create: (body: GuardianRequest) =>
    api.post<GuardianDto, GuardianRequest>("/admissions/guardians", body),

  /** `GET /admissions/guardians/:id`. */
  get: (id: string) => api.get<GuardianDto>(`/admissions/guardians/${id}`),

  /** `PATCH /admissions/guardians/:id`. Body is always complete. */
  update: (id: string, body: GuardianRequest) =>
    api.patch<GuardianDto, GuardianRequest>(
      `/admissions/guardians/${id}`,
      body,
    ),

  /**
   * `GET /admissions/guardians/search?q=`. At most 10 matches; an empty
   * query returns an empty array rather than the whole branch — enforced
   * here too, so an empty search never fires a request for "the branch".
   */
  search: (q: string) =>
    q.trim().length === 0
      ? Promise.resolve([] as GuardianSearchResult[])
      : api.get<GuardianSearchResult[]>("/admissions/guardians/search", {
          params: { q: q.trim() },
        }),

  /** `GET /admissions/guardians/applicant/:applicantId`. */
  listByApplicant: (applicantId: string) =>
    api.get<ApplicantGuardianMappingDto[]>(
      `/admissions/guardians/applicant/${applicantId}`,
    ),

  /**
   * `POST /admissions/guardians/applicant/:applicantId/map`. Idempotent:
   * mapping the same guardian again updates the existing link.
   */
  mapToApplicant: (applicantId: string, body: MapGuardianRequest) =>
    api.post<ApplicantGuardianMappingDto, MapGuardianRequest>(
      `/admissions/guardians/applicant/${applicantId}/map`,
      body,
    ),

  /**
   * `DELETE /admissions/guardians/applicant/:applicantId/map/:guardianId`.
   * Removes the link only — the guardian record itself is kept.
   */
  removeMapping: (applicantId: string, guardianId: string) =>
    api.delete<void>(
      `/admissions/guardians/applicant/${applicantId}/map/${guardianId}`,
    ),

  /** `GET /admissions/guardianships/ward/:wardPersonId` — org-scoped. */
  listWardGuardianships: (wardPersonId: string) =>
    api.get<GuardianshipDto[]>(
      `/admissions/guardianships/ward/${wardPersonId}`,
    ),
} as const;
