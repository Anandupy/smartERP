"use client";

import Link from "next/link";

import { GraduationCap } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { isApiError } from "@/core/api";
import {
  ApiErrorState,
  EmptyState,
  ForbiddenState,
  FormSkeleton,
} from "@/shared/components/feedback";

import type { AcademicUnitScope } from "../api/academic-unit.service";
import { useAcademicUnit } from "../hooks/use-academic-units";
import type { AcademicUnitDto } from "../types/academic-unit.dto";
import { AcademicUnitScopeGate } from "./academic-unit-scope-gate";

export interface AcademicUnitBoundaryProps {
  id: string;
  /** Rendered only once the unit exists and the scope is resolved. */
  children: (unit: AcademicUnitDto, scope: AcademicUnitScope) => React.ReactNode;
  /** Skeleton shape while loading. Forms want fields; detail wants a panel. */
  fallback?: React.ReactNode;
}

/** The fetch, once the scope is known. */
function Fetch({
  id,
  scope,
  children,
  fallback,
}: {
  id: string;
  scope: AcademicUnitScope;
  children: (unit: AcademicUnitDto, scope: AcademicUnitScope) => React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const query = useAcademicUnit(id);

  if (query.isPending) {
    return <>{fallback ?? <FormSkeleton fields={5} label="Loading academic unit" />}</>;
  }

  if (query.error) {
    if (isApiError(query.error)) {
      if (query.error.kind === "notFound") {
        return (
          <EmptyState
            icon={GraduationCap}
            title="Academic unit not found"
            description="It may have been deleted — the documentation describes soft deletes but no field that marks one. It may also belong to a different academic year than the one currently selected."
            action={
              <Button asChild variant="outline">
                <Link href={ROUTES.app.academicUnits.tree}>
                  Back to hierarchy
                </Link>
              </Button>
            }
          />
        );
      }
      if (query.error.kind === "forbidden") {
        return (
          <ForbiddenState description="Your role does not have access to this branch's academic structure." />
        );
      }
    }
    return <ApiErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  return <>{children(query.data, scope)}</>;
}

/**
 * The states of "we need one academic unit", handled once.
 *
 * Composes the scope gate with the fetch, because both are always needed
 * together: `GET /academic-units/:id` is documented and takes no query
 * parameters, but every screen *around* one unit — the parent picker, the
 * children list, the delete rule — reads the scope's full list, and that needs
 * both scope ids.
 *
 * The not-found copy names the academic year as a possible cause, which is
 * specific to this module: a unit id is perfectly valid in one year's scope and
 * absent from another's, so "deleted" is not the only explanation.
 */
export function AcademicUnitBoundary({
  id,
  children,
  fallback,
}: AcademicUnitBoundaryProps) {
  return (
    <AcademicUnitScopeGate>
      {(scope) => (
        <Fetch id={id} scope={scope} fallback={fallback}>
          {children}
        </Fetch>
      )}
    </AcademicUnitScopeGate>
  );
}
