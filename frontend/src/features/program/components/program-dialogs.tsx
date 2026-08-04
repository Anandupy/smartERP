"use client";

import { Power, Trash2 } from "@/assets/icons";
import { Banner } from "@/shared/components/feedback";
import { ConfirmDialog } from "@/shared/components/overlay";

import { programState } from "../constants";
import type { ProgramDto } from "../types/program.dto";

export interface DeleteProgramDialogProps {
  program: ProgramDto | null;
  /** From `deleteBlockedReason`. Non-null renders the dialog as a refusal. */
  blockedReason?: string | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (program: ProgramDto) => void;
}

/**
 * Confirmation before deleting a program.
 *
 * The endpoint table calls this a **soft delete**, so the copy says the record
 * is retained rather than claiming the data is destroyed.
 *
 * What it does state is documented rule 4 and its consequence: a program with
 * active children is refused, and academic units name a `programId` in their
 * request body — so deleting a program is not deleting an empty container. When
 * the rule already blocks the action the dialog becomes a **refusal**, naming
 * the children, rather than a confirm button that is going to fail.
 */
export function DeleteProgramDialog({
  program,
  blockedReason,
  isPending,
  onOpenChange,
  onConfirm,
}: DeleteProgramDialogProps) {
  const isBlocked = Boolean(blockedReason);

  return (
    <ConfirmDialog
      open={program !== null}
      onOpenChange={onOpenChange}
      destructive={!isBlocked}
      icon={Trash2}
      title={
        isBlocked ? "This program cannot be deleted yet" : "Delete this program?"
      }
      description={
        program
          ? isBlocked
            ? (blockedReason ?? "")
            : `“${program.name}” will be soft-deleted. The record is retained, but academic units reference a program by id, and the API documents no endpoint that restores a deleted one.`
          : ""
      }
      confirmLabel={isBlocked ? "Delete anyway" : "Delete program"}
      cancelLabel={isBlocked ? "Close" : "Cancel"}
      isPending={isPending}
      onConfirm={() => {
        if (program && !isBlocked) onConfirm(program);
      }}
    >
      {isBlocked ? (
        <Banner
          tone="warning"
          title="Deactivate or remove the children first"
          description="Documented validation rule 4 refuses a delete while any child program is active. This check runs against the branch's loaded list; the server is the authority."
        />
      ) : null}
    </ConfirmDialog>
  );
}

export interface ToggleProgramStatusDialogProps {
  program: ProgramDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (program: ProgramDto) => void;
}

/**
 * Confirmation before toggling a program's active flag.
 *
 * Confirmed rather than fired straight from the menu, for the reason the branch
 * equivalent is: the endpoint takes **no request body**, so it flips whatever
 * `isActive` currently is instead of setting a requested value. A mis-click
 * therefore cannot be corrected by clicking the same control again with
 * confidence — the second call flips it back only if the first one landed.
 * Naming the resulting state before acting is what makes that safe.
 */
export function ToggleProgramStatusDialog({
  program,
  isPending,
  onOpenChange,
  onConfirm,
}: ToggleProgramStatusDialogProps) {
  const state = program ? programState(program) : "unknown";
  const isDeactivating = state === "active";

  return (
    <ConfirmDialog
      open={program !== null && state !== "unknown"}
      onOpenChange={onOpenChange}
      icon={Power}
      title={isDeactivating ? "Deactivate this program?" : "Activate this program?"}
      description={
        program
          ? isDeactivating
            ? `“${program.name}” will be suspended. The record is retained and the same control restores it. Documented rule 4 also means deactivating a child is how its parent becomes deletable.`
            : `“${program.name}” will become available again for academic units, enrolment and curriculum.`
          : ""
      }
      confirmLabel={isDeactivating ? "Deactivate program" : "Activate program"}
      isPending={isPending}
      onConfirm={() => {
        if (program) onConfirm(program);
      }}
    />
  );
}
