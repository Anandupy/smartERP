import { api } from "@/core/api";

import type {
  AcademicUnitDto,
  CreateAcademicUnitRequest,
  MoveAcademicUnitRequest,
  UpdateAcademicUnitRequest,
} from "../types/academic-unit.dto";

/** Both documented required query parameters, together. */
export interface AcademicUnitScope {
  branchId: string;
  academicYearId: string;
}

/**
 * Transport for `/academic-units`.
 *
 * Written out rather than built from `createResourceService`: the factory's
 * `list` appends `?page=…&pageSize=…`, and the only query parameters documented
 * here are `branchId` and `academicYearId` — both of which identify the scope
 * rather than narrowing the result.
 *
 * Paths carry no version segment — the client resolves them against the
 * configured `<origin>/v1` base.
 *
 * **This is the first module needing two levels of workspace scope at once.**
 * Both reads document `branchId` *and* `academicYearId` as `(Required)`, and
 * every request in the collection carries both `x-branch-id` and
 * `x-academic-year-id` headers. The headers come from the platform's
 * `headerRegistry` once the workspace scope is `ready`; the query parameters
 * are this module's to pass, and every caller is gated on having both.
 */
export const academicUnitService = {
  /** `GET /academic-units?branchId=&academicYearId=`. */
  list: (scope: AcademicUnitScope) =>
    api.get<AcademicUnitDto[]>("/academic-units", { params: { ...scope } }),

  /**
   * `GET /academic-units/tree?branchId=&academicYearId=` → the same units,
   * nested.
   *
   * Wired because it is documented, but **nothing depends on its shape**: the
   * endpoint has no recorded response body, no nesting key and no stated
   * envelope. The tree screen builds its hierarchy from the flat list with the
   * shared `buildTree`, which needs only `parentId` — a documented request
   * field.
   *
   * Typed `unknown` rather than as a guessed interface, per the platform's rule
   * for undocumented responses.
   */
  tree: (scope: AcademicUnitScope) =>
    api.get<unknown>("/academic-units/tree", { params: { ...scope } }),

  /** `GET /academic-units/:id`. */
  get: (id: string) => api.get<AcademicUnitDto>(`/academic-units/${id}`),

  /** `POST /academic-units`. */
  create: (body: CreateAcademicUnitRequest) =>
    api.post<AcademicUnitDto, CreateAcademicUnitRequest>(
      "/academic-units",
      body,
    ),

  /** `PATCH /academic-units/:id`. Body is always complete — see the DTO. */
  update: (id: string, body: UpdateAcademicUnitRequest) =>
    api.patch<AcademicUnitDto, UpdateAcademicUnitRequest>(
      `/academic-units/${id}`,
      body,
    ),

  /**
   * `PATCH /academic-units/:id/move` → re-parent a unit.
   *
   * The only lifecycle endpoint across both academic modules that carries a
   * **request body**, and therefore the only one that names a target rather
   * than flipping a flag. That makes it idempotent, so it is safe to confirm
   * and fire, and safe to retry.
   *
   * `parentId: null` moves a unit to the root of its program.
   */
  move: (id: string, body: MoveAcademicUnitRequest) =>
    api.patch<AcademicUnitDto, MoveAcademicUnitRequest>(
      `/academic-units/${id}/move`,
      body,
    ),

  /**
   * `PATCH /academic-units/:id/status` → **toggle** the active flag.
   *
   * Sent with no body, because the recorded request has none: no
   * `Content-Type` header and no `body` key, while create, update and move all
   * have both. The absence is the contract.
   *
   * So the *target* state cannot be requested here and the call flips whatever
   * `isActive` currently is — non-idempotent, and treated with the same caution
   * as the branch and program toggles.
   *
   * Note the oddity: `isActive` **is** in the update body, so a target state
   * *can* be set — just through a different endpoint. See
   * `docs/backend-gaps.md`.
   */
  toggleStatus: (id: string) =>
    api.patch<AcademicUnitDto>(`/academic-units/${id}/status`),

  /**
   * `DELETE /academic-units/:id` → **soft delete**.
   *
   * The doc's Best Practices are explicit: "Never permanently remove nodes if
   * they have financial or academic trails. The engine prevents deleting parent
   * nodes if active children exist." The UI checks the second before offering
   * the action and names the blocking children.
   */
  remove: (id: string) => api.delete<void>(`/academic-units/${id}`),
} as const;
