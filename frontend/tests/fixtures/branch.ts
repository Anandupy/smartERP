import type { BranchDto } from "@/features/branch/types/branch.dto";

/**
 * Builder for a branch.
 *
 * Carries the documented Data Structure plus the documented request fields, and
 * nothing else — no `createdAt`, no student or faculty counts, none of which
 * the contract promises.
 *
 * `isActive` is set by default so the common case exercises a known state; the
 * specs that matter most pass `isActive: undefined` explicitly, because no
 * response body is documented and an absent flag is a real possibility the UI
 * has to survive.
 */
export function branchDto(overrides: Partial<BranchDto> = {}): BranchDto {
  return {
    id: "branch-1",
    organizationId: "org-1",
    name: "Horizon High School — North Campus",
    code: "hhs-north",
    registrationNumber: "REG-001",
    institutionType: "SCHOOL",
    affiliationType: "BOARD",
    affiliationName: "CBSE",
    logoUrl: null,
    contactEmail: "north.branch@horizon.edu",
    contactPhone: "9876543210",
    addressLine1: "123 Education Lane",
    addressLine2: "Suite 400",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    pincode: "400001",
    structureMode: "DEFAULT",
    isActive: true,
    isDeleted: false,
    ...overrides,
  };
}

/** A second branch, so ordering and filtering have something to act on. */
export function secondBranchDto(overrides: Partial<BranchDto> = {}): BranchDto {
  return branchDto({
    id: "branch-2",
    name: "Avalon Institute — City Campus",
    code: "avalon-city",
    // Distinct, because the contract documents `registrationNumber` as unique
    // across the system — two fixtures sharing one would not occur in reality.
    registrationNumber: "REG-002",
    institutionType: "DEGREE_COLLEGE",
    affiliationType: "UNIVERSITY",
    affiliationName: "Mumbai University",
    contactEmail: "city@avalon.edu",
    city: "Pune",
    ...overrides,
  });
}
