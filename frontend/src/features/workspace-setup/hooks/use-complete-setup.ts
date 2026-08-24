"use client";

import { useMutation } from "@tanstack/react-query";

import { setupCompletionService } from "../api/setup.service";

/**
 * Mark the workspace initialized.
 *
 * Server-validated and idempotent on the backend (`ConflictException` if a
 * required resource is still missing); this hook adds nothing on top —
 * refreshing identity so the rest of the app learns the workspace is ready is
 * the composing route's job, not this feature's (see `api/setup.service.ts`).
 */
export function useCompleteSetup() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: () => setupCompletionService.complete(),
  });
}
