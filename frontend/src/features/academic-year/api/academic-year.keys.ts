import { createQueryKeys } from "@/core/query";

/**
 * Query keys for academic years.
 *
 * The list key is parameterized by `branchId` through the factory's own
 * `list(filters)` overload, because the endpoint is: every academic year
 * belongs to one branch, `branchId` is a documented **required** query
 * parameter, and two branches' years are two different server responses that
 * must never share a cache entry. `lists()` remains the prefix that invalidates
 * every branch at once.
 *
 * `current` is its own key rather than a filter over the list, for the same
 * reason `branchKeys.byOrganization` is: `GET /academic-years/current` is a
 * separate endpoint, not a narrowing of another one.
 */
const base = createQueryKeys("academic-years");

export const academicYearKeys = {
  ...base,
  /** Every year of one branch — `GET /academic-years?branchId=`. */
  listByBranch: (branchId: string) => base.list({ branchId }),
  /** The branch's selected year — `GET /academic-years/current?branchId=`. */
  current: (branchId: string) =>
    ["academic-years", "current", branchId] as const,
} as const;
