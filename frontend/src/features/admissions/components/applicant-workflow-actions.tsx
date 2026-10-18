"use client";

import { useState } from "react";
import { toast } from "sonner";

import { CircleAlert } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib";
import { InlineError } from "@/shared/components/feedback";
import { ConfirmDialog } from "@/shared/components/overlay";

import { useApplicantWorkflowTransition } from "../hooks/use-applicants";
import type { ApplicantDto, WorkflowAction } from "../types/applicant.dto";
import type {
  WorkflowActionAvailability,
  WorkflowActionsDto,
} from "../types/workflow-policy.dto";
import { ACTION_PRESENTATION, describeBlocker } from "../utils/workflow";

export interface ApplicantWorkflowActionsProps {
  applicant: ApplicantDto;
  /** The backend's actions read for this applicant (`useApplicantWorkflowActions`). */
  actions: WorkflowActionsDto | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  /**
   * Actions a profile-specific journey performs itself — under
   * SIMPLE_ADMISSION the forward steps run inside the one-step admission, so
   * offering them as separate buttons too would be the screens that profile
   * exists to remove. The backend still accepts them; this only declutters.
   */
  hidden?: ReadonlySet<WorkflowAction>;
}

type TransitionAction = WorkflowActionAvailability & { action: WorkflowAction };

/**
 * The status-driven action area.
 *
 * Every button comes from the backend's `workflow/actions` read — never from
 * a list kept here — so a branch whose policy switches a step off, a stricter
 * profile's extra checks, and the caller's own permissions are all reflected
 * exactly. An action the caller may not perform is not offered at all; one
 * that is currently blocked is shown disabled with the reason. Either way the
 * transition endpoint re-checks everything when it runs.
 *
 * `admit` never appears here: it is performed by the dedicated admission flow
 * (`via: "ADMIT"`), not the generic transition endpoint.
 */
export function ApplicantWorkflowActions({
  applicant,
  actions,
  isPending,
  error,
  onRetry,
  hidden,
}: ApplicantWorkflowActionsProps) {
  const [pending, setPending] = useState<TransitionAction | null>(null);
  const [remarks, setRemarks] = useState("");
  const transition = useApplicantWorkflowTransition(applicant.id);

  if (isPending) {
    return (
      <div className="flex flex-wrap gap-2" aria-busy="true">
        <span className="sr-only">Loading available actions</span>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>
    );
  }

  if (error) {
    return (
      <InlineError
        title="Available actions could not be loaded"
        error={error}
        onRetry={onRetry}
      />
    );
  }

  const offered = (actions?.actions ?? []).filter(
    (a): a is TransitionAction =>
      a.via === "TRANSITION" &&
      a.permitted &&
      !hidden?.has(a.action as WorkflowAction),
  );

  if (offered.length === 0) return null;

  const close = () => {
    setPending(null);
    setRemarks("");
  };

  const presentation = pending ? ACTION_PRESENTATION[pending.action] : null;
  const remarksRequired = pending?.remarks === "REQUIRED";
  const remarksInvalid = remarksRequired && remarks.trim().length === 0;
  const blocked = offered.filter((a) => !a.available);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {offered.map((action) => {
          const meta = ACTION_PRESENTATION[action.action];
          return (
            <Button
              key={action.action}
              type="button"
              variant={meta.isDestructive ? "outline" : "default"}
              className={meta.isDestructive ? "text-destructive" : undefined}
              disabled={!action.available}
              aria-describedby={
                action.available ? undefined : `blocked-${action.action}`
              }
              onClick={() => setPending(action)}
            >
              {meta.label}
            </Button>
          );
        })}
      </div>

      {blocked.length > 0 ? (
        <ul
          className="space-y-1.5"
          aria-label="Why some actions are unavailable"
        >
          {blocked.map((action) => (
            <li
              key={action.action}
              id={`blocked-${action.action}`}
              className="text-muted-foreground flex items-start gap-1.5 text-sm"
            >
              <CircleAlert
                aria-hidden="true"
                className="text-chart-4 mt-0.5 size-4 shrink-0"
              />
              <span>
                <span className="text-foreground font-medium">
                  {ACTION_PRESENTATION[action.action].label}:
                </span>{" "}
                {action.blockedBy.map(describeBlocker).join(" ")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        destructive={presentation?.isDestructive}
        title={presentation ? `${presentation.label}?` : ""}
        description={presentation?.description ?? ""}
        confirmLabel={presentation?.label ?? "Confirm"}
        isPending={transition.isPending}
        onConfirm={async () => {
          if (!pending || remarksInvalid) return;
          try {
            await transition.mutateAsync({
              action: pending.action,
              remarks: remarks.trim() || undefined,
            });
            close();
          } catch (caught) {
            toast.error(getErrorMessage(caught));
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="workflow-remarks">
            Remarks
            {remarksRequired ? (
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
