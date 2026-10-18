"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ArrowLeftRight,
  GraduationCap,
  Plus,
  TriangleAlert,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { TreeView } from "@/shared/components/data";
import {
  BackendPendingNote,
  Banner,
  EmptyState,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import type { AcademicUnitScope } from "../api/academic-unit.service";
import {
  useAcademicUnitTree,
  useAcademicUnits,
  useMoveAcademicUnit,
} from "../hooks/use-academic-units";
import { formatUnitIdentity } from "../mappers/academic-unit.mapper";
import type { AcademicUnitDto } from "../types/academic-unit.dto";
import { buildAcademicUnitTree } from "../utils/academic-unit-hierarchy";
import { MoveAcademicUnitDialog } from "./academic-unit-dialogs";
import { AcademicUnitScopeGate } from "./academic-unit-scope-gate";
import { AcademicUnitStatusBadge } from "./academic-unit-status-badge";

export interface AcademicUnitTreeScreenProps {
  /** Program names by id, wired at the route. */
  programNames?: ReadonlyMap<string, string>;
}

/** One unit as it appears in the tree. */
function UnitNode({
  unit,
  onMove,
}: {
  unit: AcademicUnitDto;
  onMove: (unit: AcademicUnitDto) => void;
}) {
  const identity = formatUnitIdentity(unit);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={ROUTES.app.academicUnits.detail(unit.id)}
        className="hover:bg-muted/60 focus-visible:ring-ring flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 focus-visible:ring-3 focus-visible:outline-none"
      >
        <span className="text-foreground truncate text-sm font-medium">
          {unit.name}
        </span>
        {identity ? (
          <span className="text-muted-foreground truncate text-xs">
            {identity}
          </span>
        ) : null}
        <AcademicUnitStatusBadge unit={unit} className="ml-auto" />
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${unit.name}`}
        onClick={() => onMove(unit)}
      >
        <ArrowLeftRight />
      </Button>
    </div>
  );
}

/** The tree, once the scope is resolved. */
function Tree({
  scope,
  programNames,
}: {
  scope: AcademicUnitScope;
  programNames?: ReadonlyMap<string, string>;
}) {
  const { units, isPending, error, refetch } = useAcademicUnits(scope);
  const treeQuery = useAcademicUnitTree(scope);
  const move = useMoveAcademicUnit(scope);
  const [pendingMove, setPendingMove] = useState<AcademicUnitDto | null>(null);

  const { roots, orphans, cyclic } = useMemo(
    () => buildAcademicUnitTree(units),
    [units],
  );

  /** How many distinct programs the scope's units belong to. */
  const programCount = useMemo(
    () => new Set(units.map((unit) => unit.programId)).size,
    [units],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Unit Hierarchy"
        description="Departments, classes, divisions and batches for the active branch and academic year, at any depth."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.academicUnits.directory}>Directory</Link>
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

      {cyclic.length > 0 ? (
        <Banner
          tone="danger"
          icon={TriangleAlert}
          title="Some units form a circular parent chain"
          description={`${cyclic.length} could not be placed without looping. The documentation states that self-parenting and circular references are actively prevented, so this indicates malformed data rather than a normal state.`}
        />
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <GraduationCap aria-hidden="true" className="size-4" />
              Structure
            </span>
            <span className="text-muted-foreground text-xs font-normal">
              {roots.length} top-level · {units.length} total · {programCount}{" "}
              {programCount === 1 ? "program" : "programs"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <TreeView
            caption="Academic unit hierarchy"
            roots={roots}
            isLoading={isPending}
            error={error}
            onRetry={() => refetch()}
            renderNode={(unit) => (
              <UnitNode unit={unit} onMove={setPendingMove} />
            )}
            emptyState={
              <EmptyState
                icon={GraduationCap}
                title="No academic units yet"
                description="This branch and academic year have no structure defined. Units are scoped to one year, so a new year starts empty by design."
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.academicUnits.create}>
                      <Plus />
                      Create unit
                    </Link>
                  </Button>
                }
              />
            }
          />
        </CardContent>
      </Card>

      {orphans.length > 0 ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Not placed in the hierarchy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <p className="text-muted-foreground text-sm">
              These units name a parent that this scope&apos;s list does not
              contain. They are shown here rather than promoted to the top
              level, which would misrepresent where they sit.
            </p>
            <ul className="divide-border divide-y">
              {orphans.map((unit) => (
                <li key={unit.id} className="py-2">
                  <Link
                    href={ROUTES.app.academicUnits.detail(unit.id)}
                    className="text-primary text-sm underline-offset-4 hover:underline"
                  >
                    {unit.name}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    Parent <code>{unit.parentId}</code> was not returned
                    {programNames?.get(unit.programId)
                      ? ` — program ${programNames.get(unit.programId)}`
                      : ""}
                    .
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-sm">
              The list excludes deleted units, so a missing parent has most
              likely been deleted.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <BackendPendingNote>
        this hierarchy is built in the browser from each unit&apos;s{" "}
        <code>parentId</code>.{" "}
        {treeQuery.isUnrecognized
          ? "The documented GET /academic-units/tree endpoint returned a shape this app does not recognise — it has no documented response body — so nothing here depends on it."
          : "A GET /academic-units/tree endpoint is documented, but with no response body, so it is not relied on."}
      </BackendPendingNote>

      <MoveAcademicUnitDialog
        unit={pendingMove}
        units={units}
        isPending={move.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingMove(null);
        }}
        onConfirm={async (unit, parentId) => {
          await move.mutateAsync({ id: unit.id, body: { parentId } });
          setPendingMove(null);
        }}
      />
    </div>
  );
}

/**
 * The academic unit hierarchy for the active branch and academic year.
 *
 * The module's primary screen, because the documentation's whole premise is
 * structural: "the hierarchy is fully dynamic… supports unlimited depth", and
 * a flat list of "Div A, Div B, FYIT, Batch A" is close to meaningless without
 * showing what sits under what.
 *
 * As with Programs, the hierarchy is built from the **flat list** rather than
 * from `GET /academic-units/tree` — that endpoint has no documented response
 * body, so depending on its shape would be a guess. It is still called and read
 * defensively, and its readability becomes a note rather than a failure.
 */
export function AcademicUnitTreeScreen({
  programNames,
}: AcademicUnitTreeScreenProps) {
  return (
    <AcademicUnitScopeGate>
      {(scope) => <Tree scope={scope} programNames={programNames} />}
    </AcademicUnitScopeGate>
  );
}
