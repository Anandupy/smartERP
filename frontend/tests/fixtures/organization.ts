import type { OrganizationDto } from "@/features/organization/types/organization.dto";

/**
 * Builder for an organization.
 *
 * Carries the documented Data Structure and nothing else — no `createdAt`, no
 * `type`, no branch or student counts, none of which the contract promises. A
 * fixture with an invented field would let a test pass against something the
 * backend never returns, which is the specific failure this milestone exists
 * to avoid.
 *
 * `masterExpiryDate` is far in the future by default so the expiry helpers
 * report "current"; specs that need the expired or expiring branches pass
 * their own date.
 */
export function organizationDto(
  overrides: Partial<OrganizationDto> = {},
): OrganizationDto {
  return {
    id: "org-1",
    name: "Horizon Education Trust",
    code: "horizon-trust",
    logoUrl: null,
    contactEmail: "admin@horizon.edu",
    contactPhone: "9876543210",
    masterExpiryDate: "2099-12-31",
    addressLine1: "100 Corporate Towers",
    addressLine2: "Financial District",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    pincode: "400001",
    timezone: "Asia/Kolkata",
    currency: "INR",
    status: "ACTIVE",
    ...overrides,
  };
}

/** A second organization, so ordering and filtering have something to act on. */
export function secondOrganizationDto(
  overrides: Partial<OrganizationDto> = {},
): OrganizationDto {
  return organizationDto({
    id: "org-2",
    name: "Avalon University Group",
    code: "avalon-university",
    contactEmail: "contact@avalon.edu",
    city: "Pune",
    ...overrides,
  });
}
