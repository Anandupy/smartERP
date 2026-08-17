"use client";

import { useQuery } from "@tanstack/react-query";

import { navigationKeys } from "../api/navigation.keys";
import { navigationService } from "../api/navigation.service";

/**
 * The caller's own runtime navigation tree. Any authenticated user may call
 * this; it is not gated to Super Admin, since it answers "what do I see,"
 * never "what exists."
 */
export function useNavigationTree() {
  return useQuery({
    queryKey: navigationKeys.tree(),
    queryFn: navigationService.getTree,
    meta: { skipErrorToast: true },
  });
}
