"use client";

import Link from "next/link";

import {
  CalendarRange,
  CircleDot,
  Lock,
  Pencil,
  Power,
  School,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import {
  DescriptionList,
  StatusBadge,
  type DescriptionItem,
} from "@/shared/components/data-display";
import { BackendPendingNote, Banner } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";
import { useWorkspace } from "@/core/workspace";
import { formatDate, formatDateTime } from "@/utils";

import {
  ACADEMIC_YEAR_STATE_PRESENTATION,
  FLAG_PRESENTATION,
  academicYearState,
  readFlag,
} from "../constants";
import { formatAcademicYearRange } from "../mappers/academic-year.mapper";
import type { AcademicYearDto } from "../types/academic-year.dto";
import { editBlockedReason } from "../utils/academic-year-lifecycle";
import { academicYearProgress } from "../utils/academic-year-timeline";
import { AcademicYearBoundary } from "./academic-year-boundary";
import { AcademicYearProgressBar } from "./academic-year-progress";
import { AcademicYearStatusBadge } from "./academic-year-status-badge";

export interface AcademicYearDetailsScreenProps {
  id: string;
  /** Activity trail for this year, wired at the route. */
  activityTrail?: React.ReactNode;
}

/** One documented flag, reported honestly including when it is absent. */
function FlagRow({
  label,
  value,
  meaning,
}: {
  label: string;
  value: boolean | null | undefined;
  meaning: string;
}) {
  const flag = readFlag(value);
  const presentation = FLAG_PRESENTATION[flag];

  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-foreground text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-sm">{meaning}</p>
      </div>
      <StatusBadge tone={presentation.tone} className="shrink-0">
        {presentation.label}
      </StatusBadge>
    </div>
  );
}

/** The record itself, once resolved. */
function Details({
  year,
  activityTrail,
}: {
  year: AcademicYearDto;
  activityTrail?: React.ReactNode;
}) {
  const state = academicYearState(year);
  const progress = academicYearProgress(year);
  const range = formatAcademicYearRange(year);
  const cannotEdit = editBlockedReason(year);

  const basics: DescriptionItem[] = [
    { key: "name", label: "Name", value: year.name },
    {
      key: "start",
      label: "Start date",
      value: formatDate(year.startDate) || "—",
    },
    { key: "end", label: "End date", value: formatDate(year.endDate) || "—" },
    {
      key: "duration",
      label: "Duration",
      value: progress.totalDays !== null ? `${progress.totalDays} days` : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={year.name}
        badge={<AcademicYearStatusBadge year={year} withIcon />}
        description={range ?? "The date range was not reported."}
        actions={
          <>
            <Button
              asChild
              variant="outline"
              data-guide="academic-year-details-lifecycle-link"
            >
              <Link href={ROUTES.app.academicYears.lifecycle(year.id)}>
                <Power />
                Lifecycle
              </Link>
            </Button>
            {cannotEdit ? (
              <Button variant="outline" disabled title={cannotEdit}>
                <Lock />
                Locked
              </Button>
            ) : (
              <Button asChild>
                <Link href={ROUTES.app.academicYears.edit(year.id)}>
                  <Pencil />
                  Edit
                </Link>
              </Button>
            )}
          </>
        }
      />

      {state === "locked" ? (
        <Banner
          tone="warning"
          icon={Lock}
          title="This academic year is locked"
          description="A locked year cannot be edited or deleted, and the API has no endpoint that unlocks one. It can still be activated or set as the current year."
        />
      ) : null}

      {state === "unknown" ? (
        <Banner
          tone="warning"
          icon={CircleDot}
          title="No status was reported"
          description="None of the three state flags came back with this record. No response body is documented for any academic-year endpoint, so the flags may genuinely be absent — they are shown as “Not reported” rather than assumed false."
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <CalendarRange aria-hidden="true" className="size-4" />
              Basic information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList items={basics} columns={2} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <AcademicYearProgressBar progress={progress} withDates />
            <BackendPendingNote>
              this is computed from the documented start and end dates. Terms,
              semesters, holidays and exam windows have no field and no
              endpoint.
            </BackendPendingNote>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Status flags</CardTitle>
          </CardHeader>
          <CardContent className="divide-border divide-y pt-0">
            <FlagRow
              label="Active"
              value={year.isActive}
              meaning="Valid and available for data entry."
            />
            <FlagRow
              label="Current"
              value={year.isSelected}
              meaning="The branch's working year. Only one can hold this at a time."
            />
            <FlagRow
              label="Locked"
              value={year.isLocked}
              meaning="Frozen against modification and deletion."
            />
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
                  value: <OwningBranch branchId={year.branchId} />,
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Current status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <AcademicYearStatusBadge year={year} withIcon />
          <p className="text-muted-foreground text-sm">
            {ACADEMIC_YEAR_STATE_PRESENTATION[state].description}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={ROUTES.app.academicYears.lifecycle(year.id)}>
              Manage lifecycle
            </Link>
          </Button>
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
                label: "Academic year id",
                value: <code>{year.id}</code>,
                wide: true,
              },
              {
                key: "createdAt",
                label: "Created",
                value: year.createdAt ? formatDateTime(year.createdAt) : "—",
              },
              {
                key: "updatedAt",
                label: "Last updated",
                value: year.updatedAt ? formatDateTime(year.updatedAt) : "—",
              },
            ]}
          />
          <p className="text-muted-foreground text-xs">
            Who made each change is recorded in the audit trail below.
          </p>
        </CardContent>
      </Card>

      {activityTrail ? (
        <section className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">
            Audit trail &amp; activity
          </h2>
          {activityTrail}
        </section>
      ) : null}
    </div>
  );
}

/**
 * One academic year in full.
 *
 * Every panel is built from a documented field. The design also shows enrolled
 * students, classes, exam schedules and a term breakdown for the year; none of
 * those is in the academic year contract, and no year-scoped endpoint is
 * documented in another module either, so each is omitted or named as pending.
 *
 * The three flags get a panel of their own and are reported **individually**
 * rather than collapsed into the header badge. The badge has to pick one label,
 * and a year that is both current and locked would otherwise show only
 * "Locked" — losing the fact that the whole branch is still writing into it.
 */
export function AcademicYearDetailsScreen({
  id,
  activityTrail,
}: AcademicYearDetailsScreenProps) {
  return (
    <AcademicYearBoundary id={id}>
      {(year) => <Details year={year} activityTrail={activityTrail} />}
    </AcademicYearBoundary>
  );
}

/**
 * The year's branch by name. A year carries only `branchId`; the name is
 * taken from the active workspace branch when it is that branch, which is the
 * only branch this screen can be reached from. Otherwise the id is shown —
 * never a guessed name.
 */
function OwningBranch({ branchId }: { branchId: string }) {
  const { branch } = useWorkspace();
  const name = branch?.id === branchId ? branch.name : null;

  return (
    <Link
      href={ROUTES.app.branches.detail(branchId)}
      className="text-primary underline-offset-4 hover:underline"
    >
      {name ?? <code>{branchId}</code>}
    </Link>
  );
}
