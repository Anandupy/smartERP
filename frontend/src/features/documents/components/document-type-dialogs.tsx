"use client";

import { Power, Trash2 } from "@/assets/icons";
import { ConfirmDialog } from "@/shared/components/overlay";

import type { DocumentTypeDto } from "../types/document.dto";

export interface DeleteDocumentTypeDialogProps {
  type: DocumentTypeDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (type: DocumentTypeDto) => void;
}

/** Confirmation before deleting a document type. `DELETE` semantics are not confirmed beyond the collection's own folder name — see `docs/documents-management-module.md`. */
export function DeleteDocumentTypeDialog({
  type,
  isPending,
  onOpenChange,
  onConfirm,
}: DeleteDocumentTypeDialogProps) {
  return (
    <ConfirmDialog
      open={type !== null}
      onOpenChange={onOpenChange}
      destructive
      icon={Trash2}
      title="Delete this document type?"
      description={
        type
          ? `“${type.name}” stops appearing in every requirement and upload picker that uses it. Existing documents already uploaded under this type are unaffected.`
          : ""
      }
      confirmLabel="Delete document type"
      isPending={isPending}
      onConfirm={() => {
        if (type) onConfirm(type);
      }}
    />
  );
}

export interface ToggleDocumentTypeActiveDialogProps {
  type: DocumentTypeDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (type: DocumentTypeDto) => void;
}

/**
 * Confirmation before activating or deactivating a document type.
 *
 * No dedicated status endpoint is documented — only the generic
 * `PATCH /document-types/:id`, whose body is the complete record — so this
 * resends the whole record with `isActive` flipped, the same shape Admission
 * Masters uses.
 */
export function ToggleDocumentTypeActiveDialog({
  type,
  isPending,
  onOpenChange,
  onConfirm,
}: ToggleDocumentTypeActiveDialogProps) {
  const willActivate = type ? !type.isActive : false;

  return (
    <ConfirmDialog
      open={type !== null}
      onOpenChange={onOpenChange}
      icon={Power}
      title={type ? `${willActivate ? "Activate" : "Deactivate"} “${type.name}”?` : ""}
      description={
        willActivate
          ? "This makes it available again for new requirements and uploads. Nothing about existing documents changes."
          : "This prevents it from being chosen on new requirements and uploads. Existing documents of this type are left unchanged."
      }
      confirmLabel={willActivate ? "Activate" : "Deactivate"}
      isPending={isPending}
      onConfirm={() => {
        if (type) onConfirm(type);
      }}
    />
  );
}
