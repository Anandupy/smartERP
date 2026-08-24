import { describe, expect, it } from "vitest";

import type { AuthUser } from "@/core/auth";
import {
  toDefaultSelection,
  toIdentityUser,
  toPermissions,
  toWorkspaceAvailability,
  toWorkspaceSetupStatus,
} from "@/features/workspace";
import { freshInstallSetupDto, identityDto, setupStatusDto } from "@tests/fixtures/workspace";

/**
 * Translation of `/auth/me` into the shapes the app codes against.
 *
 * The interesting cases are all about tolerance: the payload is shaped by the
 * caller's role, so absent lists and absent fields are normal responses rather
 * than faults, and every one of them has to produce something usable.
 */

describe("scope lists", () => {
  it("normalizes each level and keeps its scope links", () => {
    const availability = toWorkspaceAvailability(identityDto());

    expect(availability.organizations).toHaveLength(2);
    expect(availability.branches[0]).toEqual({
      id: "branch-1",
      name: "Downtown Campus",
      code: "DTC",
      organizationId: "org-1",
    });
    expect(availability.academicYears[0].branchId).toBeNull();
    expect(availability.role).toBe("SUPER_ADMIN");
  });

  it("treats an absent list as an empty one", () => {
    const availability = toWorkspaceAvailability(
      identityDto({
        availableOrganizations: null,
        availableBranches: undefined,
        availableAcademicYears: [],
      }),
    );

    expect(availability.organizations).toEqual([]);
    expect(availability.branches).toEqual([]);
    expect(availability.academicYears).toEqual([]);
  });

  it("drops an entry with no usable id", () => {
    const availability = toWorkspaceAvailability(
      identityDto({
        availableOrganizations: [
          { id: "", name: "Nameless" },
          { id: "org-9", name: "Real" },
        ],
      }),
    );

    // An option nothing can be selected by is worse than one fewer option.
    expect(availability.organizations.map((o) => o.id)).toEqual(["org-9"]);
  });

  it("falls back from name to code to id, and never to an empty label", () => {
    const availability = toWorkspaceAvailability(
      identityDto({
        availableOrganizations: [
          { id: "org-a", name: "  ", code: "CODE-A" },
          { id: "org-b", name: null, code: null },
        ],
      }),
    );

    expect(availability.organizations[0].name).toBe("CODE-A");
    expect(availability.organizations[1].name).toBe("org-b");
  });

  it("reads the backend context as the default scope", () => {
    expect(
      toDefaultSelection(
        identityDto({
          context: {
            organizationId: "org-1",
            branchId: null,
            academicYearId: "ay-2026",
          },
        }),
      ),
    ).toEqual({
      organizationId: "org-1",
      branchId: null,
      academicYearId: "ay-2026",
    });
  });
});

describe("permissions", () => {
  it("accepts plain strings", () => {
    expect(toPermissions(["students:read", "fees:write"])).toEqual([
      "students:read",
      "fees:write",
    ]);
  });

  it("accepts objects carrying the permission under a known key", () => {
    expect(
      toPermissions([
        { code: "students:read" },
        { name: "fees:write" },
        { permission: "hr:read" },
      ]),
    ).toEqual(["students:read", "fees:write", "hr:read"]);
  });

  it("drops anything it cannot read, so checks fail closed", () => {
    expect(toPermissions([{ id: 7 }, null, 42, "", "  "])).toEqual([]);
    expect(toPermissions(undefined)).toEqual([]);
    expect(toPermissions("students:read")).toEqual([]);
  });
});

describe("identity user", () => {
  const fallback: AuthUser = {
    id: "user-1",
    name: "admin@institution.edu",
    email: "admin@institution.edu",
    roles: ["ORG_ADMIN"],
    permissions: [],
  };

  it("replaces the token-claim stand-ins with the real identity", () => {
    const user = toIdentityUser(identityDto(), fallback);

    expect(user.name).toBe("Amaan Sheikh");
    expect(user.roles).toEqual(["SUPER_ADMIN"]);
    // The whole point of the endpoint: `can()` stops failing closed.
    expect(user.permissions).toEqual(["students:read", "fees:read"]);
  });

  it("keeps the address from the access token when /auth/me omits it", () => {
    const user = toIdentityUser(
      identityDto({
        user: { id: "user-1", fullName: "Amaan Sheikh", role: "SUPER_ADMIN" },
      }),
      fallback,
    );

    expect(user.email).toBe("admin@institution.edu");
  });

  it("falls back to the email when there is no name to show", () => {
    const user = toIdentityUser(
      identityDto({
        user: {
          id: "user-1",
          fullName: null,
          email: "person@institution.edu",
          role: "STAFF",
        },
      }),
      null,
    );

    expect(user.name).toBe("person@institution.edu");
  });
});

describe("workspace setup status", () => {
  it("returns null when the backend omits the block entirely", () => {
    expect(toWorkspaceSetupStatus(identityDto())).toBeNull();
  });

  it("returns null when setupRequired is missing or the wrong type", () => {
    expect(
      toWorkspaceSetupStatus(identityDto({ setup: {} })),
    ).toBeNull();
    expect(
      toWorkspaceSetupStatus(
        identityDto({ setup: { setupRequired: "yes" as never } }),
      ),
    ).toBeNull();
  });

  it("normalizes a fresh install", () => {
    const status = toWorkspaceSetupStatus(
      identityDto({ setup: freshInstallSetupDto() }),
    );

    expect(status).toEqual({
      setupRequired: true,
      setupStage: "SYSTEM_SETTINGS",
      missingResources: [
        "SYSTEM_SETTINGS",
        "ORGANIZATION",
        "BRANCH",
        "ACADEMIC_YEAR",
      ],
      completedResources: [],
      allowedActions: [],
      initializedAt: null,
    });
  });

  it("drops an unrecognized resource rather than guessing", () => {
    const status = toWorkspaceSetupStatus(
      identityDto({
        setup: setupStatusDto({
          setupRequired: true,
          missingResources: ["PROGRAMS" as never, "BRANCH"],
        }),
      }),
    );

    expect(status?.missingResources).toEqual(["BRANCH"]);
  });

  it("falls back to the first stage for an unrecognized setupStage", () => {
    const status = toWorkspaceSetupStatus(
      identityDto({
        setup: setupStatusDto({
          setupRequired: true,
          setupStage: "SOMETHING_NEW" as never,
        }),
      }),
    );

    expect(status?.setupStage).toBe("SYSTEM_SETTINGS");
  });

  it("drops an action missing a required field instead of a partial entry", () => {
    const status = toWorkspaceSetupStatus(
      identityDto({
        setup: setupStatusDto({
          setupRequired: true,
          allowedActions: [
            { action: "VIEW", method: "GET", path: "/auth/me" },
            { action: "BROKEN", method: null, path: "/x" },
          ],
        }),
      }),
    );

    expect(status?.allowedActions).toEqual([
      { action: "VIEW", method: "GET", path: "/auth/me", description: "" },
    ]);
  });
});
