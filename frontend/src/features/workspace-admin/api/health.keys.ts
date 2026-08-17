/**
 * Query keys for the health probes.
 *
 * Not built from `createQueryKeys` — these are three independent, unversioned,
 * unauthenticated endpoints, not a CRUD resource with a list/detail shape.
 */
export const healthKeys = {
  all: ["workspace-admin-health"] as const,
  live: () => ["workspace-admin-health", "live"] as const,
  ready: () => ["workspace-admin-health", "ready"] as const,
  full: () => ["workspace-admin-health", "full"] as const,
} as const;
