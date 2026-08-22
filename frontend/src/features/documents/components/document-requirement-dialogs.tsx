"use client";

import { Power, Trash2 } from "@/assets/icons";
import { ConfirmDialog } from "@/shared/components/overlay";

import type { DocumentRequirementDto } from "../types/document.dto";

export interface DeleteDocumentRequirementDialogProps {
  requirement: DocumentRequirementDto | null;
  requirementLabel: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (requirement: DocumentRequirementDto) => void;
}

export function DeleteDocumentRequirementDialog({
  requirement,
  requirementLabel,
  isPending,
  onOpenChange,
  onConfirm,
}: DeleteDocumentRequirementDialogProps) {
  return (
    <ConfirmDialog
      open={requirement !== null}
      onOpenChange={onOpenChange}
      destructive
      icon={Trash2}
      title="Delete this requirement?"
      description={`"${requirementLabel}" stops appearing on every affected owner's checklist. Documents already uploaded against it are unaffected.`}
      confirmLabel="Delete requirement"
      isPending={isPending}
      onConfirm={() => {
        if (requirement) onConfirm(requirement);
      }}
    />
  );
}

export interface ToggleDocumentRequirementActiveDialogProps {
  requirement: DocumentRequirementDto | null;
  requirementLabel: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (requirement: DocumentRequirementDto) => void;
}

/**
 * No dedicated status endpoint is documented — only the generic
 * `PATCH /document-requirements/:id`, whose body is the complete record —
 * so this resends the whole record with `isActive` flipped.
 */
export function ToggleDocumentRequirementActiveDialog({
  requirement,
  requirementLabel,
  isPending,
  onOpenChange,
  onConfirm,
}: ToggleDocumentRequirementActiveDialogProps) {
  const willActivate = requirement ? !requirement.isActive : false;

  return (
    <ConfirmDialog
      open={requirement !== null}
      onOpenChange={onOpenChange}
      icon={Power}
      title={`${willActivate ? "Activate" : "Deactivate"} "${requirementLabel}"?`}
      description={
        willActivate
          ? "This makes it count toward affected owners' checklists again."
          : "This stops it counting toward any owner's checklist. It can be reactivated at any time."
      }
      confirmLabel={willActivate ? "Activate" : "Deactivate"}
      isPending={isPending}
      onConfirm={() => {
        if (requirement) onConfirm(requirement);
      }}
    />
  );
}
