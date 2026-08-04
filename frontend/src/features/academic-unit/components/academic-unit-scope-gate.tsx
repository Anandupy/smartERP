"use client";

import Link from "next/link";

import { CalendarDays, School } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { useWorkspace } from "@/core/workspace";
import { EmptyState } from "@/shared/components/feedback";

import type { AcademicUnitScope } from "../api/academic-unit.service";
import { useAcademicUnitScope } from "../hooks/use-academic-units";

export interface AcademicUnitScopeGateProps {
  /** Rendered only once both scope ids are available. */
  children: (scope: AcademicUnitScope) => React.ReactNode;
}

/**
 * "We need a branch *and* an academic year", answered once.
 *
 * Every other module so far has needed one level of workspace scope. This is
 * the first that needs two: `branchId` and `academicYearId` are both documented
 * `(Required)` on the list and tree endpoints, and every request in the
 * collection carries both scope headers.
 *
 * That makes "no scope" two different problems with two different fixes, and
 * the gate says **which half is missing** rather than showing one generic
 * message. A branch with no selected academic year is the more likely of the
 * two and the one with a non-obvious remedy — the fix is in the Academic Year
 * module, not the workspace switcher — so it links there.
 */
export function AcademicUnitScopeGate({ children }: AcademicUnitScopeGateProps) {
  const scope = useAcademicUnitScope();
  const { branch, academicYear } = useWorkspace();

  if (!scope) {
    if (!branch) {
      return (
        <EmptyState
          icon={School}
          title="No active branch"
          description="Academic units are scoped to a branch and an academic year. Both list endpoints require a branch id, and no endpoint lists units across branches."
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.workspace.root}>Change workspace</Link>
            </Button>
          }
        />
      );
    }

    if (!academicYear) {
      return (
        <EmptyState
          icon={CalendarDays}
          title="No academic year selected"
          description={`${branch.name} has no active academic year in this workspace. Academic units belong to one year — the whole point of the module is that structures change between years — so the list endpoint requires one.`}
          action={
            <>
              <Button asChild>
                <Link href={ROUTES.app.academicYears.root}>
                  Manage academic years
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={ROUTES.workspace.root}>Change workspace</Link>
              </Button>
            </>
          }
        />
      );
    }

    return (
      <EmptyState
        icon={School}
        title="Workspace scope is incomplete"
        description="Academic units need both a branch and an academic year before they can be listed."
        action={
          <Button asChild variant="outline">
            <Link href={ROUTES.workspace.root}>Change workspace</Link>
          </Button>
        }
      />
    );
  }

  return <>{children(scope)}</>;
}
