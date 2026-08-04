"use client";

import { useState } from "react";

import { ArrowLeftRight, Power, Trash2 } from "@/assets/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Banner } from "@/shared/components/feedback";
import { ConfirmDialog } from "@/shared/components/overlay";

import { NO_PARENT, academicUnitState } from "../constants";
import type { AcademicUnitDto } from "../types/academic-unit.dto";
import { eligibleParents } from "../utils/academic-unit-hierarchy";

export interface DeleteAcademicUnitDialogProps {
  unit: AcademicUnitDto | null;
  /** From `deleteBlockedReason`. Non-null renders the dialog as a refusal. */
  blockedReason?: string | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (unit: AcademicUnitDto) => void;
}

/**
 * Confirmation before deleting an academic unit.
 *
 * The documentation's Best Practices are explicit — "Never permanently remove
 * nodes if they have financial or academic trails" — so the copy says the
 * record is retained rather than claiming the data is destroyed, and it names
 * what a unit actually carries.
 *
 * When the documented rule already blocks the action, the dialog becomes a
 * **refusal** naming the children, rather than a confirm button that is going
 * to fail.
 */
export function DeleteAcademicUnitDialog({
  unit,
  blockedReason,
  isPending,
  onOpenChange,
  onConfirm,
}: DeleteAcademicUnitDialogProps) {
  const isBlocked = Boolean(blockedReason);

  return (
    <ConfirmDialog
      open={unit !== null}
      onOpenChange={onOpenChange}
      destructive={!isBlocked}
      icon={Trash2}
      title={
        isBlocked ? "This unit cannot be deleted yet" : "Delete this academic unit?"
      }
      description={
        unit
          ? isBlocked
            ? (blockedReason ?? "")
            : `“${unit.name}” will be soft-deleted. The record is retained, but attendance, marks and enrolment are recorded against academic units, and the API documents no endpoint that restores a deleted one.`
          : ""
      }
      confirmLabel={isBlocked ? "Delete anyway" : "Delete unit"}
      cancelLabel={isBlocked ? "Close" : "Cancel"}
      isPending={isPending}
      onConfirm={() => {
        if (unit && !isBlocked) onConfirm(unit);
      }}
    >
      {isBlocked ? (
        <Banner
          tone="warning"
          title="Deactivate or move the children first"
          description="The documented engine refuses to delete a parent node while any child is active. This check runs against the loaded list; the server is the authority."
        />
      ) : null}
    </ConfirmDialog>
  );
}

export interface ToggleAcademicUnitStatusDialogProps {
  unit: AcademicUnitDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (unit: AcademicUnitDto) => void;
}

/**
 * Confirmation before toggling a unit's active flag.
 *
 * Confirmed rather than fired straight from the menu, because the endpoint
 * takes **no request body** and therefore flips whatever `isActive` currently
 * is instead of setting a requested value. Naming the resulting state before
 * acting is what makes a non-idempotent call safe.
 */
export function ToggleAcademicUnitStatusDialog({
  unit,
  isPending,
  onOpenChange,
  onConfirm,
}: ToggleAcademicUnitStatusDialogProps) {
  const state = unit ? academicUnitState(unit) : "unknown";
  const isDeactivating = state === "active";

  return (
    <ConfirmDialog
      open={unit !== null && state !== "unknown"}
      onOpenChange={onOpenChange}
      icon={Power}
      title={isDeactivating ? "Deactivate this unit?" : "Activate this unit?"}
      description={
        unit
          ? isDeactivating
            ? `“${unit.name}” will be marked inactive for this academic year. The record and its children are retained, and deactivating a unit is also how its parent becomes deletable.`
            : `“${unit.name}” will be in use again for this academic year.`
          : ""
      }
      confirmLabel={isDeactivating ? "Deactivate unit" : "Activate unit"}
      isPending={isPending}
      onConfirm={() => {
        if (unit) onConfirm(unit);
      }}
    />
  );
}

export interface MoveAcademicUnitDialogProps {
  unit: AcademicUnitDto | null;
  /** The whole scope's units, for computing legal destinations. */
  units: readonly AcademicUnitDto[];
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (unit: AcademicUnitDto, parentId: string | null) => void;
}

/**
 * Re-parent a unit — `PATCH /academic-units/:id/move`.
 *
 * The only lifecycle endpoint across both academic modules that carries a
 * **request body**, so unlike every status toggle it names a target rather than
 * flipping a flag. That makes it idempotent and safe to confirm and fire.
 *
 * The destination list is `eligibleParents`, which encodes two documented rule
 * groups at once: consistency (same program — branch and year are already fixed
 * by the scope) and tree (no self-parenting, no descendant). So the control
 * cannot offer a destination the server will refuse.
 *
 * The warning about `level` is not decoration. The doc states it is
 * "maintained across moves dynamically by traversing the subtree", which means
 * a move silently rewrites every descendant's depth — a consequence a user
 * moving one node would not otherwise expect.
 */
export function MoveAcademicUnitDialog({
  unit,
  units,
  isPending,
  onOpenChange,
  onConfirm,
}: MoveAcademicUnitDialogProps) {
  const [parentId, setParentId] = useState<string>(NO_PARENT);

  const options = unit ? eligibleParents(units, unit.programId, unit.id) : [];
  const hasChildren = unit
    ? units.some((candidate) => candidate.parentId === unit.id)
    : false;

  return (
    <ConfirmDialog
      open={unit !== null}
      onOpenChange={(open) => {
        if (!open) setParentId(NO_PARENT);
        onOpenChange(open);
      }}
      icon={ArrowLeftRight}
      title="Move this academic unit?"
      description={
        unit
          ? `Choose a new parent for “${unit.name}”. Only units in the same program are offered, and the unit's own descendants are excluded — both are rules the backend documents.`
          : ""
      }
      confirmLabel="Move unit"
      isPending={isPending}
      onConfirm={() => {
        if (unit) onConfirm(unit, parentId === NO_PARENT ? null : parentId);
      }}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="move-parent">New parent</Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger id="move-parent" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PARENT}>
                No parent — top of the program
              </SelectItem>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasChildren ? (
          <Banner
            tone="warning"
            title="This unit's children move with it"
            description="The documentation states that a node's level is recalculated across the whole subtree on a move, so every descendant's depth changes too."
          />
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
