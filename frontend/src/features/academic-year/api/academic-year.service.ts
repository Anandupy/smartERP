import { api } from "@/core/api";

import type {
  AcademicYearDto,
  AcademicYearTransition,
  CreateAcademicYearRequest,
  UpdateAcademicYearRequest,
} from "../types/academic-year.dto";

/**
 * Transport for `/academic-years`.
 *
 * Written out rather than built from `createResourceService`, for the reason
 * the organization, branch and maintenance services are: the factory's `list`
 * appends `?page=…&pageSize=…`, and the only query parameter these endpoints
 * document is `branchId`. Sending an invented `page` would be inventing wire
 * contract.
 *
 * Paths carry no version segment — the client resolves them against the
 * configured `<origin>/v1` base.
 *
 * **`branchId` is required, not optional.** Both `GET` endpoints document it as
 * `(Required)`, and every request in the collection also carries an
 * `x-branch-id` header. The header is supplied by the platform's
 * `headerRegistry` once the workspace scope is `ready`; the query parameter is
 * this module's to pass, and every caller is gated on having one.
 *
 * `get(id)` is `GET /academic-years/:id`, added by the backend after the
 * original contract (`backend/docs/core/frontend-contract-answers.md` §6, G2)
 * and declared in the OpenAPI document; soft-deleted years answer 404.
 */
export const academicYearService = {
  /** `GET /academic-years/:id` → one year, or 404 when absent or deleted. */
  get: (id: string) => api.get<AcademicYearDto>(`/academic-years/${id}`),

  /**
   * `GET /academic-years?branchId=` → every academic year of one branch.
   *
   * The documentation does not say whether deleted years are excluded, and no
   * `isDeleted` field is documented — so this module never reports a total as
   * if it knew the endpoint returned everything.
   */
  list: (branchId: string) =>
    api.get<AcademicYearDto[]>("/academic-years", { params: { branchId } }),

  /**
   * `GET /academic-years/current?branchId=` → the branch's selected year.
   *
   * A genuinely different endpoint rather than a filter over the list, so it
   * gets its own cache key. The documentation calls it "the currently selected
   * academic year", which is the `isSelected` flag — rule 3 guarantees at most
   * one per branch.
   *
   * What is *not* documented is what happens when a branch has none. There is
   * no recorded response body and no stated status code, so the hook treats a
   * `404` as "none selected" rather than as a failure.
   */
  current: (branchId: string) =>
    api.get<AcademicYearDto>("/academic-years/current", {
      params: { branchId },
    }),

  /** `POST /academic-years`. */
  create: (body: CreateAcademicYearRequest) =>
    api.post<AcademicYearDto, CreateAcademicYearRequest>(
      "/academic-years",
      body,
    ),

  /**
   * `PATCH /academic-years/:id`. Body is always complete — see the DTO.
   *
   * Documented as "Update details (if not locked)". Locked years are refused by
   * the server; the UI declines to offer the edit rather than letting the user
   * fill a form that cannot be saved.
   */
  update: (id: string, body: UpdateAcademicYearRequest) =>
    api.patch<AcademicYearDto, UpdateAcademicYearRequest>(
      `/academic-years/${id}`,
      body,
    ),

  /**
   * `PATCH /academic-years/:id/{activate|select|lock}`.
   *
   * Sent with no body, because none of the three recorded requests has one:
   * no `Content-Type` header and no `body` key, while create and update have
   * both. The absence is the contract.
   *
   * Unlike the branch status toggle — which flips whatever `isActive` is and is
   * therefore non-idempotent — each of these **names its target state** in the
   * path. Calling `activate` twice leaves the year active. That makes them safe
   * to confirm and fire, and safe to retry.
   */
  transition: (id: string, transition: AcademicYearTransition) =>
    api.patch<AcademicYearDto>(`/academic-years/${id}/${transition}`),

  /**
   * `DELETE /academic-years/:id` → **soft delete**, not destroy.
   *
   * The documentation is explicit: "Soft delete the year (if not locked or
   * selected)". Two of the five validation rules guard it, so the UI checks
   * both before offering the action and says which one is blocking.
   */
  remove: (id: string) => api.delete<void>(`/academic-years/${id}`),
} as const;
