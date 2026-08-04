"use client";

import { CalendarCheck, CircleCheckBig, Lock, Trash2 } from "@/assets/icons";
import { Banner } from "@/shared/components/feedback";
import { ConfirmDialog } from "@/shared/components/overlay";

import { formatAcademicYearRange } from "../mappers/academic-year.mapper";
import type {
  AcademicYearDto,
  AcademicYearTransition,
} from "../types/academic-year.dto";
import type { LifecycleAction } from "../utils/academic-year-lifecycle";

/** The glyph each documented transition leads with. */
const TRANSITION_ICON = {
  activate: CircleCheckBig,
  select: CalendarCheck,
  lock: Lock,
} as const;

export interface TransitionAcademicYearDialogProps {
  year: AcademicYearDto | null;
  action: LifecycleAction | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (year: AcademicYearDto, transition: AcademicYearTransition) => void;
}

/**
 * Confirmation before one of the three documented lifecycle transitions.
 *
 * One dialog for all three, because the thing that has to be said is the same
 * every time and saying it three different ways would let one of them drift.
 *
 * These endpoints are **idempotent** — each names its target state in the path,
 * so unlike the branch status toggle a repeat call is harmless and there is no
 * need to withhold the action when the current state is unreported. What they
 * are is **irreversible**: the collection documents no deactivate, no deselect
 * and no unlock. That is the fact the prompt leads with, and it is stated as a
 * warning banner rather than buried in the description, because a user who
 * misses it has no way back.
 *
 * Selecting deserves its own line beyond that, and gets one: the documentation
 * allows only one selected year per branch, so the choice necessarily displaces
 * whichever year currently holds the position — an effect on a record the user
 * is not looking at.
 */
export function TransitionAcademicYearDialog({
  year,
  action,
  isPending,
  onOpenChange,
  onConfirm,
}: TransitionAcademicYearDialogProps) {
  const Icon = action ? TRANSITION_ICON[action.transition] : undefined;
  const range = year ? formatAcademicYearRange(year) : null;

  return (
    <ConfirmDialog
      open={year !== null && action !== null}
      onOpenChange={onOpenChange}
      icon={Icon}
      destructive={action?.transition === "lock"}
      title={action ? `${action.label}?` : ""}
      description={
        year && action
          ? `${action.description} This applies to “${year.name}”${range ? ` (${range})` : ""}.`
          : ""
      }
      confirmLabel={action?.label ?? "Confirm"}
      isPending={isPending}
      onConfirm={() => {
        if (year && action) onConfirm(year, action.transition);
      }}
    >
      {action?.isIrreversible ? (
        <Banner
          tone={action.transition === "lock" ? "danger" : "warning"}
          title="This cannot be undone from here"
          description={
            action.transition === "lock"
              ? "The API documents no endpoint that unlocks an academic year, and a locked year cannot be modified or deleted."
              : action.transition === "select"
                ? "The API documents no endpoint that deselects a year. It stops being current only when another year is selected in its place."
                : "The API documents no endpoint that deactivates an academic year."
          }
        />
      ) : null}
    </ConfirmDialog>
  );
}

export interface DeleteAcademicYearDialogProps {
  year: AcademicYearDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (year: AcademicYearDto) => void;
}

/**
 * Confirmation before deleting an academic year.
 *
 * The documentation calls this a **soft delete**, so the copy says the record
 * is retained rather than claiming the data is destroyed — overstating a
 * consequence is its own inaccuracy, and the kind that stops people doing
 * legitimate work.
 *
 * What it does state is the part that matters and that the architecture section
 * spells out: attendance, marks, fees, admissions and academic units are all
 * linked to an `academicYearId`. Deleting the year is not deleting an empty
 * container.
 */
export function DeleteAcademicYearDialog({
  year,
  isPending,
  onOpenChange,
  onConfirm,
}: DeleteAcademicYearDialogProps) {
  const range = year ? formatAcademicYearRange(year) : null;

  return (
    <ConfirmDialog
      open={year !== null}
      onOpenChange={onOpenChange}
      destructive
      icon={Trash2}
      title="Delete this academic year?"
      description={
        year
          ? `“${year.name}”${range ? ` (${range})` : ""} will be soft-deleted. The record is retained, but attendance, marks, fees, admissions and academic units are all scoped to an academic year, and the API documents no endpoint that restores a deleted one.`
          : ""
      }
      confirmLabel="Delete academic year"
      isPending={isPending}
      onConfirm={() => {
        if (year) onConfirm(year);
      }}
    />
  );
}
