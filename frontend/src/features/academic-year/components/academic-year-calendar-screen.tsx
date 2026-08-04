"use client";

import Link from "next/link";

import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Plus,
  School,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { StatCard } from "@/shared/components/data-display";
import {
  ApiErrorState,
  BackendPendingBadge,
  BackendPendingNote,
  EmptyState,
  PageSkeleton,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { formatDate, formatNumber } from "@/utils";

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

/**
 * Sections of an academic calendar the contract has no source for.
 *
 * Listed as data rather than prose so the gap is enumerable, and so this screen
 * and `docs/backend-gaps.md` cannot drift apart without it being obvious.
 */
const MISSING_CALENDAR_SECTIONS = [
  {
    label: "Terms & semesters",
    detail:
      "No field on the academic year, and no endpoint that divides one into parts.",
  },
  {
    label: "Holidays & non-instructional days",
    detail:
      "No holiday calendar exists anywhere in the module docs or the collection.",
  },
  {
    label: "Examination windows",
    detail:
      "The Examination module is not built, and no exam dates hang off an academic year.",
  },
  {
    label: "Admission & enrolment windows",
    detail:
      "Admissions records are scoped to an academic year, but no date windows are documented on it.",
  },
  {
    label: "Events & milestones",
    detail:
      "No events resource of any kind is documented for an academic year.",
  },
] as const;

/**
 * The academic calendar and timeline for the active branch.
 *
 * This screen sits at the boundary between what the contract supports and what
 * it does not, and it is built so the two never blur:
 *
 * - **The axis is real.** `startDate` and `endDate` are documented fields in
 *   both request bodies, so the span of every year, the elapsed fraction of the
 *   current one and the position of today are all computed from data.
 * - **The events are not.** Terms, holidays, exam windows and milestones have
 *   no field and no endpoint anywhere. They are enumerated by name with the
 *   shared Backend Pending components, and **not** rendered as a grid of empty
 *   day cells: a month view with nothing in it invites the reading "there is
 *   nothing scheduled", which is a claim this app cannot make.
 */
export function AcademicYearCalendarScreen() {
  const branch = useAcademicYearBranch();
  const { academicYears, isPending, error, refetch } = useAcademicYears(
    branch?.id ?? null,
  );
  const { currentYear } = useCurrentAcademicYear(branch?.id ?? null);

  if (!branch) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Academic Calendar"
          description="Every academic year of a branch on one axis."
        />
        <EmptyState
          icon={School}
          title="No active branch"
          description="The calendar is drawn from the academic years of one branch, and the list endpoint requires a branch id. Choose a branch to continue."
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.workspace.root}>Change workspace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const currentProgress = currentYear ? academicYearProgress(currentYear) : null;

  const spans = academicYears
    .map((year) => academicYearProgress(year))
    .filter((progress) => progress.totalDays !== null);
  const covered = spans.reduce(
    (total, progress) => total + (progress.totalDays ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Calendar"
        description={`Every academic year defined for ${branch.name}, plotted on a single axis.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.academicYears.directory}>Directory</Link>
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

      {isPending ? <PageSkeleton /> : null}

      {!error && !isPending ? (
        academicYears.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing to plot yet"
            description={`${branch.name} has no academic years, so there is no calendar to draw.`}
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
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                icon={CalendarDays}
                label="Years plotted"
                value={formatNumber(spans.length)}
                hint={`of ${formatNumber(academicYears.length)} listed`}
              />
              <StatCard
                icon={CalendarRange}
                label="Days covered"
                value={formatNumber(covered)}
                hint="Summed across every placeable year"
              />
              <StatCard
                icon={CalendarCheck}
                label="Current year"
                value={currentYear?.name ?? "None"}
                valueClassName="text-lg"
                hint={
                  currentYear
                    ? (formatAcademicYearRange(currentYear) ?? "Dates not reported")
                    : "No year is selected for this branch"
                }
              />
            </div>

            {currentYear && currentProgress ? (
              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <CalendarCheck aria-hidden="true" className="size-4" />
                    {currentYear.name}
                    <AcademicYearStatusBadge year={currentYear} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <AcademicYearProgressBar
                    progress={currentProgress}
                    withDates
                  />
                  {currentProgress.startDate && currentProgress.endDate ? (
                    <p className="text-muted-foreground text-sm">
                      Runs from {formatDate(currentProgress.startDate)} to{" "}
                      {formatDate(currentProgress.endDate)}.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange aria-hidden="true" className="size-4" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <AcademicYearTimeline academicYears={academicYears} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  Calendar events
                  <BackendPendingBadge />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <p className="text-muted-foreground text-sm">
                  An academic year is defined by a name and two dates, and
                  nothing else. Every section below would need a field or an
                  endpoint that the module documentation and the Postman
                  collection do not contain.
                </p>

                <ul className="divide-border divide-y">
                  {MISSING_CALENDAR_SECTIONS.map((section) => (
                    <li key={section.label} className="py-3">
                      <p className="text-foreground text-sm font-medium">
                        {section.label}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {section.detail}
                      </p>
                    </li>
                  ))}
                </ul>

                <BackendPendingNote>
                  a month or week grid is deliberately not rendered. An empty
                  calendar reads as &ldquo;nothing is scheduled&rdquo;, and this
                  app has no endpoint that could tell it whether anything is.
                </BackendPendingNote>
              </CardContent>
            </Card>
          </>
        )
      ) : null}
    </div>
  );
}
