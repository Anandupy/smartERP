import { api } from "@/core/api";

import type {
  CreateMaintenanceRuleRequest,
  MaintenanceRuleDto,
  UpdateMaintenanceRuleRequest,
} from "../types/maintenance.dto";

/**
 * Transport for `/maintenance-rules`.
 *
 * Written out rather than built from `createResourceService` for one reason:
 * the factory's `list` sends pagination parameters, and **the maintenance list
 * endpoint documents none**. Handing it a factory that quietly appends
 * `?page=1&pageSize=20` would be inventing query contract on every request.
 *
 * `list` therefore returns the whole collection, and the list screen filters,
 * searches and pages it client-side — see `hooks/use-maintenance-rules.ts`.
 */
export const maintenanceService = {
  /** `GET /maintenance-rules` → every rule. No documented query parameters. */
  list: () => api.get<MaintenanceRuleDto[]>("/maintenance-rules"),

  /** `GET /maintenance-rules/:id` → one rule. */
  get: (id: string) => api.get<MaintenanceRuleDto>(`/maintenance-rules/${id}`),

  /** `POST /maintenance-rules` → create. */
  create: (body: CreateMaintenanceRuleRequest) =>
    api.post<MaintenanceRuleDto, CreateMaintenanceRuleRequest>(
      "/maintenance-rules",
      body,
    ),

  /** `PATCH /maintenance-rules/:id` → update. Body is always complete. */
  update: (id: string, body: UpdateMaintenanceRuleRequest) =>
    api.patch<MaintenanceRuleDto, UpdateMaintenanceRuleRequest>(
      `/maintenance-rules/${id}`,
      body,
    ),

  /** `DELETE /maintenance-rules/:id` → remove. */
  remove: (id: string) => api.delete<void>(`/maintenance-rules/${id}`),

  /**
   * `GET /maintenance-rules/active/status` → the rule currently applying to
   * this request's context. Public; resolved from the scope headers.
   *
   * Typed `unknown` on purpose. The documentation describes what it *means*
   * ("the active maintenance details applying to the request") but records no
   * response body, so there is nothing here to type against. Consumers narrow
   * it with `readActiveStatus`, which reads only field names the rule table
   * already defines and gives up cleanly when it recognizes nothing.
   */
  activeStatus: () => api.get<unknown>("/maintenance-rules/active/status"),
} as const;
