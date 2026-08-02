import { beforeEach, describe, expect, it } from "vitest";

import {
  createMemoryWorkspaceStorage,
  getWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
  type WorkspaceAvailability,
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

beforeEach(() => {
  setWorkspaceStorage(createMemoryWorkspaceStorage());
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

  it("resolves and persists immediately when there is nothing to choose", () => {
    useWorkspaceStore.getState().setAvailability(
      availability({
        organizations: [ORGANIZATIONS[0]],
        branches: [BRANCHES[0]],
        academicYears: [YEARS[0]],
      }),
    );

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

describe("clearing", () => {
  it("forgets the scope on disk as well as in memory", () => {
    useWorkspaceStore.getState().setAvailability(
      availability({
        organizations: [ORGANIZATIONS[0]],
        branches: [BRANCHES[0]],
        academicYears: [YEARS[0]],
      }),
    );
    expect(getWorkspaceStorage().read().organizationId).toBe("org-1");

    useWorkspaceStore.getState().clear();

    // Sign-out must not leave the next user on the previous user's campus.
    expect(useWorkspaceStore.getState().status).toBe("idle");
    expect(useWorkspaceStore.getState().availability).toBeNull();
    expect(getWorkspaceStorage().read().organizationId).toBeNull();
  });
});
