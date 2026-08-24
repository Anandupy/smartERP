import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createMemoryWorkspaceStorage,
  resetWorkspaceSelectionPolicy,
  setWorkspaceStorage,
  useWorkspace,
  useWorkspaceStore,
  type WorkspaceAvailability,
  type WorkspaceSetupStatus,
} from "@/core/workspace";

/**
 * Reproduces, and proves the fix for, the "Branch is done but Academic Year
 * still says waiting" bug: the setup Academic Year step used to read the
 * branch from `useAcademicYearBranch()` (`features/academic-year`), which
 * gates on `isReady` (`status === "ready"`) — a status setup never reaches
 * (see `workspace-store.test.ts`'s "setup gating" suite). The fix reads
 * `useWorkspace().branch` directly, which carries no such gate. This suite
 * exercises `useWorkspace()` itself, the same way the real fix does, across
 * the exact sequence a real Branch-creation mutation produces: no fake
 * `branchCreated = true`, just a second `setAvailability` call — what
 * `useWorkspaceBootstrap` runs after `/auth/me` is invalidated and refetched.
 */

const ORGANIZATION = { id: "org-1", name: "Horizon Trust", code: null };

function availability(
  overrides: Partial<WorkspaceAvailability> = {},
): WorkspaceAvailability {
  return {
    organizations: [ORGANIZATION],
    branches: [],
    academicYears: [],
    defaults: { organizationId: null, branchId: null, academicYearId: null },
    role: "SUPER_ADMIN",
    ...overrides,
  };
}

function setupStatus(
  overrides: Partial<WorkspaceSetupStatus> = {},
): WorkspaceSetupStatus {
  return {
    setupRequired: true,
    setupStage: "BRANCH",
    missingResources: ["BRANCH", "ACADEMIC_YEAR"],
    completedResources: ["SYSTEM_SETTINGS", "ORGANIZATION"],
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

describe("useWorkspace() during setup, across a branch creation", () => {
  it("sees the new branch in the same render tree, without isReady ever becoming true", () => {
    useWorkspaceStore.getState().setAvailability(availability(), setupStatus());

    const { result, rerender } = renderHook(() => useWorkspace());

    expect(result.current.branch).toBeNull();
    expect(result.current.options.branches).toEqual([]);
    expect(result.current.isReady).toBe(false);

    // What the Branch step's mutation success handler actually does:
    // invalidate identity, refetch /auth/me, republish availability. No
    // frontend flag is set — the branch is real, server-reported data.
    act(() => {
      useWorkspaceStore.getState().setAvailability(
        availability({
          branches: [
            { id: "branch-1", name: "Main Campus", code: null, organizationId: "org-1" },
          ],
        }),
        setupStatus({
          setupStage: "ACADEMIC_YEAR",
          missingResources: ["ACADEMIC_YEAR"],
          completedResources: ["SYSTEM_SETTINGS", "ORGANIZATION", "BRANCH"],
        }),
      );
    });
    rerender();

    // The same hook instance now resolves the branch — no remount, no
    // page refresh, and status never touched "ready" to get there.
    expect(result.current.branch).toEqual({
      id: "branch-1",
      name: "Main Campus",
      code: null,
      organizationId: "org-1",
    });
    expect(result.current.isReady).toBe(false);
    expect(result.current.status).toBe("setup-required");
  });

  it("leaves branch unresolved when more than one exists, until select() is called", () => {
    useWorkspaceStore.getState().setAvailability(
      availability({
        branches: [
          { id: "branch-1", name: "North Campus", code: null, organizationId: "org-1" },
          { id: "branch-2", name: "South Campus", code: null, organizationId: "org-1" },
        ],
      }),
      setupStatus(),
    );

    const { result, rerender } = renderHook(() => useWorkspace());

    // A genuine choice — auto-settling would silently pick one for the user.
    expect(result.current.branch).toBeNull();
    expect(result.current.options.branches).toHaveLength(2);

    act(() => result.current.select({ branchId: "branch-2" }));
    rerender();

    expect(result.current.branch?.id).toBe("branch-2");
    expect(result.current.isReady).toBe(false);
  });
});
