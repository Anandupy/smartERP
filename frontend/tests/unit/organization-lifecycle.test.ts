import { describe, expect, it } from "vitest";

// The modules under test, not the feature barrel — see the note in
// `audit-analytics.test.ts`.
import {
  filterOrganizations,
  type OrganizationFilters,
} from "@/features/organization/hooks/use-organizations";
import {
  ANY_STATUS,
  statusPresentation,
} from "@/features/organization/constants";
import {
  LIFECYCLE_STAGES,
  SUPPORTED_STAGES,
  daysUntilExpiry,
  expiryState,
  isCurrentStage,
} from "@/features/organization/utils/organization-lifecycle";

import {
  organizationDto,
  secondOrganizationDto,
} from "@tests/fixtures/organization";

const NOW = new Date("2026-08-03T12:00:00.000Z");

describe("expiryState", () => {
  it("reports a date well in the future as current", () => {
    expect(expiryState("2030-01-01", NOW)).toBe("current");
  });

  it("reports a date inside the warning window as expiring", () => {
    expect(expiryState("2026-08-20", NOW)).toBe("expiring");
  });

  it("reports a past date as expired", () => {
    expect(expiryState("2026-07-01", NOW)).toBe("expired");
  });

  it("reports a missing or unreadable date as unknown, never as current", () => {
    // Silently treating a bad value as "current" would hide a lapsed tenant.
    expect(expiryState(null, NOW)).toBe("unknown");
    expect(expiryState("", NOW)).toBe("unknown");
    expect(expiryState("whenever", NOW)).toBe("unknown");
  });
});

describe("daysUntilExpiry", () => {
  it("counts forward to a future date", () => {
    expect(daysUntilExpiry("2026-08-13", NOW)).toBe(10);
  });

  it("goes negative once the date has passed", () => {
    expect(daysUntilExpiry("2026-07-24", NOW)).toBeLessThan(0);
  });

  it("is null when the date cannot be read", () => {
    expect(daysUntilExpiry(null, NOW)).toBeNull();
    expect(daysUntilExpiry("nope", NOW)).toBeNull();
  });
});

describe("lifecycle model", () => {
  it("names every stage the design asks for", () => {
    expect(LIFECYCLE_STAGES.map((stage) => stage.label)).toEqual([
      "Draft",
      "Active",
      "Suspended",
      "Expired",
      "Deactivated",
    ]);
  });

  it("supports only the two stages the contract can actually reach", () => {
    // ACTIVE on create, INACTIVE via the documented soft delete. Nothing else
    // has an endpoint, and the UI must not pretend otherwise.
    expect(SUPPORTED_STAGES.map((stage) => stage.status)).toEqual([
      "ACTIVE",
      "INACTIVE",
    ]);
  });

  it("marks Draft, Suspended and Expired as unsupported", () => {
    const unsupported = LIFECYCLE_STAGES.filter((stage) => !stage.isSupported);

    expect(unsupported.map((stage) => stage.label)).toEqual([
      "Draft",
      "Suspended",
      "Expired",
    ]);
  });

  it("matches the current stage to the organization's status", () => {
    const active = organizationDto({ status: "ACTIVE" });
    const activeStage = LIFECYCLE_STAGES.find(
      (stage) => stage.label === "Active",
    )!;
    const deactivated = LIFECYCLE_STAGES.find(
      (stage) => stage.label === "Deactivated",
    )!;

    expect(isCurrentStage(activeStage, active)).toBe(true);
    expect(isCurrentStage(deactivated, active)).toBe(false);
  });

  it("never marks a stage with no status as current", () => {
    const draft = LIFECYCLE_STAGES.find((stage) => stage.label === "Draft")!;

    expect(isCurrentStage(draft, organizationDto({ status: null }))).toBe(
      false,
    );
  });
});

describe("statusPresentation", () => {
  it("labels each documented status", () => {
    expect(statusPresentation("ACTIVE").label).toBe("Active");
    expect(statusPresentation("INACTIVE").label).toBe("Inactive");
    expect(statusPresentation("SUSPENDED").label).toBe("Suspended");
  });

  it("falls back rather than crashing on a status it does not know", () => {
    expect(statusPresentation("ARCHIVED").label).toBe("ARCHIVED");
    expect(statusPresentation(null).label).toBe("Unknown");
    expect(statusPresentation(undefined).label).toBe("Unknown");
  });
});

describe("filterOrganizations", () => {
  const organizations = [
    organizationDto(),
    secondOrganizationDto({ status: "INACTIVE" }),
  ];
  const base: OrganizationFilters = { search: "", status: ANY_STATUS };

  it("returns everything when nothing is narrowed", () => {
    expect(filterOrganizations(organizations, base)).toHaveLength(2);
  });

  it("matches on name, code, contact, city and country", () => {
    for (const search of [
      "horizon",
      "avalon-university",
      "contact@avalon",
      "pune",
    ]) {
      expect(
        filterOrganizations(organizations, { ...base, search }),
      ).toHaveLength(1);
    }
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    expect(
      filterOrganizations(organizations, { ...base, search: "  HORIZON  " }),
    ).toHaveLength(1);
  });

  it("narrows by status", () => {
    expect(
      filterOrganizations(organizations, { ...base, status: "INACTIVE" }),
    ).toHaveLength(1);
    expect(
      filterOrganizations(organizations, { ...base, status: "SUSPENDED" }),
    ).toHaveLength(0);
  });

  it("combines search and status", () => {
    expect(
      filterOrganizations(organizations, {
        search: "avalon",
        status: "ACTIVE",
      }),
    ).toHaveLength(0);
  });
});
