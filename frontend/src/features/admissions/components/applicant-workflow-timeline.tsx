"use client";

import { History } from "@/assets/icons";
import { useAuth } from "@/core/auth";
import { EmptyState, LoadingState } from "@/shared/components/feedback";
import { formatDateTime } from "@/utils";

import { useApplicantWorkflowHistory } from "../hooks/use-applicants";
import { STATUS_LABEL } from "../constants";
import type {
  AdmissionApplicationStatus,
  WorkflowHistoryEntry,
} from "../types/applicant.dto";
import { describeHistoryActor, historyActionLabel } from "../utils/workflow";

export interface ApplicantWorkflowTimelineProps {
  applicantId: string;
}

/**
 * `GET .../workflow/history` — newest first, scoped to one branch.
 *
 * Read against `WorkflowHistoryDto` in the OpenAPI document: the event time is
 * `timestamp`. A row that genuinely lacks one says "Time not recorded" — it
 * is never given the current time or the application's creation time. The
 * actor is the user id the row records (or "System" / "You"); no name is
 * invented for an id this module cannot resolve. A freshly admitted student's
 * Enrollment legitimately has **no** history rows at all (`admit()` writes a
 * history row only for the Applicant) — that renders as the ordinary empty
 * state, not an error.
 */
export function ApplicantWorkflowTimeline({
  applicantId,
}: ApplicantWorkflowTimelineProps) {
  const { history, isPending, error } =
    useApplicantWorkflowHistory(applicantId);
  const { user } = useAuth();

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
      {history.map((entry, index) => (
        <HistoryRow
          key={entry.id ?? index}
          entry={entry}
          currentUserId={user?.id ?? null}
        />
      ))}
    </ol>
  );
}

function statusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return STATUS_LABEL[status as AdmissionApplicationStatus] ?? status;
}

function HistoryRow({
  entry,
  currentUserId,
}: {
  entry: WorkflowHistoryEntry;
  currentUserId: string | null;
}) {
  const from = statusLabel(entry.oldStatus);
  const to = statusLabel(entry.newStatus);
  const title = entry.actionType
    ? historyActionLabel(entry.actionType)
    : (to ?? "Transition");
  const when = entry.timestamp ? formatDateTime(entry.timestamp) : "";
  const actor = describeHistoryActor(entry.actionBy, currentUserId);

  return (
    <li className="border-border relative border-l pl-4">
      <span
        aria-hidden="true"
        className="bg-primary absolute top-1.5 -left-[3.5px] size-1.5 rounded-full"
      />
      <p className="text-sm font-medium">{title}</p>
      {from && to ? (
        <p className="text-muted-foreground text-sm">
          {from} <span aria-hidden="true">→</span>
          <span className="sr-only">to</span> {to}
        </p>
      ) : null}
      {entry.remarks ? (
        <p className="text-muted-foreground text-sm">{entry.remarks}</p>
      ) : null}
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
        {when ? (
          <time dateTime={entry.timestamp}>{when}</time>
        ) : (
          <span>Time not recorded</span>
        )}
        {actor ? (
          <>
            <span aria-hidden="true">·</span>
            {actor.isId ? (
              <span>
                by user{" "}
                <code className="font-mono" title={actor.label}>
                  {actor.label}
                </code>
              </span>
            ) : (
              <span>by {actor.label}</span>
            )}
          </>
        ) : null}
      </p>
    </li>
  );
}
