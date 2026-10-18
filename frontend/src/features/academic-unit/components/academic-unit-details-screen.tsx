"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  ArrowLeftRight,
  Blocks,
  CalendarDays,
  GraduationCap,
  Layers,
  Pencil,
  Power,
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
import { ancestorPath, formatDateTime } from "@/utils";

import type { AcademicUnitScope } from "../api/academic-unit.service";
import { UNIT_STATE_PRESENTATION, academicUnitState } from "../constants";
import {
  useAcademicUnits,
  useDeleteAcademicUnit,
  useMoveAcademicUnit,
  useToggleAcademicUnitStatus,
} from "../hooks/use-academic-units";
import { formatUnitIdentity } from "../mappers/academic-unit.mapper";
import type { AcademicUnitDto } from "../types/academic-unit.dto";
import {
  academicUnitAccessors,
  childrenOf,
  deleteBlockedReason,
} from "../utils/academic-unit-hierarchy";
import { AcademicUnitBoundary } from "./academic-unit-boundary";
import {
  DeleteAcademicUnitDialog,
  MoveAcademicUnitDialog,
  ToggleAcademicUnitStatusDialog,
} from "./academic-unit-dialogs";
import { AcademicUnitStatusBadge } from "./academic-unit-status-badge";

export interface AcademicUnitDetailsScreenProps {
  id: string;
  /**
   * Program names by id, wired at the route.
   *
   * The whole map rather than one name, because the key is the loaded unit's
   * `programId` — which only this screen knows.
   */
  programNames?: ReadonlyMap<string, string>;
  /** Activity trail for this unit, wired at the route. */
  activityTrail?: React.ReactNode;
}

/** The record itself, once loaded. */
function Details({
  unit,
  scope,
  programNames,
  activityTrail,
}: {
  unit: AcademicUnitDto;
  scope: AcademicUnitScope;
  programNames?: ReadonlyMap<string, string>;
  activityTrail?: React.ReactNode;
}) {
  const router = useRouter();
  const { units } = useAcademicUnits(scope);
  const move = useMoveAcademicUnit(scope);
  const toggleStatus = useToggleAcademicUnitStatus(scope);
  const deleteUnit = useDeleteAcademicUnit(scope);
  const [isDeletingOpen, setIsDeletingOpen] = useState(false);
  const [isTogglingOpen, setIsTogglingOpen] = useState(false);
  const [isMovingOpen, setIsMovingOpen] = useState(false);

  const state = academicUnitState(unit);
  const children = useMemo(() => childrenOf(units, unit.id), [units, unit.id]);
  const path = useMemo(
    () => ancestorPath(units, academicUnitAccessors, unit.id),
    [units, unit.id],
  );
  const blockedReason = deleteBlockedReason(units, unit.id);
  const identity = formatUnitIdentity(unit);
  const programName = programNames?.get(unit.programId);
  const metadataEntries = Object.entries(unit.metadata ?? {});

  const overview: DescriptionItem[] = [
    { key: "name", label: "Name", value: unit.name },
    { key: "code", label: "Code", value: unit.code || "—" },
    { key: "type", label: "Unit type", value: unit.unitType || "—" },
    {
      key: "order",
      label: "Display order",
      value: typeof unit.displayOrder === "number" ? unit.displayOrder : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={unit.name}
        badge={<AcademicUnitStatusBadge unit={unit} withIcon />}
        description={identity ?? "No type or code declared."}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              data-guide="academic-unit-details-move-button"
              onClick={() => setIsMovingOpen(true)}
            >
              <ArrowLeftRight />
              Move
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.academicUnits.edit(unit.id)}>
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
          description="No response body is documented for these endpoints, so the active flag may be absent. The status control is withheld: the toggle flips the current value rather than setting a requested one."
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap aria-hidden="true" className="size-4" />
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DescriptionList items={overview} columns={2} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Layers aria-hidden="true" className="size-4" />
              Position in the hierarchy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {path.length > 1 ? (
              <nav aria-label="Unit ancestry">
                <ol className="flex flex-wrap items-center gap-1 text-sm">
                  {path.map((ancestor, index) => (
                    <li key={ancestor.id} className="flex items-center gap-1">
                      {index > 0 ? (
                        <span
                          aria-hidden="true"
                          className="text-muted-foreground"
                        >
                          /
                        </span>
                      ) : null}
                      {ancestor.id === unit.id ? (
                        <span className="text-foreground font-medium">
                          {ancestor.name}
                        </span>
                      ) : (
                        <Link
                          href={ROUTES.app.academicUnits.detail(ancestor.id)}
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
                This unit sits at the top of its program&apos;s structure — it
                declares no parent.
              </p>
            )}

            <DescriptionList
              columns={1}
              items={[
                {
                  key: "level",
                  label: "Level",
                  value:
                    typeof unit.level === "number"
                      ? unit.level
                      : `${path.length - 1} (derived)`,
                },
              ]}
            />

            <div className="space-y-1">
              <p className="text-foreground text-sm font-medium">
                {`Child units (${children.length})`}
              </p>
              {children.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No units name this one as their parent.
                </p>
              ) : (
                <ul className="space-y-1">
                  {children.map((child) => (
                    <li key={child.id} className="flex items-center gap-2">
                      <Link
                        href={ROUTES.app.academicUnits.detail(child.id)}
                        className="text-primary truncate text-sm underline-offset-4 hover:underline"
                      >
                        {child.name}
                      </Link>
                      <AcademicUnitStatusBadge unit={child} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <BackendPendingNote>
              <code>level</code> is documented as server-computed and is never
              sent. When the response omits it, the depth shown is derived from
              the hierarchy this browser built.
            </BackendPendingNote>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Blocks aria-hidden="true" className="size-4" />
              Scope
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <DescriptionList
              columns={1}
              items={[
                {
                  key: "program",
                  label: "Program",
                  value: (
                    <Link
                      href={ROUTES.app.programs.detail(unit.programId)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {programName ?? <code>{unit.programId}</code>}
                    </Link>
                  ),
                },
                {
                  key: "year",
                  label: "Academic year",
                  value: (
                    <Link
                      href={ROUTES.app.academicYears.detail(
                        unit.academicYearId,
                      )}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      <code>{unit.academicYearId}</code>
                    </Link>
                  ),
                },
                {
                  key: "branch",
                  label: "Branch",
                  value: (
                    <Link
                      href={ROUTES.app.branches.detail(unit.branchId)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      <code>{unit.branchId}</code>
                    </Link>
                  ),
                },
              ]}
            />
            <BackendPendingNote>
              only ids are returned with a unit — showing the program, year and
              branch names would need them expanded in the response, and no
              response body is documented.
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
            <AcademicUnitStatusBadge unit={unit} withIcon />
            <p className="text-muted-foreground text-sm">
              {UNIT_STATE_PRESENTATION[state].description}
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
                ? "Deactivate unit"
                : state === "inactive"
                  ? "Activate unit"
                  : "Unavailable"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {metadataEntries.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No metadata is set on this unit.
            </p>
          ) : (
            <DescriptionList
              columns={2}
              items={metadataEntries.map(([key, value]) => ({
                key,
                label: key,
                value: (
                  <code className="break-all">
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </code>
                ),
              }))}
            />
          )}
          <BackendPendingNote>
            the documentation describes this as a free-form field for attributes
            that need no strict schema, and names no keys — so whatever the
            record carries is shown verbatim, and nothing here interprets a key.
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
              <p className="text-sm font-medium">Delete academic unit</p>
              <p className="text-muted-foreground text-sm">
                {blockedReason ??
                  "The documented soft delete. The record is retained, but attendance, marks and enrolment are recorded against academic units."}
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              className="shrink-0"
              disabled={blockedReason !== null || deleteUnit.isPending}
              onClick={() => setIsDeletingOpen(true)}
            >
              <Trash2 />
              Delete unit
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays aria-hidden="true" className="size-4" />
            Record metadata
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <DescriptionList
            columns={2}
            items={[
              {
                key: "id",
                label: "Academic unit id",
                value: <code>{unit.id}</code>,
                wide: true,
              },
              {
                key: "created",
                label: "Created",
                value: unit.createdAt ? formatDateTime(unit.createdAt) : "—",
              },
              {
                key: "updated",
                label: "Last updated",
                value: unit.updatedAt ? formatDateTime(unit.updatedAt) : "—",
              },
            ]}
          />
          <p className="text-muted-foreground text-sm">
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

      <DeleteAcademicUnitDialog
        unit={isDeletingOpen ? unit : null}
        blockedReason={blockedReason}
        isPending={deleteUnit.isPending}
        onOpenChange={(open) => {
          if (!open) setIsDeletingOpen(false);
        }}
        onConfirm={async () => {
          await deleteUnit.mutateAsync(unit.id);
          setIsDeletingOpen(false);
          router.push(ROUTES.app.academicUnits.tree);
        }}
      />

      <ToggleAcademicUnitStatusDialog
        unit={isTogglingOpen ? unit : null}
        isPending={toggleStatus.isPending}
        onOpenChange={(open) => {
          if (!open) setIsTogglingOpen(false);
        }}
        onConfirm={async () => {
          await toggleStatus.mutateAsync(unit.id);
          setIsTogglingOpen(false);
        }}
      />

      <MoveAcademicUnitDialog
        unit={isMovingOpen ? unit : null}
        units={units}
        isPending={move.isPending}
        onOpenChange={(open) => {
          if (!open) setIsMovingOpen(false);
        }}
        onConfirm={async (target, parentId) => {
          await move.mutateAsync({ id: target.id, body: { parentId } });
          setIsMovingOpen(false);
        }}
      />
    </div>
  );
}

/**
 * One academic unit in full.
 *
 * Every panel is built from a documented field. The design also shows enrolled
 * students, a timetable and subject allocation per unit; none is in the
 * academic unit contract, and no unit-scoped endpoint is documented in another
 * module either, so each is omitted.
 *
 * The hierarchy panel is the module's own contribution: ancestry, children and
 * the derived level all come from the scope's list via the shared helpers,
 * which is the only way to show them — no endpoint returns a unit's relatives.
 */
export function AcademicUnitDetailsScreen({
  id,
  programNames,
  activityTrail,
}: AcademicUnitDetailsScreenProps) {
  return (
    <AcademicUnitBoundary id={id}>
      {(unit, scope) => (
        <Details
          unit={unit}
          scope={scope}
          programNames={programNames}
          activityTrail={activityTrail}
        />
      )}
    </AcademicUnitBoundary>
  );
}
