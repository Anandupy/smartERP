import { academicYearState, type AcademicYearState } from "../constants";
import type {
  AcademicYearDto,
  AcademicYearTransition,
} from "../types/academic-year.dto";

/**
 * The academic-year lifecycle, as the backend actually documents it.
 *
 * This is the best-supported lifecycle of any module shipped so far, and it is
 * worth being precise about why. Organization's status has **no** write path;
 * Branch has one endpoint that *flips* a flag. Academic Year has three
 * endpoints that each **name a target state** in the path — `activate`,
 * `select`, `lock` — which makes every one of them idempotent. Calling
 * `activate` twice leaves a year active. Nothing here has to be withheld for
 * the reason the branch toggle is.
 *
 * What the contract does **not** have is any inverse.
 *
 * | Documented forward transition   | Documented reverse |
 * | ------------------------------- | ------------------ |
 * | `PATCH /:id/activate`           | none               |
 * | `PATCH /:id/select`             | none               |
 * | `PATCH /:id/lock`               | none               |
 *
 * So the lifecycle is a **one-way ratchet**, and locking is the end of it: the
 * documentation states a locked year "cannot be modified or deleted", and no
 * endpoint unlocks one. Every confirmation in this module says so before the
 * user commits, because there is no undo to fall back on.
 */

export interface AcademicYearLifecycleStage {
  /** The derived state this stage corresponds to, if the flags can show it. */
  state: AcademicYearState | null;
  label: string;
  description: string;
  /** How a year gets here, in the user's terms. */
  transition: string;
  /** False when the contract documents no way to reach this stage. */
  isSupported: boolean;
  /**
   * False when the stage can be *reached* but not *seen*.
   *
   * Only Deleted is like this: `isDeleted` is returned, but every read filters
   * soft-deleted years out (G5) — the list omits them and `GET /:id` answers
   * 404 — so no screen ever holds one to show. The distinction matters — "we
   * can do this but cannot show you the result" is a different gap from "we
   * cannot do this".
   */
  isObservable: boolean;
}

export const ACADEMIC_YEAR_LIFECYCLE_STAGES: readonly AcademicYearLifecycleStage[] =
  Object.freeze([
    {
      state: "inactive",
      label: "Created",
      description:
        "The year exists with a name and a date range, but is not yet open for data entry.",
      transition:
        "POST /academic-years. The first year created for a branch is auto-activated and auto-selected; the flags a later year starts with are not documented.",
      isSupported: true,
      isObservable: true,
    },
    {
      state: "active",
      label: "Active",
      description:
        "Valid and available for data entry. Attendance, marks, fees and admissions can be recorded against it.",
      transition: "PATCH /academic-years/:id/activate. No way back.",
      isSupported: true,
      isObservable: true,
    },
    {
      state: "selected",
      label: "Current",
      description:
        "The branch's working year — the one the rest of the system writes into by default. Only one per branch.",
      transition:
        "PATCH /academic-years/:id/select. Selecting another year is the only way to displace it; there is no deselect.",
      isSupported: true,
      isObservable: true,
    },
    {
      state: "locked",
      label: "Locked",
      description:
        "Finished and audited. The documentation is explicit that a locked year cannot be modified or deleted.",
      transition:
        "PATCH /academic-years/:id/lock. Irreversible — no endpoint unlocks a year.",
      isSupported: true,
      isObservable: true,
    },
    {
      state: null,
      label: "Archived",
      description:
        "Retained for historical reporting but hidden from working lists.",
      transition:
        "No field, no value and no endpoint. Distinct from locked only in the design.",
      isSupported: false,
      isObservable: false,
    },
    {
      state: null,
      label: "Deleted",
      description:
        "Soft-deleted. The record is retained, but every read excludes it — the list omits it and a direct read answers 404 — so no screen can show a year in this state.",
      transition:
        "DELETE /academic-years/:id, allowed only when the year is neither locked nor selected.",
      isSupported: true,
      isObservable: false,
    },
    {
      state: null,
      label: "Permanent deletion",
      description:
        "Irrevocable removal of the year and everything scoped to it.",
      transition: "Does not exist. The platform performs soft deletes only.",
      isSupported: false,
      isObservable: false,
    },
  ]);

/** Stages the frontend can actually drive, in the order they occur. */
export const SUPPORTED_ACADEMIC_YEAR_STAGES =
  ACADEMIC_YEAR_LIFECYCLE_STAGES.filter((stage) => stage.isSupported);

/** Whether a stage is the year's current one. */
export function isCurrentAcademicYearStage(
  stage: AcademicYearLifecycleStage,
  year: AcademicYearDto,
): boolean {
  return stage.state !== null && stage.state === academicYearState(year);
}

/**
 * Transitions the contract documents no endpoint for.
 *
 * Listed explicitly rather than left implicit, because "you cannot undo this"
 * is the single most important thing this module has to communicate, and a
 * reader should be able to find the claim in one place and check it.
 */
export const UNSUPPORTED_ACADEMIC_YEAR_TRANSITIONS: readonly {
  label: string;
  reason: string;
}[] = Object.freeze([
  {
    label: "Deactivate",
    reason: "No endpoint sets `isActive` back to false. Activation is one-way.",
  },
  {
    label: "Deselect",
    reason:
      "No endpoint clears `isSelected`. A year stops being current only when another is selected in its place.",
  },
  {
    label: "Unlock",
    reason:
      "No endpoint clears `isLocked`. Locking is final, and the documentation says a locked year cannot be modified.",
  },
  {
    label: "Restore",
    reason: "No endpoint reverses the documented soft delete.",
  },
]);

/** One offerable lifecycle action, or the reason it is being withheld. */
export interface LifecycleAction {
  transition: AcademicYearTransition;
  label: string;
  /** What it does, in the user's terms. Shown in the confirmation. */
  description: string;
  /** Stated before an irreversible commit. */
  isIrreversible: boolean;
  /** `null` when offerable; otherwise why it is not. */
  blockedReason: string | null;
}

/**
 * The three documented transitions, each with a verdict for this year.
 *
 * Two rules do the blocking, both quoted from the documentation:
 *
 * - **Rule 4** — "Locked academic years cannot be modified or deleted." The
 *   backend applies it to `PATCH /:id` and `DELETE /:id` only (G4, confirmed in
 *   `frontend-contract-answers.md`): `activate`, `select` and `lock` all remain
 *   legal on a locked year, so the lock withholds none of them here.
 * - **Already there** — a year that reports the target flag is not offered the
 *   transition again. Not for safety (these are idempotent) but because an
 *   action with no effect is noise.
 *
 * An **unreported** flag does not block anything. These endpoints set rather
 * than flip, so firing one from an unknown starting point has a knowable
 * result — the opposite of the branch status toggle, and the reason this module
 * does not withhold actions the way that one does.
 */
export function lifecycleActions(
  year: AcademicYearDto,
): readonly LifecycleAction[] {
  const isLocked = year.isLocked === true;

  return [
    {
      transition: "activate",
      label: "Activate year",
      description:
        "Marks the year valid and available for data entry. There is no documented way to deactivate it afterwards.",
      isIrreversible: true,
      blockedReason:
        year.isActive === true ? "This year is already active." : null,
    },
    {
      transition: "select",
      label: "Set as current year",
      description:
        "Makes this the branch's working year, which the rest of the system writes into by default. Only one year per branch can hold it, so the year that holds it now will be displaced.",
      isIrreversible: true,
      blockedReason:
        year.isSelected === true
          ? "This year is already the current one."
          : null,
    },
    {
      transition: "lock",
      label: "Lock year",
      description:
        "Freezes the year against any further change. The documentation is explicit that a locked year cannot be modified or deleted, and the API documents no way to unlock one.",
      isIrreversible: true,
      blockedReason: isLocked ? "This year is already locked." : null,
    },
  ];
}

/** Just the actions that can be offered right now. */
export function availableLifecycleActions(
  year: AcademicYearDto,
): readonly LifecycleAction[] {
  return lifecycleActions(year).filter(
    (action) => action.blockedReason === null,
  );
}

/**
 * Why this year cannot be edited, or `null` when it can.
 *
 * The documentation gates the update endpoint itself — "Update details (if not
 * locked)" — so the UI declines to open a form whose save is guaranteed to be
 * refused, rather than letting someone retype a date range and lose it.
 */
export function editBlockedReason(year: AcademicYearDto): string | null {
  return year.isLocked === true
    ? "Locked years cannot be modified. The API documents no way to unlock one."
    : null;
}

/**
 * Why this year cannot be deleted, or `null` when it can.
 *
 * Two documented rules guard the soft delete, and they are reported separately
 * because the fix differs: a selected year becomes deletable once another is
 * selected in its place, while a locked year never does.
 */
export function deleteBlockedReason(year: AcademicYearDto): string | null {
  if (year.isLocked === true) {
    return "Locked years cannot be deleted. The API documents no way to unlock one.";
  }
  if (year.isSelected === true) {
    return "The current year cannot be deleted. Select another year for this branch first.";
  }
  return null;
}
