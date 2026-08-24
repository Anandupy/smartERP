"use client";

import { useMutation } from "@tanstack/react-query";

import { provisionAdminService } from "../api/provision-admin.service";

/**
 * Provision an `ORG_ADMIN` (Path B — delegated setup).
 *
 * No cache to update on success: the new user is not part of any list this
 * feature reads, and the wizard's own progress is unaffected by it — an
 * `ORG_ADMIN` existing is not one of the mandatory foundation resources.
 */
export function useProvisionOrgAdmin() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: provisionAdminService.create,
  });
}
