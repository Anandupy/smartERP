import { beforeEach, describe, expect, it } from "vitest";

import {
  createMemoryWorkspaceStorage,
  getWorkspaceStorage,
  resetWorkspaceSelectionPolicy,
  setWorkspaceSelectionPolicy,
  setWorkspaceStorage,
  useWorkspaceStore,
  type WorkspaceAvailability,
  type WorkspaceSetupStatus,
} from "@/core/workspace";

/**
 * The workspace store: what it remembers, what it refuses to remember, and how
 * it reacts to a change.
 *
 * Storage is swapped for the in-memory seam, so these assertions are about the
 * store's decisions rather than about Web Storage.
 */

const ORGANIZATIONS = [
  { id: "org-1", name: "UET", code: null },
  { id: "org-2", name: "NEG", code: null },
];

const BRANCHES = [
  { id: "branch-1", name: "Downtown", code: null, organizationId: "org-1" },
  { id: "branch-2", name: "West-Side", code: null, organizationId: "org-1" },
  { id: "branch-3", name: "Northfield", code: null, organizationId: "org-2" },
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

const SINGLE_CHOICE = {
  organizations: [ORGANIZATIONS[0]],
  branches: [BRANCHES[0]],
  academicYears: [YEARS[0]],
};

function setupStatus(
  overrides: Partial<WorkspaceSetupStatus> = {},
): WorkspaceSetupStatus {
  return {
    setupRequired: true,
    setupStage: "ORGANIZATION",
    missingResources: ["ORGANIZATION", "BRANCH", "ACADEMIC_YEAR"],
    completedResources: ["SYSTEM_SETTINGS"],
    allowedActions: [],
    initializedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  resetWorkspaceSelectionPolicy();
  useWorkspaceStore.getState().clear();
});

describe("publishing availability", () => {
  it("starts idle, with nothing selected", () => {
    const state = useWorkspaceStore.getState();
    expect(state.status).toBe("idle");
    expect(state.availability).toBeNull();
  });

  it("moves to selecting when a choice exists", () => {
    useWorkspaceStore.getState().setAvailability(availability());
    expect(useWorkspaceStore.getState().status).toBe("selecting");
  });

  it("pre-answers a single-choice scope but waits for confirmation", () => {
    useWorkspaceStore.getState().setAvailability(availability(SINGLE_CHOICE));

    expect(useWorkspaceStore.getState().status).toBe("selecting");
    expect(useWorkspaceStore.getState().selection).toEqual({
      organizationId: "org-1",
      branchId: "branch-1",
      academicYearId: "ay-2026",
    });
    // Nothing is remembered until the user accepts it — an offer is not a
    // choice, and persisting one would skip the screen on the next sign-in.
    expect(getWorkspaceStorage().read().organizationId).toBeNull();
  });

  it("resolves and persists immediately once the policy allows skipping", () => {
    setWorkspaceSelectionPolicy({ alwaysShowSelection: false });
    useWorkspaceStore.getState().setAvailability(availability(SINGLE_CHOICE));

    expect(useWorkspaceStore.getState().status).toBe("ready");
    expect(getWorkspaceStorage().read()).toEqual({
      organizationId: "org-1",
      branchId: "branch-1",
      academicYearId: "ay-2026",
    });
  });

  it("seeds from the remembered selection", () => {
    setWorkspaceStorage(
      createMemoryWorkspaceStorage({
        organizationId: "org-2",
        branchId: null,
        academicYearId: null,
      }),
    );

    useWorkspaceStore.getState().setAvailability(availability());
    // org-2 has one branch and one year, so the rest settles around the seed.
    expect(useWorkspaceStore.getState().selection).toEqual({
      organizationId: "org-2",
      branchId: "branch-3",
      academicYearId: "ay-neg",
    });
  });
});

describe("selecting", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().setAvailability(availability());
  });

  it("cascades a change through the levels below it", () => {
    const { select } = useWorkspaceStore.getState();

    select({ organizationId: "org-1" });
    select({ branchId: "branch-2" });
    expect(useWorkspaceStore.getState().selection.branchId).toBe("branch-2");

    select({ organizationId: "org-2" });
    expect(useWorkspaceStore.getState().selection.branchId).toBe("branch-3");
  });

  it("does nothing before availability is known", () => {
    useWorkspaceStore.getState().clear();
    useWorkspaceStore.getState().select({ organizationId: "org-1" });
    expect(useWorkspaceStore.getState().selection.organizationId).toBeNull();
  });
});

describe("confirming", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().setAvailability(availability());
  });

  it("refuses an incomplete selection and remembers nothing", () => {
    useWorkspaceStore.getState().select({ organizationId: "org-1" });
    useWorkspaceStore.getState().confirm();

    expect(useWorkspaceStore.getState().status).toBe("selecting");
    expect(getWorkspaceStorage().read().organizationId).toBeNull();
  });

  it("marks the scope ready and remembers it", () => {
    const { select } = useWorkspaceStore.getState();
    select({ organizationId: "org-1" });
    select({ branchId: "branch-1" });
    select({ academicYearId: "ay-2025" });

    useWorkspaceStore.getState().confirm();

    expect(useWorkspaceStore.getState().status).toBe("ready");
    expect(getWorkspaceStorage().read()).toEqual({
      organizationId: "org-1",
      branchId: "branch-1",
      academicYearId: "ay-2025",
    });
  });
});

describe("setup gating", () => {
  it("short-circuits to setup-required for an entitled role, ahead of availability", () => {
    // Zero organizations would otherwise read as "unavailable" — the exact
    // fresh-install case setup exists to distinguish.
    useWorkspaceStore
      .getState()
      .setAvailability(
        availability({ organizations: [], branches: [], academicYears: [] }),
        setupStatus(),
      );

    const state = useWorkspaceStore.getState();
    expect(state.status).toBe("setup-required");
    expect(state.setupStatus).toEqual(setupStatus());
  });

  it("auto-settles the sole organization without marking the scope ready", () => {
    useWorkspaceStore
      .getState()
      .setAvailability(availability(SINGLE_CHOICE), setupStatus());

    const state = useWorkspaceStore.getState();
    expect(state.status).toBe("setup-required");
    expect(state.selection.organizationId).toBe("org-1");
    // Auto-settling during setup must never persist or send scope headers —
    // both still require `confirm()`, which setup never calls.
    expect(getWorkspaceStorage().read().organizationId).toBeNull();
  });

  it("falls through to ordinary resolution once setup no longer applies", () => {
    useWorkspaceStore
      .getState()
      .setAvailability(availability(), setupStatus({ setupRequired: false }));

    expect(useWorkspaceStore.getState().status).toBe("selecting");
  });

  it("falls through for a role with no setup authority, even while required", () => {
    useWorkspaceStore
      .getState()
      .setAvailability(
        availability({
          organizations: [],
          branches: [],
          academicYears: [],
          role: "STAFF",
        }),
        setupStatus(),
      );

    // Unchanged from before setup existed: no organizations reads as
    // unavailable, and a STAFF account has no setup authority to redirect to.
    expect(useWorkspaceStore.getState().status).toBe("unavailable");
  });

  it("behaves exactly as before when no setup status is published at all", () => {
    useWorkspaceStore.getState().setAvailability(availability());
    expect(useWorkspaceStore.getState().status).toBe("selecting");
    expect(useWorkspaceStore.getState().setupStatus).toBeNull();
  });
});

describe("clearing", () => {
  it("forgets the scope on disk as well as in memory", () => {
    useWorkspaceStore.getState().setAvailability(availability(SINGLE_CHOICE));
    useWorkspaceStore.getState().confirm();
    expect(getWorkspaceStorage().read().organizationId).toBe("org-1");

    useWorkspaceStore.getState().clear();

    // Sign-out must not leave the next user on the previous user's campus.
    expect(useWorkspaceStore.getState().status).toBe("idle");
    expect(useWorkspaceStore.getState().availability).toBeNull();
    expect(getWorkspaceStorage().read().organizationId).toBeNull();
  });
});
