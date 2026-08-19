"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib";
import { ConfirmDialog } from "@/shared/components/overlay";

import { useApplicantWorkflowTransition } from "../hooks/use-applicants";
import type { ApplicantDto } from "../types/applicant.dto";
import { actionsFor, type WorkflowActionDescriptor } from "../utils/workflow";

export interface ApplicantWorkflowActionsProps {
  applicant: ApplicantDto;
}

/**
 * The status-driven action area.
 *
 * Every button offered here comes from `actionsFor(applicant.admissionStatus)`
 * — never a hardcoded list — so the UI can never show an action the backend
 * would refuse with `400 INVALID_TRANSITION`. `ADMITTED` never appears: it is
 * reached only through the dedicated Admit flow, not this action list.
 */
export function ApplicantWorkflowActions({
  applicant,
}: ApplicantWorkflowActionsProps) {
  const [pending, setPending] = useState<WorkflowActionDescriptor | null>(
    null,
  );
  const [remarks, setRemarks] = useState("");
  const transition = useApplicantWorkflowTransition(applicant.id);

  const actions = actionsFor(applicant.admissionStatus);

  if (actions.length === 0) return null;

  const close = () => {
    setPending(null);
    setRemarks("");
  };

  const remarksInvalid =
    pending?.remarksRequired === true && remarks.trim().length === 0;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.action}
          type="button"
          variant={action.isDestructive ? "outline" : "default"}
          className={action.isDestructive ? "text-destructive" : undefined}
          onClick={() => setPending(action)}
        >
          {action.label}
        </Button>
      ))}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        destructive={pending?.isDestructive}
        title={pending ? `${pending.label}?` : ""}
        description={pending?.description ?? ""}
        confirmLabel={pending?.label ?? "Confirm"}
        isPending={transition.isPending}
        onConfirm={async () => {
          if (!pending || remarksInvalid) return;
          try {
            await transition.mutateAsync({
              action: pending.action,
              remarks: remarks.trim() || undefined,
            });
            close();
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        }}
      >
        <div className="space-y-2">
          {pending?.guardNote ? (
            <p className="text-muted-foreground text-sm">{pending.guardNote}</p>
          ) : null}
          <Label htmlFor="workflow-remarks">
            Remarks
            {pending?.remarksRequired ? (
              <span className="text-destructive"> (required)</span>
            ) : (
              <span className="text-muted-foreground"> (optional)</span>
            )}
          </Label>
          <Textarea
            id="workflow-remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            disabled={transition.isPending}
            placeholder="Why this action is being taken…"
          />
          {remarksInvalid ? (
            <p className="text-destructive text-xs">
              A reason is required for this action.
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}
