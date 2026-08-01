import { createQueryKeys } from "@/core/query";

/**
 * Query keys for the auth feature. Built with the platform factory so
 * invalidation stays precise and consistent with every other module.
 *
 * `sessions()` is the only cached read the auth API exposes; the rest of the
 * surface is mutations.
 */
const keys = createQueryKeys("auth");

export const authKeys = {
  ...keys,
  /** Active sessions for the signed-in user. */
  sessions: () => keys.list({ resource: "sessions" }),
} as const;
