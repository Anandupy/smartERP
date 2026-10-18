"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  Blocks,
  CircleCheckBig,
  GraduationCap,
  Plus,
  Power,
  School,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { GuideHelpTrigger } from "@/core/guides";
import { LinkCard, StatCard } from "@/shared/components/data-display";
import {
  ApiErrorState,
  BackendPendingNote,
  Banner,
  EmptyState,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatNumber } from "@/utils";

import { programState } from "../constants";
import { useProgramBranch, usePrograms } from "../hooks/use-programs";
import { formatProgramClassification } from "../mappers/program.mapper";
import { buildProgramTree } from "../utils/program-hierarchy";
import { ProgramStatusBadge } from "./program-status-badge";

export interface ProgramDashboardScreenProps {
  /**
   * Recent academic activity, wired at the route.
   *
   * A slot rather than an import: the audit module owns the query and the
   * table. No `program.*` event is documented in the audit event map, so the
   * trail is the academic module's and may contain nothing from this one.
   */
  activityTrail?: React.ReactNode;
}

/**
 * Program overview for the active branch.
 *
 * The counts are stated carefully: each is a count of what
 * `GET /programs?branchId=` returned. The endpoint documents a soft delete and
 * no field marking one, so no tile claims to be a total.
 */
export function ProgramDashboardScreen({
  activityTrail,
}: ProgramDashboardScreenProps) {
  const branch = useProgramBranch();
  const { programs, isPending, error, refetch } = usePrograms(
    branch?.id ?? null,
  );

  const { roots } = useMemo(() => buildProgramTree(programs), [programs]);

  if (!branch) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Programs"
          description="The academic classification inside a branch."
        />
        <EmptyState
          icon={School}
          title="No active branch"
          description="Programs belong to a branch, and every read is scoped to one by a required parameter. Choose a branch to continue."
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.workspace.root}>Change workspace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const active = programs.filter(
    (program) => programState(program) === "active",
  ).length;
  const inactive = programs.filter(
    (program) => programState(program) === "inactive",
  ).length;
  const recent = programs.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programs"
        description={`How ${branch.name} organises students and curriculum — its verticals, their grouping and their status.`}
        actions={
          <>
            <GuideHelpTrigger guideId="programs" />
            <Button asChild variant="outline">
              <Link href={ROUTES.app.programs.directory}>View directory</Link>
            </Button>
            <Button asChild data-guide="program-dashboard-create-link">
              <Link href={ROUTES.app.programs.create}>
                <Plus />
                New program
              </Link>
            </Button>
          </>
        }
      />

      {error ? <ApiErrorState error={error} onRetry={() => refetch()} /> : null}

      {!error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Blocks}
              label="Listed"
              value={isPending ? "—" : formatNumber(programs.length)}
              hint="Returned for this branch"
              isLoading={isPending}
            />
            <StatCard
              icon={CircleCheckBig}
              label="Active"
              value={isPending ? "—" : formatNumber(active)}
              hint="Reporting an active flag"
              isLoading={isPending}
            />
            <StatCard
              icon={Power}
              label="Inactive"
              value={isPending ? "—" : formatNumber(inactive)}
              hint="Among those returned"
              isLoading={isPending}
            />
            <StatCard
              icon={GraduationCap}
              label="Top level"
              value={isPending ? "—" : formatNumber(roots.length)}
              hint="Programs with no parent"
              isLoading={isPending}
            />
          </div>

          <p className="text-muted-foreground text-sm">
            These count the branch&apos;s live programs — deleted programs are
            excluded.
          </p>
          <BackendPendingNote>
            enrolled-student and academic-unit counts per program have no
            documented endpoint.
          </BackendPendingNote>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <LinkCard
                icon={Plus}
                title="New program"
                description="Name, classification and an optional parent."
                href={ROUTES.app.programs.create}
              />
              <LinkCard
                icon={Blocks}
                title="Hierarchy"
                description="How this branch's programs are grouped."
                href={ROUTES.app.programs.tree}
              />
              <LinkCard
                icon={GraduationCap}
                title="Academic units"
                description="The operational structure inside these programs."
                href={ROUTES.app.academicUnits.root}
              />
              <LinkCard
                icon={School}
                title="Branch"
                description="The campus these programs belong to."
                href={ROUTES.app.branches.detail(branch.id)}
              />
            </CardContent>
          </Card>

          {!isPending && programs.length === 0 ? (
            <Banner
              tone="info"
              icon={Blocks}
              title="This branch has no programs"
              description="Academic units name a program in their request body, so the operational structure — classes, divisions, batches — cannot be built until at least one program exists."
              action={
                <Button asChild>
                  <Link href={ROUTES.app.programs.create}>
                    <Plus />
                    Create the first program
                  </Link>
                </Button>
              }
            />
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center justify-between gap-2">
                Programs
                <Button asChild variant="ghost" size="sm">
                  <Link href={ROUTES.app.programs.directory}>View all</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {isPending ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : recent.length === 0 ? (
                <EmptyState
                  icon={Blocks}
                  title="No programs yet"
                  description="Create the first one to get started."
                  className="min-h-32"
                  action={
                    <Button asChild>
                      <Link href={ROUTES.app.programs.create}>
                        <Plus />
                        Create program
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-border divide-y">
                  {recent.map((program) => (
                    <li key={program.id}>
                      <Link
                        href={ROUTES.app.programs.detail(program.id)}
                        className="hover:bg-muted/60 focus-visible:ring-ring -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 focus-visible:ring-3 focus-visible:outline-none"
                      >
                        <span
                          aria-hidden="true"
                          className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg"
                        >
                          <Blocks className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {program.name}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {formatProgramClassification(program) ??
                              "No medium or stream declared"}
                          </span>
                        </span>
                        <ProgramStatusBadge program={program} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {activityTrail ? (
        <section className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">
            Recent academic activity
          </h2>
          <p className="text-muted-foreground text-sm">
            Program changes are recorded under the <code>ACADEMIC</code> module,
            alongside academic years and units. A status change appears as an
            update.
          </p>
          {activityTrail}
        </section>
      ) : null}
    </div>
  );
}
