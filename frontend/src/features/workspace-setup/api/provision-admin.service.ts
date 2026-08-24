import { api } from "@/core/api";

import type {
  CreateOrgAdminRequest,
  ProvisionedAdminDto,
} from "../types/provision-org-admin.dto";

/** Reuses the existing user-creation endpoint — see `types/provision-org-admin.dto.ts`. */
export const provisionAdminService = {
  create: (body: CreateOrgAdminRequest) =>
    api.post<ProvisionedAdminDto, CreateOrgAdminRequest>("/users", body),
} as const;
