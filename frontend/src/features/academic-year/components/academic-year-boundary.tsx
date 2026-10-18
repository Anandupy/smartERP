"use client";

import Link from "next/link";

import { CalendarDays, School } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { isApiError } from "@/core/api";
import {
  ApiErrorState,
  EmptyState,
  ForbiddenState,
  FormSkeleton,
} from "@/shared/components/feedback";

import {
  useAcademicYear,
  useAcademicYearBranch,
} from "../hooks/use-academic-years";
import type { AcademicYearDto } from "../types/academic-year.dto";

export interface AcademicYearBoundaryProps {
  id: string;
  /** Rendered only once the year has been found. */
  children: (year: AcademicYearDto, branchId: string) => React.ReactNode;
  /** Skeleton shape while loading. Forms want fields; detail wants a panel. */
  fallback?: React.ReactNode;
}

/**
 * The states of "we need one academic year", handled once.
 *
 * Details, edit and lifecycle all need the same record and the same answers, so
 * they are resolved here and each screen receives a year guaranteed to exist —
 * the pattern `BranchBoundary` and `OrganizationBoundary` established.
 *
 * This boundary has one state the others do not: **no active branch**. Every
 * academic-year read is scoped to a branch by a documented required parameter,
 * so without one there is nothing to look in. That is a workspace problem
 * rather than a failure, and it reads as one.
 *
 * The record is read with `GET /academic-years/:id`; a 404 — absent or
 * soft-deleted — is the "not found" state.
 */
export function AcademicYearBoundary({
  id,
  children,
  fallback,
}: AcademicYearBoundaryProps) {
  const branch = useAcademicYearBranch();
  const {
    data: academicYear,
    isPending,
    error,
    refetch,
  } = useAcademicYear(id, branch?.id ?? null);

  if (!branch) {
    return (
      <EmptyState
        icon={School}
        title="No active branch"
        description="Academic years belong to a branch, and every read is scoped to one. Choose a branch to continue."
        action={
          <Button asChild variant="outline">
            <Link href={ROUTES.workspace.root}>Change workspace</Link>
          </Button>
        }
      />
    );
  }

  if (isPending) {
    return (
      <>
        {fallback ?? <FormSkeleton fields={4} label="Loading academic year" />}
      </>
    );
  }

  if (error) {
    if (isApiError(error) && error.kind === "notFound") {
      return <NotFound />;
    }
    if (isApiError(error) && error.kind === "forbidden") {
      return (
        <ForbiddenState description="Your role does not have access to this branch's academic years." />
      );
    }
    return <ApiErrorState error={error} onRetry={() => refetch()} />;
  }

  if (!academicYear) return <NotFound />;

  return <>{children(academicYear, academicYear.branchId ?? branch.id)}</>;
}

function NotFound() {
  return (
    <EmptyState
      icon={CalendarDays}
      title="Academic year not found"
      description="No academic year with this id exists, or it has been deleted."
      action={
        <Button asChild variant="outline">
          <Link href={ROUTES.app.academicYears.directory}>
            Back to directory
          </Link>
        </Button>
      }
    />
  );
}
