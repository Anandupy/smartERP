import { api } from "@/core/api";

import type {
  CreateNumberingConfigRequest,
  NumberingConfigDto,
  PreviewNumberingRequest,
  PreviewNumberingResponse,
  UpdateNumberingConfigRequest,
} from "../types/numbering.dto";

/**
 * Transport for `/v1/numbering/configs`.
 *
 * No `GET /:id` and no `DELETE` are documented — only List, Provision, Edit
 * and Preview. A single record for editing is resolved out of the list read
 * (the same pattern Academic Year's missing `GET /:id` established).
 */
export const numberingService = {
  /** `GET /numbering/configs` — readable from the current org/branch scope. No documented query params. */
  list: () => api.get<NumberingConfigDto[]>("/numbering/configs"),

  /** `POST /numbering/configs`. */
  create: (body: CreateNumberingConfigRequest) =>
    api.post<NumberingConfigDto, CreateNumberingConfigRequest>(
      "/numbering/configs",
      body,
    ),

  /** `PATCH /numbering/configs/:id`. */
  update: (id: string, body: UpdateNumberingConfigRequest) =>
    api.patch<NumberingConfigDto, UpdateNumberingConfigRequest>(
      `/numbering/configs/${id}`,
      body,
    ),

  /** `POST /numbering/configs/:id/preview` — renders a sample without consuming a number. */
  preview: (id: string, body: PreviewNumberingRequest) =>
    api.post<PreviewNumberingResponse, PreviewNumberingRequest>(
      `/numbering/configs/${id}/preview`,
      body,
    ),
} as const;
