import { branchState, type BranchState } from "../constants";
import type { BranchDto } from "../types/branch.dto";

/**
 * The branch lifecycle, as the backend actually documents it.
 *
 * Unlike Organization — whose status has no write path at all — Branch has a
 * real one. `isActive` is a documented field, `PATCH /branches/:id/status`
 * toggles it, and `DELETE` performs a documented soft delete. So three of the
 * design's stages are genuinely reachable, and the transitions between them are
 * two-way rather than one-way.
 *
 * | Design stage        | Backend reality                                        |
 * | ------------------- | ------------------------------------------------------ |
 * | Active              | `isActive: true`. Reachable — the status toggle.       |
 * | Inactive            | `isActive: false`. Reachable — the same toggle.        |
 * | Archived            | No field, no endpoint, no value.                       |
 * | Deleted             | `isDeleted: true` via the documented soft delete.      |
 * | Permanent deletion  | Does not exist. Soft delete only.                      |
 *
 * The one wrinkle worth stating: the toggle takes **no request body**, so a
 * target state cannot be requested — it flips whatever `isActive` currently is.
 * That makes it non-idempotent, which is why nothing in this module fires it
 * speculatively, retries it, or offers it when the current state is unknown.
 */

export interface BranchLifecycleStage {
  /** The derived state this stage corresponds to, if any. */
  state: BranchState | null;
  label: string;
  description: string;
  /** How a branch gets here, in the user's terms. */
  transition: string;
  /** False when the contract documents no way to reach or leave this stage. */
  isSupported: boolean;
}

export const BRANCH_LIFECYCLE_STAGES: readonly BranchLifecycleStage[] =
  Object.freeze([
    {
      state: "active",
      label: "Active",
      description:
        "Operating normally. Available for admissions, payroll and academic operations.",
      transition: "Set on creation, and restored by the status toggle.",
      isSupported: true,
    },
    {
      state: "inactive",
      label: "Inactive",
      description:
        "Temporarily suspended. The record is retained and remains readable.",
      transition: "PATCH /branches/:id/status.",
      isSupported: true,
    },
    {
      state: null,
      label: "Archived",
      description:
        "Hidden from active lists but retained for historical reporting.",
      transition:
        "No field, no value and no endpoint. Distinct from inactive only in the design.",
      isSupported: false,
    },
    {
      state: "deleted",
      label: "Deleted",
      description:
        "Soft-deleted. The record is retained — both documents are explicit that nothing is removed.",
      transition: "DELETE /branches/:id.",
      isSupported: true,
    },
    {
      state: null,
      label: "Permanent deletion",
      description:
        "Irrevocable removal of the branch and everything associated with it.",
      transition: "Does not exist. The platform performs soft deletes only.",
      isSupported: false,
    },
  ]);

/** Stages the frontend can actually drive, in the order they occur. */
export const SUPPORTED_BRANCH_STAGES = BRANCH_LIFECYCLE_STAGES.filter(
  (stage) => stage.isSupported,
);

/** Whether a stage is the branch's current one. */
export function isCurrentBranchStage(
  stage: BranchLifecycleStage,
  branch: BranchDto,
): boolean {
  return stage.state !== null && stage.state === branchState(branch);
}

/**
 * What the status toggle would do next, in the user's terms.
 *
 * `null` when the answer is unknowable — a deleted branch, or one whose
 * `isActive` the backend did not report. Offering "Deactivate" against an
 * unknown state would be a button whose effect nobody can predict, since the
 * endpoint flips rather than sets.
 */
export function nextToggleAction(
  branch: BranchDto,
): { label: string; description: string } | null {
  switch (branchState(branch)) {
    case "active":
      return {
        label: "Deactivate branch",
        description:
          "Suspends operations. The record is retained and can be reactivated.",
      };
    case "inactive":
      return {
        label: "Activate branch",
        description: "Restores normal operation for this branch.",
      };
    default:
      return null;
  }
}
