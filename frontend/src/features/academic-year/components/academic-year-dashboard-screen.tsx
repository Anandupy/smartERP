"use client";

import Link from "next/link";

import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  CircleCheckBig,
  Lock,
  Plus,
  School,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { LinkCard, StatCard } from "@/shared/components/data-display";
import {
  ApiErrorState,
  BackendPendingNote,
  Banner,
  EmptyState,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatNumber } from "@/utils";

import { academicYearState } from "../constants";
import {
  useAcademicYearBranch,
  useAcademicYears,
  useCurrentAcademicYear,
} from "../hooks/use-academic-years";
import { formatAcademicYearRange } from "../mappers/academic-year.mapper";
import { academicYearProgress } from "../utils/academic-year-timeline";
import { AcademicYearProgressBar } from "./academic-year-progress";
import { AcademicYearStatusBadge } from "./academic-year-status-badge";
import { AcademicYearTimeline } from "./academic-year-timeline-view";

export interface AcademicYearDashboardScreenProps {
  /**
   * Recent academic-year activity, wired at the route.
   *
   * A slot rather than an import: the audit module owns the query and the
   * table. Academic year events are recorded under the `ACADEMIC` audit module,
   * so the trail is real rather than a placeholder.
   */
  activityTrail?: React.ReactNode;
}

/**
 * Academic year overview for the active branch.
 *
 * The counts are stated carefully. Every figure is a count of what
 * `GET /academic-years?branchId=` returned — the documentation does not say
 * whether soft-deleted years are excluded and there is no `isDeleted` field to
 * check, so no tile claims to be a total.
 *
 * The three headline tiles are the three documented flags, and they are
 * deliberately **not** presented as one funnel: a year can be current and
 * locked at the same time, so the numbers legitimately overlap and the hints
 * say so rather than leaving a reader to subtract them.
 */
export function AcademicYearDashboardScreen({
  activityTrail,
}: AcademicYearDashboardScreenProps) {
  const branch = useAcademicYearBranch();
  const { academicYears, isPending, error, refetch } = useAcademicYears(
    branch?.id ?? null,
  );
  const { currentYear, isPending: isCurrentPending } = useCurrentAcademicYear(
    branch?.id ?? null,
  );

  if (!branch) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Academic Years"
          description="The administrative timeframes a branch operates in."
        />
        <EmptyState
          icon={School}
          title="No active branch"
          description="Academic years belong to a branch, and every read is scoped to one by a required parameter. Choose a branch to continue."
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.workspace.root}>Change workspace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const active = academicYears.filter((year) => year.isActive === true).length;
  const locked = academicYears.filter((year) => year.isLocked === true).length;
  const selected = academicYears.filter(
    (year) => year.isSelected === true,
  ).length;

  const current = currentYear ?? null;
  const currentProgress = current ? academicYearProgress(current) : null;
  const recent = academicYears.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Years"
        description={`The administrative timeframes ${branch.name} operates in — their span, status and progress.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.academicYears.directory}>
                View directory
              </Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.academicYears.create}>
                <Plus />
                New academic year
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
              icon={CalendarDays}
              label="Listed"
              value={isPending ? "—" : formatNumber(academicYears.length)}
              hint="Returned for this branch"
              isLoading={isPending}
            />
            <StatCard
              icon={CircleCheckBig}
              label="Active"
              value={isPending ? "—" : formatNumber(active)}
              hint="Open for data entry"
              isLoading={isPending}
            />
            <StatCard
              icon={CalendarCheck}
              label="Current"
              value={isPending ? "—" : formatNumber(selected)}
              hint="One per branch is the documented rule"
              isLoading={isPending}
            />
            <StatCard
              icon={Lock}
              label="Locked"
              value={isPending ? "—" : formatNumber(locked)}
              hint="Frozen against further change"
              isLoading={isPending}
            />
          </div>

          <BackendPendingNote>
            these count what the branch&apos;s list endpoint returned. No{" "}
            <code>isDeleted</code> field is documented, so whether soft-deleted
            years are included is unknown and no figure here is a total. A year
            can be current <em>and</em> locked, so the tiles overlap by design.
          </BackendPendingNote>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck aria-hidden="true" className="size-4" />
                  Current academic year
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {isCurrentPending ? (
                  <p className="text-muted-foreground text-sm">Loading…</p>
                ) : current ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={ROUTES.app.academicYears.detail(current.id)}
                        className="text-foreground text-base font-medium underline-offset-4 hover:underline"
                      >
                        {current.name}
                      </Link>
                      <AcademicYearStatusBadge year={current} />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {formatAcademicYearRange(current) ??
                        "The date range was not reported."}
                    </p>
                    {currentProgress ? (
                      <AcademicYearProgressBar progress={currentProgress} />
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                      This branch has no selected year.
                    </p>
                    <p className="text-muted-foreground text-sm">
                      The first year created for a branch is selected
                      automatically; after that, a year becomes current only
                      when someone selects it.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
                <LinkCard
                  icon={Plus}
                  title="New academic year"
                  description="Define a name and a date range."
                  href={ROUTES.app.academicYears.create}
                />
                <LinkCard
                  icon={CalendarRange}
                  title="Calendar & timeline"
                  description="Every year of this branch on one axis."
                  href={ROUTES.app.academicYears.calendar}
                />
                <LinkCard
                  icon={CalendarDays}
                  title="Directory"
                  description="Search, filter and manage every year."
                  href={ROUTES.app.academicYears.directory}
                />
                <LinkCard
                  icon={School}
                  title="Branch settings"
                  description="The campus these years belong to."
                  href={ROUTES.app.branches.detail(branch.id)}
                />
              </CardContent>
            </Card>
          </div>

          {!isPending && academicYears.length > 0 ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange aria-hidden="true" className="size-4" />
                  Timeline overview
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <AcademicYearTimeline academicYears={academicYears} />
              </CardContent>
            </Card>
          ) : null}

          {!isPending && academicYears.length === 0 ? (
            <Banner
              tone="info"
              icon={CalendarDays}
              title="This branch has no academic years"
              description="Nothing scoped to a year — attendance, marks, fees, admissions or academic units — can be recorded until one exists. The first one created is activated and selected automatically."
              action={
                <Button asChild>
                  <Link href={ROUTES.app.academicYears.create}>
                    <Plus />
                    Create the first year
                  </Link>
                </Button>
              }
            />
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center justify-between gap-2">
                Academic years
                <Button asChild variant="ghost" size="sm">
                  <Link href={ROUTES.app.academicYears.directory}>
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
                  icon={CalendarDays}
                  title="No academic years yet"
                  description="Create the first one to get started."
                  className="min-h-32"
                  action={
                    <Button asChild>
                      <Link href={ROUTES.app.academicYears.create}>
                        <Plus />
                        Create academic year
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-border divide-y">
                  {recent.map((year) => {
                    const state = academicYearState(year);
                    return (
                      <li key={year.id}>
                        <Link
                          href={ROUTES.app.academicYears.detail(year.id)}
                          className="hover:bg-muted/60 focus-visible:ring-ring -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 focus-visible:ring-3 focus-visible:outline-none"
                        >
                          <span
                            aria-hidden="true"
                            className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg"
                          >
                            {state === "locked" ? (
                              <Lock className="size-4" />
                            ) : state === "selected" ? (
                              <CalendarCheck className="size-4" />
                            ) : (
                              <CalendarDays className="size-4" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {year.name}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {formatAcademicYearRange(year) ??
                                "Dates not reported"}
                            </span>
                          </span>
                          <AcademicYearStatusBadge year={year} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {activityTrail ? (
        <section className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">
            Recent academic year activity
          </h2>
          {activityTrail}
        </section>
      ) : null}
    </div>
  );
}
