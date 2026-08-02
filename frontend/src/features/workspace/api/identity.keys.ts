import { createQueryKeys } from "@/core/query";

/**
 * Query keys for identity. Built with the platform factory so invalidation
 * stays precise and keys never drift from the convention.
 *
 * `identityKeys.detail("me")` is the signed-in user's identity — invalidate it
 * after anything that could change their scopes or permissions.
 */
export const identityKeys = createQueryKeys("identity");

/** The one identity query the app makes: the current user's own record. */
export const CURRENT_IDENTITY = "me";
