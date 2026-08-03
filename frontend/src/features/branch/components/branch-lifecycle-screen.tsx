"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Ban,
  CircleCheckBig,
  Power,
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

import { BRANCH_STATE_PRESENTATION, branchState } from "../constants";
import { useDeleteBranch, useToggleBranchStatus } from "../hooks/use-branches";
import type { BranchDto } from "../types/branch.dto";
import {
  BRANCH_LIFECYCLE_STAGES,
  SUPPORTED_BRANCH_STAGES,
  isCurrentBranchStage,
  nextToggleAction,
  type BranchLifecycleStage,
} from "../utils/branch-lifecycle";
import { BranchBoundary } from "./branch-boundary";
import { DeleteBranchDialog, ToggleBranchStatusDialog } from "./branch-dialogs";
import { BranchStatusBadge } from "./branch-status-badge";

/** One stage on the timeline. */
function Stage({
  stage,
  isCurrent,
  isLast,
}: {
  stage: BranchLifecycleStage;
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
        </div>
        <p className="text-muted-foreground text-sm">{stage.description}</p>
        <p className="text-muted-foreground text-xs">{stage.transition}</p>
      </div>
    </li>
  );
}

/** The lifecycle view for one loaded branch. */
function Lifecycle({ branch }: { branch: BranchDto }) {
  const router = useRouter();
  const toggleStatus = useToggleBranchStatus();
  const deleteBranch = useDeleteBranch();
  const [isTogglingOpen, setIsTogglingOpen] = useState(false);
  const [isDeletingOpen, setIsDeletingOpen] = useState(false);

  const state = branchState(branch);
  const toggle = nextToggleAction(branch);
  const isDeleted = state === "deleted";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Lifecycle"
        badge={<BranchStatusBadge branch={branch} withIcon />}
        description={`Operational status and end-of-life policy for ${branch.name}.`}
      />

      {state === "unknown" ? (
        <Banner
          tone="warning"
          icon={TriangleAlert}
          title="The current status was not reported"
          description="No response body is documented for the branch endpoints, so the active flag may be absent. Status actions are withheld: the toggle flips the current value rather than setting a requested one, and flipping an unknown state has an unpredictable result."
        />
      ) : (
        <Banner
          tone="info"
          icon={Power}
          title="Two of the four stages below are reachable"
          description="The API documents an active flag, a status toggle and a soft delete. Archiving and permanent deletion have no field and no endpoint, and are marked rather than simulated."
        />
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            Operational status
            <span className="text-muted-foreground text-xs font-normal">
              {SUPPORTED_BRANCH_STAGES.length} of{" "}
              {BRANCH_LIFECYCLE_STAGES.length} reachable
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ol className="relative">
            {BRANCH_LIFECYCLE_STAGES.map((stage, index) => (
              <Stage
                key={stage.label}
                stage={stage}
                isCurrent={isCurrentBranchStage(stage, branch)}
                isLast={index === BRANCH_LIFECYCLE_STAGES.length - 1}
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
          <BranchStatusBadge branch={branch} withIcon />
          <p className="text-muted-foreground text-sm">
            {BRANCH_STATE_PRESENTATION[state].description}
          </p>
          <BackendPendingNote>
            the status endpoint takes no request body, so it flips the active
            flag rather than setting a chosen value. That makes it
            non-idempotent — this app never retries it and never fires it
            speculatively.
          </BackendPendingNote>
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
              <p className="text-sm font-medium">
                {toggle?.label ?? "Change operating status"}
              </p>
              <p className="text-muted-foreground text-sm">
                {toggle?.description ??
                  (isDeleted
                    ? "A deleted branch has no operating status to change."
                    : "The current status was not reported, so the result of a toggle cannot be predicted.")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={!toggle || toggleStatus.isPending}
              onClick={() => setIsTogglingOpen(true)}
            >
              <Power />
              {toggle?.label ?? "Unavailable"}
            </Button>
          </div>

          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Archive branch
                <BackendPendingBadge />
              </p>
              <p className="text-muted-foreground text-sm">
                No field, no value and no endpoint. Archiving differs from
                inactive only in the design.
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
              <p className="text-sm font-medium">Delete branch</p>
              <p className="text-muted-foreground text-sm">
                The documented soft delete. The record is retained, but
                everything scoped to the branch stops being reachable through
                it.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              className="shrink-0"
              disabled={isDeleted || deleteBranch.isPending}
              onClick={() => setIsDeletingOpen(true)}
            >
              <Trash2 />
              {isDeleted ? "Already deleted" : "Delete branch"}
            </Button>
          </div>

          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Permanent deletion
                <BackendPendingBadge />
              </p>
              <p className="text-muted-foreground text-sm">
                The platform performs soft deletes only. No endpoint removes a
                branch&apos;s records.
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

      <ToggleBranchStatusDialog
        branch={isTogglingOpen ? branch : null}
        isPending={toggleStatus.isPending}
        onOpenChange={(open) => {
          if (!open) setIsTogglingOpen(false);
        }}
        onConfirm={async () => {
          await toggleStatus.mutateAsync(branch.id);
          setIsTogglingOpen(false);
        }}
      />

      <DeleteBranchDialog
        branch={isDeletingOpen ? branch : null}
        isPending={deleteBranch.isPending}
        onOpenChange={(open) => {
          if (!open) setIsDeletingOpen(false);
        }}
        onConfirm={async () => {
          await deleteBranch.mutateAsync(branch.id);
          setIsDeletingOpen(false);
          router.push(ROUTES.app.branches.directory);
        }}
      />
    </div>
  );
}

export interface BranchLifecycleScreenProps {
  id: string;
}

/**
 * The branch lifecycle.
 *
 * Better supported than the organization equivalent: `isActive` has a real
 * write path (`PATCH /branches/:id/status`) and `isDeleted` a documented soft
 * delete, so three of the design's five stages are genuinely reachable and the
 * active/inactive transition works in both directions.
 *
 * The two that are not — archiving and permanent deletion — render with their
 * reasons rather than being dropped or simulated. And when the backend does not
 * report a status at all, the status controls are withheld entirely: a toggle
 * that flips rather than sets has an unpredictable result from an unknown
 * starting point, and that is worth refusing rather than guessing.
 */
export function BranchLifecycleScreen({ id }: BranchLifecycleScreenProps) {
  return (
    <BranchBoundary id={id}>
      {(branch) => <Lifecycle branch={branch} />}
    </BranchBoundary>
  );
}
