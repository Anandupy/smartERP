"use client";

import { Power } from "@/assets/icons";
import { ConfirmDialog } from "@/shared/components/overlay";

import type { OrganizationDto } from "../types/organization.dto";

export interface DeactivateOrganizationDialogProps {
  /** The organization awaiting confirmation, or `null` when nothing is pending. */
  organization: OrganizationDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (organization: OrganizationDto) => void;
}

/**
 * Confirmation before deactivating an organization.
 *
 * The copy says what the documentation says: this is a **soft delete**. The
 * record is preserved and the organization is marked inactive — so the prompt
 * does not claim the action is irreversible, and the confirm button says
 * "Deactivate" rather than "Delete". Overstating a consequence is its own kind
 * of inaccuracy, and it is the kind that stops people doing legitimate work.
 *
 * What *is* stated is the part that matters: every branch and user underneath
 * loses access, and the contract documents no endpoint to reverse it.
 */
export function DeactivateOrganizationDialog({
  organization,
  isPending,
  onOpenChange,
  onConfirm,
}: DeactivateOrganizationDialogProps) {
  return (
    <ConfirmDialog
      open={organization !== null}
      onOpenChange={onOpenChange}
      destructive
      icon={Power}
      title="Deactivate this organization?"
      description={
        organization
          ? `“${organization.name}” will be marked inactive. The record and its data are preserved, but every branch and user under it loses access — and the API documents no endpoint to reactivate it.`
          : ""
      }
      confirmLabel="Deactivate"
      isPending={isPending}
      onConfirm={() => {
        if (organization) onConfirm(organization);
      }}
    />
  );
}
