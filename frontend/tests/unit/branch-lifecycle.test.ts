import { describe, expect, it } from "vitest";

// The modules under test, not the feature barrel — see the note in
// `audit-analytics.test.ts`.
import { ANY_STATE, ANY_TYPE, branchState } from "@/features/branch/constants";
import {
  filterBranches,
  type BranchFilters,
} from "@/features/branch/hooks/use-branches";
import {
  BRANCH_LIFECYCLE_STAGES,
  SUPPORTED_BRANCH_STAGES,
  isCurrentBranchStage,
  nextToggleAction,
} from "@/features/branch/utils/branch-lifecycle";

import { branchDto, secondBranchDto } from "@tests/fixtures/branch";

describe("branchState", () => {
  it("reads an active branch", () => {
    expect(branchState(branchDto({ isActive: true }))).toBe("active");
  });

  it("reads an inactive branch", () => {
    expect(branchState(branchDto({ isActive: false }))).toBe("inactive");
  });

  it("puts deletion ahead of the active flag", () => {
    // A deleted branch is deleted regardless of what isActive still says.
    expect(branchState(branchDto({ isActive: true, isDeleted: true }))).toBe(
      "deleted",
    );
  });

  it("reports an absent flag as unknown, never as inactive", () => {
    // No response body is documented, so the field may genuinely be missing —
    // defaulting it to false would show a working campus as suspended.
    expect(
      branchState(branchDto({ isActive: undefined, isDeleted: undefined })),
    ).toBe("unknown");
    expect(branchState(branchDto({ isActive: null }))).toBe("unknown");
  });
});

describe("lifecycle model", () => {
  it("names every stage the design asks for", () => {
    expect(BRANCH_LIFECYCLE_STAGES.map((stage) => stage.label)).toEqual([
      "Active",
      "Inactive",
      "Archived",
      "Deleted",
      "Permanent deletion",
    ]);
  });

  it("supports only the three stages the contract can reach", () => {
    expect(SUPPORTED_BRANCH_STAGES.map((stage) => stage.state)).toEqual([
      "active",
      "inactive",
      "deleted",
    ]);
  });

  it("marks archiving and permanent deletion as unsupported", () => {
    const unsupported = BRANCH_LIFECYCLE_STAGES.filter(
      (stage) => !stage.isSupported,
    );

    expect(unsupported.map((stage) => stage.label)).toEqual([
      "Archived",
      "Permanent deletion",
    ]);
  });

  it("matches the current stage to the branch's derived state", () => {
    const inactive = branchDto({ isActive: false });
    const inactiveStage = BRANCH_LIFECYCLE_STAGES.find(
      (stage) => stage.label === "Inactive",
    )!;
    const activeStage = BRANCH_LIFECYCLE_STAGES.find(
      (stage) => stage.label === "Active",
    )!;

    expect(isCurrentBranchStage(inactiveStage, inactive)).toBe(true);
    expect(isCurrentBranchStage(activeStage, inactive)).toBe(false);
  });

  it("never marks an unsupported stage as current", () => {
    const archived = BRANCH_LIFECYCLE_STAGES.find(
      (stage) => stage.label === "Archived",
    )!;

    expect(isCurrentBranchStage(archived, branchDto())).toBe(false);
  });
});

describe("nextToggleAction", () => {
  it("offers deactivation for an active branch", () => {
    expect(nextToggleAction(branchDto({ isActive: true }))?.label).toBe(
      "Deactivate branch",
    );
  });

  it("offers activation for an inactive branch", () => {
    expect(nextToggleAction(branchDto({ isActive: false }))?.label).toBe(
      "Activate branch",
    );
  });

  it("offers nothing for a deleted branch", () => {
    expect(nextToggleAction(branchDto({ isDeleted: true }))).toBeNull();
  });

  it("offers nothing when the current state is unknown", () => {
    // The endpoint flips rather than sets, so the result of a toggle from an
    // unknown starting point cannot be predicted — better to withhold it.
    expect(nextToggleAction(branchDto({ isActive: undefined }))).toBeNull();
  });
});

describe("filterBranches", () => {
  const branches = [branchDto(), secondBranchDto({ isActive: false })];
  const base: BranchFilters = {
    search: "",
    state: ANY_STATE,
    institutionType: ANY_TYPE,
  };

  it("returns everything when nothing is narrowed", () => {
    expect(filterBranches(branches, base)).toHaveLength(2);
  });

  it("matches on name, code, registration, contact, affiliation and location", () => {
    for (const search of [
      "horizon",
      "avalon-city",
      "REG-001",
      "city@avalon",
      "Mumbai University",
      "pune",
    ]) {
      expect(filterBranches(branches, { ...base, search })).toHaveLength(1);
    }
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    expect(
      filterBranches(branches, { ...base, search: "  HORIZON  " }),
    ).toHaveLength(1);
  });

  it("narrows by derived state", () => {
    expect(filterBranches(branches, { ...base, state: "active" })).toHaveLength(
      1,
    );
    expect(
      filterBranches(branches, { ...base, state: "inactive" }),
    ).toHaveLength(1);
    expect(
      filterBranches(branches, { ...base, state: "deleted" }),
    ).toHaveLength(0);
  });

  it("narrows by institution type", () => {
    expect(
      filterBranches(branches, { ...base, institutionType: "SCHOOL" }),
    ).toHaveLength(1);
    expect(
      filterBranches(branches, { ...base, institutionType: "MEDICAL" }),
    ).toHaveLength(0);
  });

  it("combines every filter", () => {
    expect(
      filterBranches(branches, {
        search: "avalon",
        state: "active",
        institutionType: ANY_TYPE,
      }),
    ).toHaveLength(0);
  });
});
