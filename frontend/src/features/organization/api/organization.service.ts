import { api } from "@/core/api";

import type {
  CreateOrganizationRequest,
  OrganizationDto,
  UpdateOrganizationRequest,
} from "../types/organization.dto";

/**
 * Transport for `/organizations`.
 *
 * Written out rather than built from `createResourceService` for the same
 * reason the maintenance service is: **the list endpoint documents no query
 * parameters.** The factory's `list` would append `?page=1&pageSize=20` to
 * every request, inventing query contract on the wire. `list` here takes no
 * arguments and returns the whole collection; the directory narrows it in the
 * client and says so on screen.
 *
 * Paths carry no version segment — the client resolves them against the
 * configured `<origin>/v1` base.
 */
export const organizationService = {
  /**
   * `GET /organizations`.
   *
   * Documented as listing **active** organizations. The frontend therefore
   * cannot assume it has seen every organization, and never reports a count of
   * inactive or suspended ones as if it had.
   */
  list: () => api.get<OrganizationDto[]>("/organizations"),

  /** `GET /organizations/:id`. */
  get: (id: string) => api.get<OrganizationDto>(`/organizations/${id}`),

  /** `POST /organizations`. Super-admin only per the documented role matrix. */
  create: (body: CreateOrganizationRequest) =>
    api.post<OrganizationDto, CreateOrganizationRequest>(
      "/organizations",
      body,
    ),

  /** `PATCH /organizations/:id`. Body is always complete — see the DTO. */
  update: (id: string, body: UpdateOrganizationRequest) =>
    api.patch<OrganizationDto, UpdateOrganizationRequest>(
      `/organizations/${id}`,
      body,
    ),

  /**
   * `DELETE /organizations/:id` → **deactivate**, not destroy.
   *
   * The documentation is explicit that this marks the organization `INACTIVE`
   * and preserves the record. Every piece of copy in this module says
   * "deactivate" for that reason; calling it "delete" would misrepresent what
   * the button does.
   */
  deactivate: (id: string) => api.delete<void>(`/organizations/${id}`),
} as const;
