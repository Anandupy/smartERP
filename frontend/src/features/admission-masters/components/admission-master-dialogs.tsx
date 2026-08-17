"use client";

import { Power, Trash2 } from "@/assets/icons";
import { ConfirmDialog } from "@/shared/components/overlay";

import type { AdmissionMasterConfig } from "../config/admission-master-registry";
import type { AdmissionMasterDto } from "../types/admission-master.dto";

export interface DeleteAdmissionMasterDialogProps {
  config: AdmissionMasterConfig;
  master: AdmissionMasterDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (master: AdmissionMasterDto) => void;
}

/**
 * Confirmation before deleting a master record.
 *
 * Every one of the 10 masters' `DELETE` folders in the Postman collection is
 * literally named "Soft delete", and the record documents a `deletedAt`
 * field — so the copy says the record is retained rather than claiming the
 * data is destroyed. No restore endpoint is documented for any of the 10.
 */
export function DeleteAdmissionMasterDialog({
  config,
  master,
  isPending,
  onOpenChange,
  onConfirm,
}: DeleteAdmissionMasterDialogProps) {
  return (
    <ConfirmDialog
      open={master !== null}
      onOpenChange={onOpenChange}
      destructive
      icon={Trash2}
      title={`Delete this ${config.singularLabel.toLowerCase()}?`}
      description={
        master
          ? `“${master.name}” will be soft-deleted. The record is retained, but it stops appearing in every list and picker that uses ${config.pluralLabel.toLowerCase()} — including on existing admission records that reference it — and the API documents no endpoint to restore it.`
          : ""
      }
      confirmLabel={`Delete ${config.singularLabel.toLowerCase()}`}
      isPending={isPending}
      onConfirm={() => {
        if (master) onConfirm(master);
      }}
    />
  );
}

export interface ToggleAdmissionMasterActiveDialogProps {
  master: AdmissionMasterDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (master: AdmissionMasterDto) => void;
}

/**
 * Confirmation before activating or deactivating a record.
 *
 * Unlike branch's status toggle, this one is idempotent — the request sends
 * the target `isActive` value explicitly (see
 * `toAdmissionMasterToggleRequest`), so a retry cannot silently flip it back.
 * It is still confirmed rather than fired straight from the row menu, because
 * deactivating hides the option from every new admission record while
 * existing records that reference it are left unchanged — a consequence
 * worth naming before it happens.
 */
export function ToggleAdmissionMasterActiveDialog({
  master,
  isPending,
  onOpenChange,
  onConfirm,
}: ToggleAdmissionMasterActiveDialogProps) {
  const willActivate = master ? !master.isActive : false;

  return (
    <ConfirmDialog
      open={master !== null}
      onOpenChange={onOpenChange}
      icon={Power}
      title={
        master
          ? `${willActivate ? "Activate" : "Deactivate"} “${master.name}”?`
          : ""
      }
      description={
        willActivate
          ? `This makes it available again for new admission records. Nothing about existing records changes.`
          : `This prevents it from being chosen on new admission records. Existing records that already reference it are left unchanged, and it can be reactivated at any time.`
      }
      confirmLabel={willActivate ? "Activate" : "Deactivate"}
      isPending={isPending}
      onConfirm={() => {
        if (master) onConfirm(master);
      }}
    />
  );
}
