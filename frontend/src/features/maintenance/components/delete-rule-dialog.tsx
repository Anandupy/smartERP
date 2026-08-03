"use client";

import { ConfirmDialog } from "@/shared/components/overlay";

import { SCOPE_PRESENTATION } from "../constants";
import type { MaintenanceRuleDto } from "../types/maintenance.dto";

export interface DeleteRuleDialogProps {
  /** The rule awaiting confirmation, or `null` when nothing is pending. */
  rule: MaintenanceRuleDto | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (rule: MaintenanceRuleDto) => void;
}

/**
 * Confirmation before removing a rule.
 *
 * The copy names what is being deleted *and* what deleting it changes: an
 * active rule is currently restricting access, so removing it restores access
 * immediately. That consequence is the reason to confirm at all — the record
 * itself is trivially recreatable.
 */
export function DeleteRuleDialog({
  rule,
  isPending,
  onOpenChange,
  onConfirm,
}: DeleteRuleDialogProps) {
  const scope = rule ? SCOPE_PRESENTATION[rule.scopeType] : null;
  const name = rule?.title?.trim() || scope?.label || "this rule";

  return (
    <ConfirmDialog
      open={rule !== null}
      onOpenChange={onOpenChange}
      destructive
      title="Delete this maintenance rule?"
      description={
        rule?.isActive
          ? `“${name}” is active. Deleting it lifts the restriction immediately and cannot be undone.`
          : `“${name}” will be removed permanently. This cannot be undone.`
      }
      confirmLabel="Delete rule"
      isPending={isPending}
      onConfirm={() => {
        if (rule) onConfirm(rule);
      }}
    />
  );
}
