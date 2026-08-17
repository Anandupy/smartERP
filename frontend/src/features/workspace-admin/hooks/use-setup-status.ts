"use client";

import { useQuery } from "@tanstack/react-query";

import { setupKeys } from "../api/setup.keys";
import { setupService } from "../api/setup.service";

/**
 * Bootstrap status. `enabled` defaults to `true`; pass `false` from a screen a
 * non-admin role can reach, since the endpoint is `SUPER_ADMIN`/`ORG_ADMIN`
 * only and would otherwise fire a request that can only ever 403.
 */
export function useSetupStatus(enabled = true) {
  return useQuery({
    queryKey: setupKeys.status(),
    queryFn: setupService.getStatus,
    enabled,
    meta: { skipErrorToast: true },
  });
}
