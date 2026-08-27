"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  Blocks,
  GraduationCap,
  Pencil,
  Power,
  School,
  Trash2,
  TriangleAlert,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import {
  DescriptionList,
  type DescriptionItem,
} from "@/shared/components/data-display";
import { BackendPendingNote, Banner } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { ancestorPath } from "@/utils";

import { PROGRAM_STATE_PRESENTATION, programState } from "../constants";
import {
  useDeleteProgram,
  usePrograms,
  useToggleProgramStatus,
} from "../hooks/use-programs";
import { formatProgramClassification } from "../mappers/program.mapper";
import type { ProgramDto } from "../types/program.dto";
import {
  childrenOf,
  deleteBlockedReason,
  programAccessors,
} from "../utils/program-hierarchy";
import { ProgramBoundary } from "./program-boundary";
import { DeleteProgramDialog, ToggleProgramStatusDialog } from "./program-dialogs";
import { ProgramStatusBadge } from "./program-status-badge";

export interface ProgramDetailsScreenProps {
  id: string;
  /** Activity trail for this program, wired at the route. */
  activityTrail?: React.ReactNode;
}

/** The record itself, once loaded. */
function Details({
  program,
  branchId,
  activityTrail,
}: {
  program: ProgramDto;
  branchId: string;
  activityTrail?: React.ReactNode;
}) {
  const router = useRouter();
  const { programs } = usePrograms(branchId);
  const toggleStatus = useToggleProgramStatus(branchId);
  const deleteProgram = useDeleteProgram(branchId);
  const [isDeletingOpen, setIsDeletingOpen] = useState(false);
  const [isTogglingOpen, setIsTogglingOpen] = useState(false);

  const state = programState(program);
  const children = useMemo(
    () => childrenOf(programs, program.id),
    [programs, program.id],
  );
  const path = useMemo(
    () => ancestorPath(programs, programAccessors, program.id),
    [programs, program.id],
  );
  const blockedReason = deleteBlockedReason(programs, program.id);
  const classification = formatProgramClassification(program);

  const overview: DescriptionItem[] = [
    { key: "name", label: "Name", value: program.name },
    { key: "level", label: "Level", value: program.level || "—" },
    { key: "medium", label: "Medium", value: program.medium || "—" },
    { key: "stream", label: "Stream", value: program.stream || "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={program.name}
        badge={<ProgramStatusBadge program={program} withIcon />}
        description={classification ?? "No medium or stream declared."}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.programs.tree}>
                <Blocks />
                Hierarchy
              </Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.programs.edit(program.id)}>
                <Pencil />
                Edit
              </Link>
            </Button>
          </>
        }
      />

      {state === "unknown" ? (
        <Banner
          tone="warning"
          icon={TriangleAlert}
          title="The current status was not reported"
          description="No response body is documented for the program endpoints, so the active flag may be absent. The status control is withheld: the toggle flips the current value rather than setting a requested one, and flipping an unknown state has an unpredictable result."
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Blocks aria-hidden="true" className="size-4" />
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList items={overview} columns={2} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Position in the hierarchy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {path.length > 1 ? (
              <nav aria-label="Program ancestry">
                <ol className="flex flex-wrap items-center gap-1 text-sm">
                  {path.map((ancestor, index) => (
                    <li key={ancestor.id} className="flex items-center gap-1">
                      {index > 0 ? (
                        <span aria-hidden="true" className="text-muted-foreground">
                          /
                        </span>
                      ) : null}
                      {ancestor.id === program.id ? (
                        <span className="text-foreground font-medium">
                          {ancestor.name}
                        </span>
                      ) : (
                        <Link
                          href={ROUTES.app.programs.detail(ancestor.id)}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {ancestor.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            ) : (
              <p className="text-muted-foreground text-sm">
                This is a top-level program — it declares no parent.
              </p>
            )}

            <div className="space-y-1">
              <p className="text-foreground text-sm font-medium">
                {`Child programs (${children.length})`}
              </p>
              {children.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No programs name this one as their parent.
                </p>
              ) : (
                <ul className="space-y-1">
                  {children.map((child) => (
                    <li key={child.id} className="flex items-center gap-2">
                      <Link
                        href={ROUTES.app.programs.detail(child.id)}
                        className="text-primary truncate text-sm underline-offset-4 hover:underline"
                      >
                        {child.name}
                      </Link>
                      <ProgramStatusBadge program={child} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <School aria-hidden="true" className="size-4" />
              Branch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <DescriptionList
              columns={1}
              items={[
                {
                  key: "branch",
                  label: "Owning branch",
                  value: (
                    <Link
                      href={ROUTES.app.branches.detail(program.branchId)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      <code>{program.branchId}</code>
                    </Link>
                  ),
                },
              ]}
            />
            <BackendPendingNote>
              only the branch id is returned with a program — showing the branch
              name would need it expanded in the response, and no response body
              is documented.
            </BackendPendingNote>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Power aria-hidden="true" className="size-4" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <ProgramStatusBadge program={program} withIcon />
            <p className="text-muted-foreground text-sm">
              {PROGRAM_STATE_PRESENTATION[state].description}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={state === "unknown" || toggleStatus.isPending}
              onClick={() => setIsTogglingOpen(true)}
            >
              <Power />
              {state === "active"
                ? "Deactivate program"
                : state === "inactive"
                  ? "Activate program"
                  : "Unavailable"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap aria-hidden="true" className="size-4" />
            Academic units
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <p className="text-muted-foreground text-sm">
            Academic units — classes, divisions, batches — name a program in
            their request body, and are additionally scoped to one academic
            year. They are managed in their own module.
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            data-guide="program-details-unit-hierarchy-link"
          >
            <Link href={ROUTES.app.academicUnits.tree}>
              View the unit hierarchy
            </Link>
          </Button>
          <BackendPendingNote>
            no endpoint counts or lists academic units by program alone — the
            list requires a branch <em>and</em> an academic year — so a per-program
            total is not shown here.
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
        <CardContent className="pt-0">
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Delete program</p>
              <p className="text-muted-foreground text-sm">
                {blockedReason ??
                  "The documented soft delete. The record is retained, but academic units reference a program by id."}
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              className="shrink-0"
              disabled={blockedReason !== null || deleteProgram.isPending}
              onClick={() => setIsDeletingOpen(true)}
            >
              <Trash2 />
              Delete program
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Record metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <DescriptionList
            columns={2}
            items={[
              {
                key: "id",
                label: "Program id",
                value: <code>{program.id}</code>,
                wide: true,
              },
            ]}
          />
          <BackendPendingNote>
            created and updated timestamps, and the author of the last change,
            are not part of the program contract — there is no data structure
            table and no response body.
          </BackendPendingNote>
        </CardContent>
      </Card>

      {activityTrail ? (
        <section className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">
            Audit trail &amp; activity
          </h2>
          <BackendPendingNote>
            the audit event map documents no <code>program.*</code> event, so
            changes to this record may not appear below.
          </BackendPendingNote>
          {activityTrail}
        </section>
      ) : null}

      <DeleteProgramDialog
        program={isDeletingOpen ? program : null}
        blockedReason={blockedReason}
        isPending={deleteProgram.isPending}
        onOpenChange={(open) => {
          if (!open) setIsDeletingOpen(false);
        }}
        onConfirm={async () => {
          await deleteProgram.mutateAsync(program.id);
          setIsDeletingOpen(false);
          router.push(ROUTES.app.programs.directory);
        }}
      />

      <ToggleProgramStatusDialog
        program={isTogglingOpen ? program : null}
        isPending={toggleStatus.isPending}
        onOpenChange={(open) => {
          if (!open) setIsTogglingOpen(false);
        }}
        onConfirm={async () => {
          await toggleStatus.mutateAsync(program.id);
          setIsTogglingOpen(false);
        }}
      />
    </div>
  );
}

/**
 * One program in full.
 *
 * Every panel is built from a documented field. The design also shows enrolled
 * students, subjects and a fee structure per program; none is in the program
 * contract, and no program-scoped endpoint is documented in another module
 * either, so each is omitted or named as pending.
 *
 * The hierarchy panel is the module's own contribution: ancestry and children
 * are derived from the branch's list with the shared helpers, which is the only
 * way to show them — no endpoint returns a program's relatives.
 */
export function ProgramDetailsScreen({
  id,
  activityTrail,
}: ProgramDetailsScreenProps) {
  return (
    <ProgramBoundary id={id}>
      {(program, branchId) => (
        <Details
          program={program}
          branchId={branchId}
          activityTrail={activityTrail}
        />
      )}
    </ProgramBoundary>
  );
}
