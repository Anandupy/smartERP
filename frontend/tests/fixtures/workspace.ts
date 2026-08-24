import type {
  IdentityAcademicYearDto,
  IdentityBranchDto,
  IdentityDto,
  IdentityScopeDto,
  IdentitySetupDto,
} from "@/features/workspace";

/**
 * Identity fixtures for the workspace flow.
 *
 * Shaped so the interesting cases are one call apart: the default payload has a
 * real choice at every level, `singleChoiceIdentity` has none, and
 * `scopedRoleIdentity` is not entitled to choose at all — the three inputs the
 * resolution policy branches on.
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
 * the single-tenant install. Every level settles automatically, so this is the
 * payload that distinguishes "pre-answered and confirmed" from "skipped
 * outright": which one happens is `alwaysShowSelection`'s call.
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

/**
 * The workspace bootstrap block, complete by default.
 *
 * Setup tests override `setupRequired`/`missingResources`/`completedResources`
 * per scenario; a fixture that already reflects "done" keeps every unrelated
 * workspace-selection test — which never sets `setup` at all — unaffected,
 * since `identityDto()` still omits this field unless a test opts in.
 */
export function setupStatusDto(
  overrides: Partial<IdentitySetupDto> = {},
): IdentitySetupDto {
  return {
    setupRequired: false,
    setupStage: "COMPLETED",
    missingResources: [],
    completedResources: ["SYSTEM_SETTINGS", "ORGANIZATION", "BRANCH", "ACADEMIC_YEAR"],
    allowedActions: [],
    initializedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A fresh installation: nothing configured yet, every resource missing. */
export function freshInstallSetupDto(
  overrides: Partial<IdentitySetupDto> = {},
): IdentitySetupDto {
  return setupStatusDto({
    setupRequired: true,
    setupStage: "SYSTEM_SETTINGS",
    missingResources: [
      "SYSTEM_SETTINGS",
      "ORGANIZATION",
      "BRANCH",
      "ACADEMIC_YEAR",
    ],
    completedResources: [],
    initializedAt: null,
    ...overrides,
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
