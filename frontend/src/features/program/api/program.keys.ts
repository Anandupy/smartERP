import { createQueryKeys } from "@/core/query";

/**
 * Query keys for programs.
 *
 * The list key is parameterized by `branchId` through the factory's own
 * `list(filters)` overload, because the endpoint is: every program belongs to
 * one branch, `branchId` is documented required, and two branches' programs are
 * two different server responses that must never share a cache entry.
 * `lists()` remains the prefix that invalidates every branch at once.
 *
 * `tree` is a separate key because `GET /programs/tree` is a separate endpoint,
 * not a narrowing of the list.
 */
const base = createQueryKeys("programs");

export const programKeys = {
  ...base,
  /** Every program of one branch — `GET /programs?branchId=`. */
  listByBranch: (branchId: string) => base.list({ branchId }),
  /** The nested form — `GET /programs/tree?branchId=`. */
  tree: (branchId: string) => ["programs", "tree", branchId] as const,
} as const;
