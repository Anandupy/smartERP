import { api } from "@/core/api";

import type {
  BranchDto,
  CreateBranchRequest,
  UpdateBranchRequest,
} from "../types/branch.dto";

/**
 * Transport for `/branches`.
 *
 * Written out rather than built from `createResourceService`, for the reason
 * the organization and maintenance services are: **no endpoint here documents a
 * query parameter.** The factory's `list` would append `?page=…&pageSize=…` to
 * every request, inventing query contract on the wire.
 *
 * Paths carry no version segment — the client resolves them against the
 * configured `<origin>/v1` base.
 */
export const branchService = {
  /**
   * `GET /branches`.
   *
   * Documented as listing **active** branches, so the frontend cannot assume it
   * has seen every branch and never reports a count of inactive ones as if it
   * had.
   */
  list: () => api.get<BranchDto[]>("/branches"),

  /**
   * `GET /branches/organization/:orgId` → branches of one organization.
   *
   * Present in the Postman collection and in `branch-settings.md`; **absent
   * from `branch.md`'s endpoint list**. Two of three sources document it, and
   * it is the only scoped read available, so it is wired.
   */
  listByOrganization: (organizationId: string) =>
    api.get<BranchDto[]>(`/branches/organization/${organizationId}`),

  /** `GET /branches/:id`. */
  get: (id: string) => api.get<BranchDto>(`/branches/${id}`),

  /** `POST /branches`. SUPER_ADMIN and ORG_ADMIN per the documented matrix. */
  create: (body: CreateBranchRequest) =>
    api.post<BranchDto, CreateBranchRequest>("/branches", body),

  /** `PATCH /branches/:id`. Body is always complete — see the DTO. */
  update: (id: string, body: UpdateBranchRequest) =>
    api.patch<BranchDto, UpdateBranchRequest>(`/branches/${id}`, body),

  /**
   * `PATCH /branches/:id/status` → **toggle** the active flag.
   *
   * Sent with no body, because the recorded request has none: it carries no
   * `Content-Type` header and no `body` key, while every other `PATCH` in the
   * collection has both. The absence is the contract.
   *
   * The consequence is that the *target* state cannot be requested — the call
   * flips whatever `isActive` currently is. That makes it non-idempotent, so
   * the UI must never fire it speculatively or retry it, and the callers here
   * do neither.
   */
  toggleStatus: (id: string) => api.patch<BranchDto>(`/branches/${id}/status`),

  /**
   * `DELETE /branches/:id` → **soft delete**, not destroy.
   *
   * Both documents call it a soft delete, and `isDeleted` is a documented
   * field. The copy in this module says "delete" only where the backend does,
   * and always explains that the record is retained.
   */
  remove: (id: string) => api.delete<void>(`/branches/${id}`),
} as const;
