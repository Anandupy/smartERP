"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Ban,
  CalendarCheck,
  CircleCheckBig,
  Lock,
  Trash2,
  TriangleAlert,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { cn } from "@/lib/utils";
import {
  BackendPendingBadge,
  BackendPendingNote,
  Banner,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  ACADEMIC_YEAR_STATE_PRESENTATION,
  academicYearState,
} from "../constants";
import {
  useAcademicYearTransition,
  useDeleteAcademicYear,
} from "../hooks/use-academic-years";
import type { AcademicYearDto } from "../types/academic-year.dto";
import {
  ACADEMIC_YEAR_LIFECYCLE_STAGES,
  SUPPORTED_ACADEMIC_YEAR_STAGES,
  UNSUPPORTED_ACADEMIC_YEAR_TRANSITIONS,
  deleteBlockedReason,
  isCurrentAcademicYearStage,
  lifecycleActions,
  type AcademicYearLifecycleStage,
  type LifecycleAction,
} from "../utils/academic-year-lifecycle";
import { AcademicYearBoundary } from "./academic-year-boundary";
import {
  DeleteAcademicYearDialog,
  TransitionAcademicYearDialog,
} from "./academic-year-dialogs";
import { AcademicYearStatusBadge } from "./academic-year-status-badge";

/** The glyph each documented transition leads with. */
const TRANSITION_ICON = {
  activate: CircleCheckBig,
  select: CalendarCheck,
  lock: Lock,
} as const;

/** One stage on the timeline. */
function Stage({
  stage,
  isCurrent,
  isLast,
}: {
  stage: AcademicYearLifecycleStage;
  isCurrent: boolean;
  isLast: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* The connector to the next stage. Rendered conditionally rather than
          with a `last:` variant, which would key off this span's own position
          among its siblings — it is the first, not the last. */}
      {!isLast ? (
        <span
          aria-hidden="true"
          className="bg-border absolute top-6 bottom-0 left-[0.6875rem] w-px"
        />
      ) : null}

      <span
        aria-hidden="true"
        className={cn(
          "relative z-10 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
          isCurrent
            ? "border-primary bg-primary text-primary-foreground"
            : stage.isSupported
              ? "border-border bg-background text-muted-foreground"
              : "border-border bg-background text-muted-foreground border-dashed",
        )}
      >
        {isCurrent ? (
          <CircleCheckBig className="size-3.5" />
        ) : stage.isSupported ? (
          <span className="bg-muted-foreground size-1.5 rounded-full" />
        ) : (
          <Ban className="size-3" />
        )}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={cn(
              "text-sm font-medium",
              stage.isSupported ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {stage.label}
          </h3>
          {isCurrent ? (
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
              Current
            </span>
          ) : null}
          {!stage.isSupported ? <BackendPendingBadge /> : null}
          {stage.isSupported && !stage.isObservable ? (
            <span className="text-muted-foreground rounded-full border border-dashed px-2 py-0.5 text-xs">
              Not observable
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">{stage.description}</p>
        <p className="text-muted-foreground text-xs">{stage.transition}</p>
      </div>
    </li>
  );
}

/** One row in the actions list: offerable, or withheld with its reason. */
function ActionRow({
  action,
  isPending,
  onRun,
}: {
  action: LifecycleAction;
  isPending: boolean;
  onRun: () => void;
}) {
  const Icon = TRANSITION_ICON[action.transition];
  const isBlocked = action.blockedReason !== null;

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{action.label}</p>
        <p className="text-muted-foreground text-sm">
          {action.blockedReason ?? action.description}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        disabled={isBlocked || isPending}
        onClick={onRun}
      >
        <Icon />
        {action.label}
      </Button>
    </div>
  );
}

/** The lifecycle view for one resolved year. */
function Lifecycle({
  year,
  branchId,
}: {
  year: AcademicYearDto;
  branchId: string;
}) {
  const router = useRouter();
  const transition = useAcademicYearTransition(branchId);
  const deleteYear = useDeleteAcademicYear(branchId);
  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(
    null,
  );
  const [isDeletingOpen, setIsDeletingOpen] = useState(false);

  const state = academicYearState(year);
  const actions = lifecycleActions(year);
  const cannotDelete = deleteBlockedReason(year);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Year Lifecycle"
        badge={<AcademicYearStatusBadge year={year} withIcon />}
        description={`Operational status and end-of-life policy for ${year.name}.`}
      />

      <Banner
        tone={state === "locked" ? "warning" : "info"}
        icon={state === "locked" ? Lock : CalendarCheck}
        title={
          state === "locked"
            ? "This year is locked, and locking is final"
            : "Every transition below is one-way"
        }
        description={
          state === "locked"
            ? "The documentation states a locked year cannot be modified or deleted, and the API documents no endpoint that unlocks one. Nothing further can be done to this record."
            : "The API documents activate, select and lock — and no inverse for any of them. Each names its target state, so a repeated call is harmless, but there is no deactivate, no deselect and no unlock. Every action is confirmed before it fires."
        }
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            Lifecycle stages
            <span className="text-muted-foreground text-xs font-normal">
              {SUPPORTED_ACADEMIC_YEAR_STAGES.length} of{" "}
              {ACADEMIC_YEAR_LIFECYCLE_STAGES.length} reachable
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ol className="relative">
            {ACADEMIC_YEAR_LIFECYCLE_STAGES.map((stage, index) => (
              <Stage
                key={stage.label}
                stage={stage}
                isCurrent={isCurrentAcademicYearStage(stage, year)}
                isLast={index === ACADEMIC_YEAR_LIFECYCLE_STAGES.length - 1}
              />
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Current state</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <AcademicYearStatusBadge year={year} withIcon />
          <p className="text-muted-foreground text-sm">
            {ACADEMIC_YEAR_STATE_PRESENTATION[state].description}
          </p>
          <BackendPendingNote>
            no response body is documented for any of these endpoints, so a flag
            that does not come back is shown as unreported rather than assumed
            false.
          </BackendPendingNote>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Lifecycle actions</CardTitle>
        </CardHeader>
        <CardContent className="divide-border divide-y pt-0">
          {actions.map((action) => (
            <ActionRow
              key={action.transition}
              action={action}
              isPending={transition.isPending}
              onRun={() => setPendingAction(action)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Transitions the API does not document</CardTitle>
        </CardHeader>
        <CardContent className="divide-border divide-y pt-0">
          {UNSUPPORTED_ACADEMIC_YEAR_TRANSITIONS.map((item) => (
            <div
              key={item.label}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {item.label}
                  <BackendPendingBadge />
                </p>
                <p className="text-muted-foreground text-sm">{item.reason}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled
              >
                {item.label}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader className="border-b">
          <CardTitle className="text-destructive flex items-center gap-2">
            <TriangleAlert aria-hidden="true" className="size-4" />
            Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-border divide-y pt-0">
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Delete academic year</p>
              <p className="text-muted-foreground text-sm">
                {cannotDelete ??
                  "The documented soft delete. The record is retained, but everything scoped to the year stops being reachable through it."}
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              className="shrink-0"
              disabled={cannotDelete !== null || deleteYear.isPending}
              onClick={() => setIsDeletingOpen(true)}
            >
              <Trash2 />
              Delete year
            </Button>
          </div>

          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Archive year
                <BackendPendingBadge />
              </p>
              <p className="text-muted-foreground text-sm">
                No field, no value and no endpoint. Archiving differs from
                locking only in the design.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled
            >
              Archive
            </Button>
          </div>

          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Permanent deletion
                <BackendPendingBadge />
              </p>
              <p className="text-muted-foreground text-sm">
                The platform performs soft deletes only. No endpoint removes an
                academic year&apos;s records.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled
            >
              Delete permanently
            </Button>
          </div>
        </CardContent>
      </Card>

      <TransitionAcademicYearDialog
        year={pendingAction ? year : null}
        action={pendingAction}
        isPending={transition.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        onConfirm={async (target, name) => {
          await transition.mutateAsync({ id: target.id, transition: name });
          setPendingAction(null);
        }}
      />

      <DeleteAcademicYearDialog
        year={isDeletingOpen ? year : null}
        isPending={deleteYear.isPending}
        onOpenChange={(open) => {
          if (!open) setIsDeletingOpen(false);
        }}
        onConfirm={async () => {
          await deleteYear.mutateAsync(year.id);
          setIsDeletingOpen(false);
          router.push(ROUTES.app.academicYears.directory);
        }}
      />
    </div>
  );
}

export interface AcademicYearLifecycleScreenProps {
  id: string;
}

/**
 * The academic year lifecycle.
 *
 * The best-supported lifecycle of any module shipped so far, and for a reason
 * worth naming: the three transitions each **name a target state** in the path
 * — `activate`, `select`, `lock` — which makes them idempotent. The branch
 * status toggle flips a flag and therefore has to be withheld when the current
 * state is unknown; nothing here does, because firing `lock` on a year whose
 * flags never came back still produces a locked year.
 *
 * What the contract has none of is an **inverse**. There is no deactivate, no
 * deselect, no unlock and no restore, so this screen is built around making
 * that unmissable: the four missing transitions get a panel of their own rather
 * than being silently absent, every confirmation carries the warning, and a
 * locked year has all of its actions withheld with the documented reason.
 */
export function AcademicYearLifecycleScreen({
  id,
}: AcademicYearLifecycleScreenProps) {
  return (
    <AcademicYearBoundary id={id}>
      {(year, branchId) => <Lifecycle year={year} branchId={branchId} />}
    </AcademicYearBoundary>
  );
}
