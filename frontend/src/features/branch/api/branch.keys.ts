import { createQueryKeys } from "@/core/query";

/**
 * Query keys for branches.
 *
 * `lists()` is unparameterized because the list endpoint takes no query
 * parameters. `byOrganization` is a separate key because it is a genuinely
 * different server response — a different endpoint, not a filter over the same
 * one — and the two must not share a cache entry.
 */
const base = createQueryKeys("branches");

export const branchKeys = {
  ...base,
  byOrganization: (organizationId: string) =>
    ["branches", "organization", organizationId] as const,
} as const;
