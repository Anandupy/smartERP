import { api } from "@/core/api";

import type {
  CreateProgramRequest,
  ProgramDto,
  UpdateProgramRequest,
} from "../types/program.dto";

/**
 * Transport for `/programs`.
 *
 * Written out rather than built from `createResourceService`, for the reason
 * every other module's is: the factory's `list` appends `?page=…&pageSize=…`,
 * and the only query parameter documented here is `branchId`.
 *
 * Paths carry no version segment — the client resolves them against the
 * configured `<origin>/v1` base.
 *
 * `branchId` is documented `(Required)` on both list endpoints, and every
 * request in the collection carries an `x-branch-id` header. The header is
 * supplied by the platform's `headerRegistry` once the workspace scope is
 * `ready`; the query parameter is this module's to pass.
 */
export const programService = {
  /** `GET /programs?branchId=` → every program of one branch. */
  list: (branchId: string) =>
    api.get<ProgramDto[]>("/programs", { params: { branchId } }),

  /**
   * `GET /programs/tree?branchId=` → the same programs, nested.
   *
   * Wired because it is documented, but **nothing depends on its shape**: the
   * endpoint is described by name alone — no response body, no nesting key, no
   * statement of whether it returns roots or a wrapper. The tree screen builds
   * its hierarchy from the flat list with the shared `buildTree`, which needs
   * only `parentId` — a field both request bodies document.
   *
   * Typed `unknown` rather than as a guessed interface, per the platform's rule
   * for undocumented responses. `readProgramTree` narrows it defensively and
   * reports `isUnrecognized` when it cannot.
   */
  tree: (branchId: string) =>
    api.get<unknown>("/programs/tree", { params: { branchId } }),

  /** `GET /programs/:id`. */
  get: (id: string) => api.get<ProgramDto>(`/programs/${id}`),

  /** `POST /programs`. ADMIN per the documented access column. */
  create: (body: CreateProgramRequest) =>
    api.post<ProgramDto, CreateProgramRequest>("/programs", body),

  /** `PATCH /programs/:id`. Body is always complete — see the DTO. */
  update: (id: string, body: UpdateProgramRequest) =>
    api.patch<ProgramDto, UpdateProgramRequest>(`/programs/${id}`, body),

  /**
   * `PATCH /programs/:id/status` → **toggle** the active flag.
   *
   * Sent with no body, because the recorded request has none: no
   * `Content-Type` header and no `body` key, while create and update have both.
   * The absence is the contract.
   *
   * The consequence is the branch toggle's: the *target* state cannot be
   * requested, so the call flips whatever `isActive` currently is. That makes
   * it non-idempotent, so the UI never fires it speculatively, never retries
   * it, and withholds it entirely when the current state was not reported.
   */
  toggleStatus: (id: string) => api.patch<ProgramDto>(`/programs/${id}/status`),

  /**
   * `DELETE /programs/:id` → **soft delete**, per the endpoint table.
   *
   * Documented validation rule 4 refuses it while the program has active
   * children, so the UI checks that before offering the action and names the
   * blocking children.
   */
  remove: (id: string) => api.delete<void>(`/programs/${id}`),
} as const;
