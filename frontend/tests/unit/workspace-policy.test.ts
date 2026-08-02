import { describe, expect, it } from "vitest";

import { ROUTES } from "@/constants";
import {
  academicYearsFor,
  branchesFor,
  canSkipSelection,
  hasRealChoice,
  narrowSelection,
  resolvePostAuthRoute,
  resolveWorkspaceAccess,
  roleRequiresSelection,
  type WorkspaceAvailability,
} from "@/core/workspace";

/**
 * The workspace decision, tested where it lives: pure functions with no store,
 * no query and no React. Every rule the screen relies on is asserted here, so a
 * change in policy fails in one small file rather than in a rendered flow.
 */

const ORGANIZATIONS = [
  { id: "org-1", name: "Universal Educational Trust", code: "UET" },
  { id: "org-2", name: "Northfield Education Group", code: "NEG" },
];

const BRANCHES = [
  { id: "branch-1", name: "Downtown", code: "DTC", organizationId: "org-1" },
  { id: "branch-2", name: "West-Side", code: "WSP", organizationId: "org-1" },
  { id: "branch-3", name: "Northfield", code: "NFC", organizationId: "org-2" },
];

const YEARS = [
  {
    id: "ay-2026",
    name: "AY 2026-27",
    code: null,
    organizationId: "org-1",
    branchId: null,
  },
  {
    id: "ay-2025",
    name: "AY 2025-26",
    code: null,
    organizationId: "org-1",
    branchId: null,
  },
  {
    id: "ay-neg",
    name: "AY 2026-27",
    code: null,
    organizationId: "org-2",
    branchId: null,
  },
];

function availability(
  overrides: Partial<WorkspaceAvailability> = {},
): WorkspaceAvailability {
  return {
    organizations: ORGANIZATIONS,
    branches: BRANCHES,
    academicYears: YEARS,
    defaults: { organizationId: null, branchId: null, academicYearId: null },
    role: "SUPER_ADMIN",
    ...overrides,
  };
}

/** Exactly one organization, campus and year — the single-tenant install. */
const SINGLE = availability({
  organizations: [ORGANIZATIONS[0]],
  branches: [BRANCHES[0]],
  academicYears: [YEARS[0]],
});

const SINGLE_SELECTION = {
  organizationId: "org-1",
  branchId: "branch-1",
  academicYearId: "ay-2026",
};

/** The opt-in behavior: skip the screen when there is nothing to ask. */
const SKIPPABLE = { alwaysShowSelection: false };

describe("role gate", () => {
  it("asks only super and organization administrators to choose", () => {
    expect(roleRequiresSelection("SUPER_ADMIN")).toBe(true);
    expect(roleRequiresSelection("ORG_ADMIN")).toBe(true);
    expect(roleRequiresSelection("BRANCH_ADMIN")).toBe(false);
    expect(roleRequiresSelection("STAFF")).toBe(false);
    expect(roleRequiresSelection(null)).toBe(false);
  });
});

describe("filtering", () => {
  it("returns only the branches of the chosen organization", () => {
    expect(branchesFor(BRANCHES, "org-1").map((b) => b.id)).toEqual([
      "branch-1",
      "branch-2",
    ]);
  });

  it("treats an unlinked branch as available under every organization", () => {
    const unscoped = [
      ...BRANCHES,
      { id: "shared", name: "Shared", code: null, organizationId: null },
    ];
    expect(branchesFor(unscoped, "org-2").map((b) => b.id)).toContain("shared");
  });

  it("offers nothing until an organization is chosen", () => {
    // Distinct from "everything": no organization means no scope at all, and
    // showing every branch would invite a choice that cannot be honored.
    expect(branchesFor(BRANCHES, null)).toEqual([]);
    expect(
      academicYearsFor(YEARS, { organizationId: null, branchId: "branch-1" }),
    ).toEqual([]);
  });

  it("narrows academic years by organization and branch together", () => {
    const branchScoped = [
      ...YEARS,
      {
        id: "ay-branch",
        name: "Branch only",
        code: null,
        organizationId: "org-1",
        branchId: "branch-2",
      },
    ];

    const forBranch1 = academicYearsFor(branchScoped, {
      organizationId: "org-1",
      branchId: "branch-1",
    });
    expect(forBranch1.map((y) => y.id)).toEqual(["ay-2026", "ay-2025"]);

    const forBranch2 = academicYearsFor(branchScoped, {
      organizationId: "org-1",
      branchId: "branch-2",
    });
    expect(forBranch2.map((y) => y.id)).toContain("ay-branch");
  });
});

describe("cascading", () => {
  it("auto-fills a level that has exactly one option", () => {
    const single = availability({
      organizations: [ORGANIZATIONS[0]],
      branches: [BRANCHES[0]],
      academicYears: [YEARS[0]],
    });

    expect(
      narrowSelection(single, {
        organizationId: null,
        branchId: null,
        academicYearId: null,
      }),
    ).toEqual({
      organizationId: "org-1",
      branchId: "branch-1",
      academicYearId: "ay-2026",
    });
  });

  it("drops a branch and year that belonged to the previous organization", () => {
    const next = narrowSelection(
      availability(),
      {
        organizationId: "org-1",
        branchId: "branch-1",
        academicYearId: "ay-2026",
      },
      { organizationId: "org-2" },
    );

    // org-2 has exactly one branch and one year, so both settle automatically;
    // what matters is that neither kept its org-1 value.
    expect(next.organizationId).toBe("org-2");
    expect(next.branchId).toBe("branch-3");
    expect(next.academicYearId).toBe("ay-neg");
  });

  it("keeps a still-valid selection untouched", () => {
    const current = {
      organizationId: "org-1",
      branchId: "branch-1",
      academicYearId: "ay-2026",
    };
    expect(narrowSelection(availability(), current)).toEqual(current);
  });

  it("discards an id that is no longer offered", () => {
    const next = narrowSelection(availability(), {
      organizationId: "org-deleted",
      branchId: "branch-1",
      academicYearId: "ay-2026",
    });
    expect(next.organizationId).toBeNull();
    expect(next.branchId).toBeNull();
    expect(next.academicYearId).toBeNull();
  });
});

describe("resolution", () => {
  it("reports no organizations when the account is mapped to none", () => {
    const result = resolveWorkspaceAccess(
      availability({ organizations: [], branches: [], academicYears: [] }),
    );
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("no-organizations");
  });

  it("sends a backend-scoped role straight through with its own context", () => {
    const result = resolveWorkspaceAccess(
      availability({
        role: "STAFF",
        defaults: {
          organizationId: "org-1",
          branchId: "branch-1",
          academicYearId: "ay-2026",
        },
      }),
    );

    expect(result.status).toBe("ready");
    expect(result.selection.branchId).toBe("branch-1");
  });

  it("still asks a privileged user with only one possible answer", () => {
    // The default policy is "always show": the user is shown the organization,
    // campus and year they are entering and confirms them, rather than being
    // moved somewhere they were never told about.
    const result = resolveWorkspaceAccess(SINGLE);

    expect(result.status).toBe("selecting");
    // Pre-answered, so Continue is the only thing left to do.
    expect(result.selection).toEqual(SINGLE_SELECTION);
  });

  it("skips that screen once the institution allows it", () => {
    const result = resolveWorkspaceAccess(SINGLE, undefined, SKIPPABLE);

    expect(result.status).toBe("ready");
    expect(result.selection).toEqual(SINGLE_SELECTION);
  });

  it("keeps asking under either policy when a real choice exists", () => {
    // The setting only governs the case with one possible answer; it can never
    // choose *for* a user who has alternatives.
    expect(
      resolveWorkspaceAccess(availability(), undefined, SKIPPABLE).status,
    ).toBe("selecting");
  });

  it("sends a backend-scoped role through under either policy", () => {
    // The role gate is settled before the setting is consulted, so an
    // institution that turns "always show" on does not start asking teachers.
    const scoped = availability({
      role: "STAFF",
      defaults: SINGLE_SELECTION,
    });

    expect(resolveWorkspaceAccess(scoped).status).toBe("ready");
    expect(resolveWorkspaceAccess(scoped, undefined, SKIPPABLE).status).toBe(
      "ready",
    );
  });

  it("asks a privileged user to choose when a real choice exists", () => {
    const result = resolveWorkspaceAccess(availability());
    expect(result.status).toBe("selecting");
    expect(result.reason).toBeNull();
  });

  it("still asks when the backend supplies a complete default among many", () => {
    // A default is a suggestion, not a decision: with two organizations on
    // offer the user is entitled to pick the other one.
    const result = resolveWorkspaceAccess(
      availability({
        defaults: {
          organizationId: "org-1",
          branchId: "branch-1",
          academicYearId: "ay-2026",
        },
      }),
    );

    expect(result.status).toBe("selecting");
    expect(result.selection.organizationId).toBe("org-1");
  });

  it("prefers the user's own last selection over the backend default", () => {
    const result = resolveWorkspaceAccess(
      availability({
        defaults: {
          organizationId: "org-1",
          branchId: "branch-1",
          academicYearId: "ay-2026",
        },
      }),
      { organizationId: "org-2", branchId: null, academicYearId: null },
    );

    expect(result.selection.organizationId).toBe("org-2");
  });

  it("ignores a remembered selection the backend no longer offers", () => {
    const result = resolveWorkspaceAccess(availability(), {
      organizationId: "org-revoked",
      branchId: "branch-revoked",
      academicYearId: null,
    });

    expect(result.status).toBe("selecting");
    expect(result.selection.organizationId).toBeNull();
  });

  it("reports the exact level that came up empty", () => {
    const noBranches = resolveWorkspaceAccess(
      availability({ organizations: [ORGANIZATIONS[0]], branches: [] }),
    );
    expect(noBranches.status).toBe("unavailable");
    expect(noBranches.reason).toBe("no-branches");

    const noYears = resolveWorkspaceAccess(
      availability({
        organizations: [ORGANIZATIONS[0]],
        branches: [BRANCHES[0]],
        academicYears: [],
      }),
    );
    expect(noYears.status).toBe("unavailable");
    expect(noYears.reason).toBe("no-academic-years");
  });
});

describe("hasRealChoice", () => {
  it("is false when every level has one option", () => {
    const single = availability({
      organizations: [ORGANIZATIONS[0]],
      branches: [BRANCHES[0]],
      academicYears: [YEARS[0]],
    });
    expect(
      hasRealChoice(single, {
        organizationId: "org-1",
        branchId: "branch-1",
        academicYearId: "ay-2026",
      }),
    ).toBe(false);
  });

  it("is true when any level has more than one", () => {
    expect(
      hasRealChoice(availability(), {
        organizationId: "org-1",
        branchId: "branch-1",
        academicYearId: "ay-2026",
      }),
    ).toBe(true);
  });
});

describe("canSkipSelection", () => {
  it("is false by default, even with nothing to ask", () => {
    expect(canSkipSelection(SINGLE, SINGLE_SELECTION)).toBe(false);
  });

  it("is true only when skipping is allowed and nothing is being asked", () => {
    expect(canSkipSelection(SINGLE, SINGLE_SELECTION, SKIPPABLE)).toBe(true);
  });

  it("is false when a level still has alternatives", () => {
    expect(canSkipSelection(availability(), SINGLE_SELECTION, SKIPPABLE)).toBe(
      false,
    );
  });

  it("is false when a level is unanswered", () => {
    expect(
      canSkipSelection(
        SINGLE,
        { ...SINGLE_SELECTION, academicYearId: null },
        SKIPPABLE,
      ),
    ).toBe(false);
  });
});

describe("post-authentication route", () => {
  it("sends an unresolved scope to the workspace route", () => {
    // This is the state at sign-in: identity has not loaded, so nothing is
    // known yet and the workspace route is where it gets resolved.
    expect(resolvePostAuthRoute()).toBe(ROUTES.workspace.root);
    expect(resolvePostAuthRoute("selecting")).toBe(ROUTES.workspace.root);
    expect(resolvePostAuthRoute("unavailable")).toBe(ROUTES.workspace.root);
  });

  it("sends a resolved scope to the app", () => {
    expect(resolvePostAuthRoute("ready")).toBe(ROUTES.app.root);
  });
});
