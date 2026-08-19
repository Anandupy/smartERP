"use client";

import Link from "next/link";

import { FileText } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { isApiError } from "@/core/api";
import {
  ApiErrorState,
  EmptyState,
  ForbiddenState,
  FormSkeleton,
} from "@/shared/components/feedback";

import { useApplicant, useApplicantScope } from "../hooks/use-applicants";
import type { ApplicantDto } from "../types/applicant.dto";

export interface ApplicantBoundaryProps {
  id: string;
  /** Rendered only once the applicant has been found. */
  children: (applicant: ApplicantDto) => React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * The states of "we need one applicant", handled once — the pattern
 * `BranchBoundary` and `AcademicYearBoundary` established.
 *
 * Applicant is scoped to **both** a branch and an academic year
 * (`useApplicantScope`), one level tighter than most boundaries in this
 * codebase, so the missing-scope state names both.
 */
export function ApplicantBoundary({
  id,
  children,
  fallback,
}: ApplicantBoundaryProps) {
  const scope = useApplicantScope();
  const { data: applicant, isPending, error, refetch } = useApplicant(id);

  if (!scope) {
    return (
      <EmptyState
        icon={FileText}
        title="No active branch or academic year"
        description="Applications belong to one branch and one academic year, and every read is scoped to both. Choose a workspace to continue."
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
      <>{fallback ?? <FormSkeleton fields={6} label="Loading application" />}</>
    );
  }

  if (error) {
    if (isApiError(error) && error.kind === "forbidden") {
      return (
        <ForbiddenState description="Your role does not have access to this application." />
      );
    }
    if (isApiError(error) && error.kind === "notFound") {
      return (
        <EmptyState
          icon={FileText}
          title="Application not found"
          description="No application with this id exists in the active branch and academic year."
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.app.admissions.applicants.directory}>
                Back to applicants
              </Link>
            </Button>
          }
        />
      );
    }
    return <ApiErrorState error={error} onRetry={() => refetch()} />;
  }

  if (!applicant) return null;

  return <>{children(applicant)}</>;
}
