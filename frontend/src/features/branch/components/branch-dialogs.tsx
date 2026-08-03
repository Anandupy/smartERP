"use client";

import { Power, Trash2 } from "@/assets/icons";
import { ConfirmDialog } from "@/shared/components/overlay";

import type { BranchDto } from "../types/branch.dto";
import { nextToggleAction } from "../utils/branch-lifecycle";

export interface DeleteBranchDialogProps {
  branch: BranchDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (branch: BranchDto) => void;
}

/**
 * Confirmation before deleting a branch.
 *
 * Both backend documents call this a **soft delete**, and `isDeleted` is a
 * documented field — so the copy says the record is retained rather than
 * claiming the data is destroyed. Overstating a consequence is its own
 * inaccuracy, and the kind that stops people doing legitimate work.
 *
 * What it does state is the part that matters: everything scoped to the branch
 * — academic years, programs, admissions — stops being reachable through it,
 * and no documented endpoint restores a deleted branch.
 */
export function DeleteBranchDialog({
  branch,
  isPending,
  onOpenChange,
  onConfirm,
}: DeleteBranchDialogProps) {
  return (
    <ConfirmDialog
      open={branch !== null}
      onOpenChange={onOpenChange}
      destructive
      icon={Trash2}
      title="Delete this branch?"
      description={
        branch
          ? `“${branch.name}” will be soft-deleted. The record is retained, but everything scoped to the branch — academic years, programs, admissions — stops being reachable through it, and the API documents no endpoint to restore it.`
          : ""
      }
      confirmLabel="Delete branch"
      isPending={isPending}
      onConfirm={() => {
        if (branch) onConfirm(branch);
      }}
    />
  );
}

export interface ToggleBranchStatusDialogProps {
  branch: BranchDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (branch: BranchDto) => void;
}

/**
 * Confirmation before toggling a branch's active flag.
 *
 * Confirmed rather than fired straight from the menu, for a specific reason:
 * the endpoint takes **no request body**, so it flips whatever `isActive`
 * currently is instead of setting a requested value. A mis-click therefore
 * cannot be corrected by clicking the same control again with confidence — the
 * second call flips it back only if the first one landed. Naming the resulting
 * state before acting is what makes that safe.
 */
export function ToggleBranchStatusDialog({
  branch,
  isPending,
  onOpenChange,
  onConfirm,
}: ToggleBranchStatusDialogProps) {
  const action = branch ? nextToggleAction(branch) : null;

  return (
    <ConfirmDialog
      open={branch !== null && action !== null}
      onOpenChange={onOpenChange}
      icon={Power}
      title={action ? `${action.label}?` : ""}
      description={
        branch && action
          ? `${action.description} This applies to “${branch.name}”.`
          : ""
      }
      confirmLabel={action?.label ?? "Confirm"}
      isPending={isPending}
      onConfirm={() => {
        if (branch) onConfirm(branch);
      }}
    />
  );
}
