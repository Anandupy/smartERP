import { describe, expect, it } from "vitest";

import {
  ACADEMIC_YEAR_LIFECYCLE_STAGES,
  SUPPORTED_ACADEMIC_YEAR_STAGES,
  UNSUPPORTED_ACADEMIC_YEAR_TRANSITIONS,
  availableLifecycleActions,
  deleteBlockedReason,
  editBlockedReason,
  isCurrentAcademicYearStage,
  lifecycleActions,
} from "@/features/academic-year";

import {
  academicYearDto,
  lockedAcademicYearDto,
  upcomingAcademicYearDto,
} from "@tests/fixtures/academic-year";

describe("academic year lifecycle stages", () => {
  it("marks archiving and permanent deletion as unsupported", () => {
    // Neither has a field, a value or an endpoint anywhere in the contract.
    const unsupported = ACADEMIC_YEAR_LIFECYCLE_STAGES.filter(
      (stage) => !stage.isSupported,
    ).map((stage) => stage.label);

    expect(unsupported).toEqual(["Archived", "Permanent deletion"]);
  });

  it("marks deletion as reachable but not observable", () => {
    // `DELETE /academic-years/:id` is documented; no `isDeleted` field is. The
    // distinction matters: "we can do this but cannot show you the result" is a
    // different gap from "we cannot do this".
    const deleted = ACADEMIC_YEAR_LIFECYCLE_STAGES.find(
      (stage) => stage.label === "Deleted",
    );

    expect(deleted?.isSupported).toBe(true);
    expect(deleted?.isObservable).toBe(false);
  });

  it("counts five reachable stages of seven", () => {
    expect(SUPPORTED_ACADEMIC_YEAR_STAGES).toHaveLength(5);
    expect(ACADEMIC_YEAR_LIFECYCLE_STAGES).toHaveLength(7);
  });

  it("matches the current stage to the year's derived state", () => {
    const locked = lockedAcademicYearDto();
    const lockedStage = ACADEMIC_YEAR_LIFECYCLE_STAGES.find(
      (stage) => stage.label === "Locked",
    )!;
    const activeStage = ACADEMIC_YEAR_LIFECYCLE_STAGES.find(
      (stage) => stage.label === "Active",
    )!;

    expect(isCurrentAcademicYearStage(lockedStage, locked)).toBe(true);
    expect(isCurrentAcademicYearStage(activeStage, locked)).toBe(false);
  });

  it("never treats a stage with no state as current", () => {
    const archived = ACADEMIC_YEAR_LIFECYCLE_STAGES.find(
      (stage) => stage.label === "Archived",
    )!;

    expect(isCurrentAcademicYearStage(archived, academicYearDto())).toBe(false);
  });

  it("names all four transitions the API does not document", () => {
    expect(
      UNSUPPORTED_ACADEMIC_YEAR_TRANSITIONS.map((item) => item.label),
    ).toEqual(["Deactivate", "Deselect", "Unlock", "Restore"]);
  });
});

describe("lifecycleActions", () => {
  it("offers every transition on a year that reports no flags", () => {
    // This is the key difference from the branch status toggle. That endpoint
    // flips a flag, so firing it from an unknown state has an unpredictable
    // result and it must be withheld. These three name their target state in
    // the path, so `lock` on a year whose flags never came back still produces
    // a locked year — there is nothing to withhold.
    const unknown = academicYearDto({
      isActive: undefined,
      isSelected: undefined,
      isLocked: undefined,
    });

    expect(availableLifecycleActions(unknown).map((a) => a.transition)).toEqual(
      ["activate", "select", "lock"],
    );
  });

  it("withholds every transition on a locked year", () => {
    // Documented rule 4: a locked year cannot be modified, and all three
    // transitions modify the record.
    expect(availableLifecycleActions(lockedAcademicYearDto())).toHaveLength(0);
  });

  it("explains each withheld transition rather than just hiding it", () => {
    const actions = lifecycleActions(lockedAcademicYearDto());

    expect(actions).toHaveLength(3);
    for (const action of actions) {
      expect(action.blockedReason).toBeTruthy();
    }
  });

  it("does not re-offer a transition the year already reports", () => {
    // Not for safety — these are idempotent — but because an action with no
    // effect is noise.
    const current = academicYearDto({ isActive: true, isSelected: true });
    const available = availableLifecycleActions(current).map(
      (a) => a.transition,
    );

    expect(available).toEqual(["lock"]);
  });

  it("offers activate and select on a created-but-inactive year", () => {
    const available = availableLifecycleActions(upcomingAcademicYearDto()).map(
      (a) => a.transition,
    );

    expect(available).toEqual(["activate", "select", "lock"]);
  });

  it("flags every transition as irreversible, because none has an inverse", () => {
    for (const action of lifecycleActions(upcomingAcademicYearDto())) {
      expect(action.isIrreversible).toBe(true);
    }
  });
});

describe("editBlockedReason", () => {
  it("blocks editing a locked year", () => {
    // Documented: "Update details (if not locked)".
    expect(editBlockedReason(lockedAcademicYearDto())).toContain("Locked");
  });

  it("allows editing otherwise, including when the flag is absent", () => {
    expect(editBlockedReason(academicYearDto())).toBeNull();
    expect(
      editBlockedReason(academicYearDto({ isLocked: undefined })),
    ).toBeNull();
  });
});

describe("deleteBlockedReason", () => {
  it("blocks deleting a locked year", () => {
    expect(deleteBlockedReason(lockedAcademicYearDto())).toContain("Locked");
  });

  it("blocks deleting the current year, and says how to unblock it", () => {
    // Documented rule 5. Reported separately from the lock because the fix
    // differs: a selected year becomes deletable once another is selected.
    const reason = deleteBlockedReason(
      academicYearDto({ isSelected: true, isLocked: false }),
    );

    expect(reason).toContain("Select another year");
  });

  it("prefers the lock reason when a year is both locked and current", () => {
    // The lock is the one that can never be undone, so it is the one to state.
    const reason = deleteBlockedReason(
      academicYearDto({ isSelected: true, isLocked: true }),
    );

    expect(reason).toContain("Locked");
  });

  it("allows deleting a year that is neither locked nor current", () => {
    expect(deleteBlockedReason(upcomingAcademicYearDto())).toBeNull();
  });
});
