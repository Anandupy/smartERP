import { createQueryKeys } from "@/core/query";

/**
 * Query keys for maintenance rules.
 *
 * `lists()` is unparameterized because the endpoint takes no query parameters:
 * there is exactly one server-side list, and filtering happens in the client.
 * Keying by filters would create cache entries that all hold the same response.
 */
export const maintenanceKeys = {
  ...createQueryKeys("maintenance-rules"),
  /** The resolved rule applying to the caller's current scope. */
  activeStatus: () => ["maintenance-rules", "active-status"] as const,
} as const;
