"use client";

import { History } from "@/assets/icons";
import { EmptyState, LoadingState } from "@/shared/components/feedback";
import { formatDateTime } from "@/utils";

import { useApplicantWorkflowHistory } from "../hooks/use-applicants";
import { STATUS_LABEL } from "../constants";
import type { AdmissionApplicationStatus } from "../types/applicant.dto";

export interface ApplicantWorkflowTimelineProps {
  applicantId: string;
}

/**
 * `GET .../workflow/history` — newest first, scoped to one branch.
 *
 * Every field is read defensively: no captured Postman example expands a
 * history row's shape (`docs/admission-lifecycle-module.md` §8 note on
 * `WorkflowHistoryEntry`), so a missing field renders as an honest gap
 * rather than a guessed value. A freshly admitted student's Enrollment
 * legitimately has **no** history rows at all (`admit()` writes a history
 * row only for the Applicant) — that renders as the ordinary empty state,
 * not an error.
 */
export function ApplicantWorkflowTimeline({
  applicantId,
}: ApplicantWorkflowTimelineProps) {
  const { history, isPending, error } = useApplicantWorkflowHistory(
    applicantId,
  );

  if (isPending) return <LoadingState message="Loading history…" />;

  if (error || history.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No history yet"
        description={
          error
            ? "The workflow history could not be loaded."
            : "No transitions have been recorded for this application yet."
        }
      />
    );
  }

  return (
    <ol className="space-y-4">
      {history.map((entry, index) => {
        const status = entry.newStatus as AdmissionApplicationStatus | undefined;
        return (
          <li
            key={entry.id ?? index}
            className="border-border relative border-l pl-4"
          >
            <span
              aria-hidden="true"
              className="bg-primary absolute top-1.5 -left-[3.5px] size-1.5 rounded-full"
            />
            <p className="text-sm font-medium">
              {entry.actionType ??
                (status ? STATUS_LABEL[status] : "Transition")}
              {entry.oldStatus && status
                ? ` — ${entry.oldStatus} → ${status}`
                : null}
            </p>
            {entry.remarks ? (
              <p className="text-muted-foreground text-sm">{entry.remarks}</p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              {entry.createdAt ? formatDateTime(entry.createdAt) : "Unknown time"}
              {entry.actionBy ? ` · ${entry.actionBy}` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
