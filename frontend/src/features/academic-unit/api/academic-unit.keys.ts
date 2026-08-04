import { createQueryKeys } from "@/core/query";

import type { AcademicUnitScope } from "./academic-unit.service";

/**
 * Query keys for academic units.
 *
 * The list key is parameterized by **both** scope ids, because the endpoint is:
 * `branchId` and `academicYearId` are both documented required, and the same
 * branch in two academic years is genuinely two different structures — the
 * module doc's whole premise is that units "increase, decrease, or split
 * entirely based on enrollment for that specific academic year". Sharing a
 * cache entry between years would show last year's sections.
 *
 * `lists()` remains the prefix that invalidates every scope at once.
 */
const base = createQueryKeys("academic-units");

export const academicUnitKeys = {
  ...base,
  /** Every unit in one branch-and-year — `GET /academic-units?…`. */
  listByScope: (scope: AcademicUnitScope) => base.list({ ...scope }),
  /** The nested form — `GET /academic-units/tree?…`. */
  tree: (scope: AcademicUnitScope) =>
    ["academic-units", "tree", scope.branchId, scope.academicYearId] as const,
} as const;
