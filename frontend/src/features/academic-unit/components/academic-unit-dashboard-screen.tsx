"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  Blocks,
  CalendarDays,
  CircleCheckBig,
  GraduationCap,
  Layers,
  Plus,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { useWorkspace } from "@/core/workspace";
import { LinkCard, StatCard } from "@/shared/components/data-display";
import {
  ApiErrorState,
  BackendPendingNote,
  Banner,
  EmptyState,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatNumber } from "@/utils";

import type { AcademicUnitScope } from "../api/academic-unit.service";
import { academicUnitState } from "../constants";
import { useAcademicUnits } from "../hooks/use-academic-units";
import { formatUnitIdentity } from "../mappers/academic-unit.mapper";
import { buildAcademicUnitTree } from "../utils/academic-unit-hierarchy";
import { AcademicUnitScopeGate } from "./academic-unit-scope-gate";
import { AcademicUnitStatusBadge } from "./academic-unit-status-badge";

export interface AcademicUnitDashboardScreenProps {
  /** Recent academic activity, wired at the route. */
  activityTrail?: React.ReactNode;
}

/** Depth of the deepest branch of a tree. */
function maxDepth<T>(
  nodes: readonly { children: readonly T[] }[],
  depth = 1,
): number {
  let deepest = nodes.length > 0 ? depth : 0;
  for (const node of nodes) {
    const childDepth = maxDepth(
      node.children as readonly { children: readonly T[] }[],
      depth + 1,
    );
    if (childDepth > deepest) deepest = childDepth;
  }
  return deepest;
}

/** The overview, once the scope is resolved. */
function Dashboard({
  scope,
  activityTrail,
}: {
  scope: AcademicUnitScope;
  activityTrail?: React.ReactNode;
}) {
  const { branch, academicYear } = useWorkspace();
  const { units, isPending, error, refetch } = useAcademicUnits(scope);

  const { roots } = useMemo(() => buildAcademicUnitTree(units), [units]);

  const active = units.filter(
    (unit) => academicUnitState(unit) === "active",
  ).length;
  const programCount = useMemo(
    () => new Set(units.map((unit) => unit.programId)).size,
    [units],
  );
  const depth = useMemo(() => maxDepth(roots), [roots]);
  const recent = units.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Units"
        description={`The operational structure of ${branch?.name ?? "this branch"} for ${academicYear?.name ?? "the active year"} — departments, classes, divisions and batches.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.academicUnits.tree}>View hierarchy</Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.academicUnits.create}>
                <Plus />
                New unit
              </Link>
            </Button>
          </>
        }
      />

      <Banner
        tone="info"
        icon={CalendarDays}
        title={`Scoped to ${academicYear?.name ?? "the active academic year"}`}
        description="Academic units belong to one year by design — the documentation's premise is that sections and batches split and merge with enrolment, so each year holds its own structure. Switching the workspace year shows a different one."
      />

      {error ? <ApiErrorState error={error} onRetry={() => refetch()} /> : null}

      {!error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={GraduationCap}
              label="Listed"
              value={isPending ? "—" : formatNumber(units.length)}
              hint="Returned for this branch and year"
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
              icon={Blocks}
              label="Programs covered"
              value={isPending ? "—" : formatNumber(programCount)}
              hint="Distinct programs among these units"
              isLoading={isPending}
            />
            <StatCard
              icon={Layers}
              label="Depth"
              value={isPending ? "—" : formatNumber(depth)}
              hint="Deepest level in the hierarchy"
              isLoading={isPending}
            />
          </div>

          <BackendPendingNote>
            these count what the scope&apos;s list endpoint returned. The
            documentation describes soft deletes but no field marking one, so
            whether deleted units are included is unknown and no figure here is
            a total. Enrolled-student counts per unit have no documented
            endpoint.
          </BackendPendingNote>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <LinkCard
                icon={Plus}
                title="New unit"
                description="Place a class, division or batch in the structure."
                href={ROUTES.app.academicUnits.create}
              />
              <LinkCard
                icon={GraduationCap}
                title="Hierarchy"
                description="The full structure, at any depth."
                href={ROUTES.app.academicUnits.tree}
              />
              <LinkCard
                icon={Blocks}
                title="Programs"
                description="The verticals these units hang from."
                href={ROUTES.app.programs.root}
              />
              <LinkCard
                icon={CalendarDays}
                title="Academic years"
                description="The year this structure belongs to."
                href={ROUTES.app.academicYears.root}
              />
            </CardContent>
          </Card>

          {!isPending && units.length === 0 ? (
            <Banner
              tone="info"
              icon={GraduationCap}
              title="No structure defined for this year"
              description="A unit names a branch, a program and an academic year, so at least one program must exist before the structure can be built."
              action={
                <Button asChild>
                  <Link href={ROUTES.app.academicUnits.create}>
                    <Plus />
                    Create the first unit
                  </Link>
                </Button>
              }
            />
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center justify-between gap-2">
                Academic units
                <Button asChild variant="ghost" size="sm">
                  <Link href={ROUTES.app.academicUnits.directory}>
                    View all
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {isPending ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : recent.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title="No academic units yet"
                  description="Create the first one to get started."
                  className="min-h-32"
                  action={
                    <Button asChild>
                      <Link href={ROUTES.app.academicUnits.create}>
                        <Plus />
                        Create unit
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-border divide-y">
                  {recent.map((unit) => (
                    <li key={unit.id}>
                      <Link
                        href={ROUTES.app.academicUnits.detail(unit.id)}
                        className="hover:bg-muted/60 focus-visible:ring-ring -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 focus-visible:ring-3 focus-visible:outline-none"
                      >
                        <span
                          aria-hidden="true"
                          className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg"
                        >
                          <GraduationCap className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {unit.name}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {formatUnitIdentity(unit) ?? "No type or code"}
                          </span>
                        </span>
                        <AcademicUnitStatusBadge unit={unit} />
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
          <BackendPendingNote>
            the audit event map documents <code>academic_unit.created</code>,{" "}
            <code>.updated</code> and <code>.deleted</code>, but no event for
            the move or status endpoints — so re-parenting or deactivating a
            unit will not appear below.
          </BackendPendingNote>
          {activityTrail}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Academic unit overview for the active branch and academic year.
 *
 * The banner naming the year is load-bearing rather than decorative: the whole
 * module is scoped to one academic year, and a user who does not notice which
 * one would read an empty structure as data loss rather than as a new year that
 * has not been set up yet.
 */
export function AcademicUnitDashboardScreen({
  activityTrail,
}: AcademicUnitDashboardScreenProps) {
  return (
    <AcademicUnitScopeGate>
      {(scope) => <Dashboard scope={scope} activityTrail={activityTrail} />}
    </AcademicUnitScopeGate>
  );
}
