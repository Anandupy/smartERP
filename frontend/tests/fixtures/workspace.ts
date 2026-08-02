import type {
  IdentityAcademicYearDto,
  IdentityBranchDto,
  IdentityDto,
  IdentityScopeDto,
} from "@/features/workspace";

/**
 * Identity fixtures for the workspace flow.
 *
 * Shaped so the interesting cases are one call apart: the default payload has a
 * real choice at every level, and `singleChoiceIdentity` has none — which is
 * the difference between showing the selection screen and skipping it.
 */

export const organizationsFixture: IdentityScopeDto[] = [
  { id: "org-1", name: "Universal Educational Trust", code: "UET-2024" },
  { id: "org-2", name: "Northfield Education Group", code: "NEG-2024" },
];

export const branchesFixture: IdentityBranchDto[] = [
  {
    id: "branch-1",
    name: "Downtown Campus",
    code: "DTC",
    organizationId: "org-1",
  },
  {
    id: "branch-2",
    name: "West-Side Polytechnic",
    code: "WSP",
    organizationId: "org-1",
  },
  {
    id: "branch-3",
    name: "Northfield Central",
    code: "NFC",
    organizationId: "org-2",
  },
];

export const academicYearsFixture: IdentityAcademicYearDto[] = [
  {
    id: "ay-2026",
    name: "AY 2026-2027",
    code: "2026-27",
    organizationId: "org-1",
    branchId: null,
  },
  {
    id: "ay-2025",
    name: "AY 2025-2026",
    code: "2025-26",
    organizationId: "org-1",
    branchId: null,
  },
  {
    id: "ay-2026-neg",
    name: "AY 2026-2027 (Northfield)",
    code: "2026-27",
    organizationId: "org-2",
    branchId: null,
  },
];

/** A super administrator with a genuine choice at every level. */
export function identityDto(overrides: Partial<IdentityDto> = {}): IdentityDto {
  return {
    user: {
      id: "user-1",
      fullName: "Amaan Sheikh",
      email: "admin@institution.edu",
      role: "SUPER_ADMIN",
    },
    permissions: ["students:read", "fees:read"],
    context: { organizationId: null, branchId: null, academicYearId: null },
    availableOrganizations: organizationsFixture,
    availableBranches: branchesFixture,
    availableAcademicYears: academicYearsFixture,
    ...overrides,
  };
}

/**
 * A privileged user with exactly one organization, campus and academic year —
 * the single-tenant install that must never see a selection step.
 */
export function singleChoiceIdentity(): IdentityDto {
  return identityDto({
    context: {
      organizationId: "org-1",
      branchId: "branch-1",
      academicYearId: "ay-2026",
    },
    availableOrganizations: [organizationsFixture[0]],
    availableBranches: [branchesFixture[0]],
    availableAcademicYears: [academicYearsFixture[0]],
  });
}

/** A backend-scoped role: it is told its scope rather than choosing one. */
export function scopedRoleIdentity(role = "BRANCH_ADMIN"): IdentityDto {
  return identityDto({
    user: {
      id: "user-2",
      fullName: "Priya Nair",
      email: "priya@institution.edu",
      role,
    },
    context: {
      organizationId: "org-1",
      branchId: "branch-1",
      academicYearId: "ay-2026",
    },
  });
}
