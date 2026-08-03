import { api } from "@/core/api";

import type {
  InitSystemSettingsRequest,
  SystemSettingsDto,
  UpdateSystemSettingsRequest,
} from "../types/system-settings.dto";

/**
 * Transport for `/system-settings`.
 *
 * Not built on `createResourceService`: this is a **singleton** resource — one
 * record for the whole installation, with no id, no list and no delete — so the
 * CRUD factory's shape would be a lie. Three documented calls, written out.
 *
 * Paths carry no version segment; the client resolves them against the
 * configured `<origin>/v1` base.
 */
export const systemSettingsService = {
  /** `GET /system-settings` → the current global configuration. */
  get: () => api.get<SystemSettingsDto>("/system-settings"),

  /** `PATCH /system-settings` → update. Body is always complete; see the DTO. */
  update: (body: UpdateSystemSettingsRequest) =>
    api.patch<SystemSettingsDto, UpdateSystemSettingsRequest>(
      "/system-settings",
      body,
    ),

  /**
   * `POST /system-settings/init` → first-time initialization.
   *
   * Documented as allowed **once, ever**. Offered only when `get` reports the
   * record does not exist, and never retried automatically.
   */
  initialize: (body: InitSystemSettingsRequest) =>
    api.post<SystemSettingsDto, InitSystemSettingsRequest>(
      "/system-settings/init",
      body,
    ),
} as const;
