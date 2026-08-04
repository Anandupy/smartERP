"use client";

import Link from "next/link";

import { Blocks, School } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";
import { isApiError } from "@/core/api";
import {
  ApiErrorState,
  EmptyState,
  ForbiddenState,
  FormSkeleton,
} from "@/shared/components/feedback";

import { useProgram, useProgramBranch } from "../hooks/use-programs";
import type { ProgramDto } from "../types/program.dto";

export interface ProgramBoundaryProps {
  id: string;
  /** Rendered only once the program exists. */
  children: (program: ProgramDto, branchId: string) => React.ReactNode;
  /** Skeleton shape while loading. Forms want fields; detail wants a panel. */
  fallback?: React.ReactNode;
}

/**
 * The states of "we need one program", handled once.
 *
 * Details and edit need the same record and the same answers — no branch,
 * loading, not found, forbidden, failed, loaded — so they are resolved here and
 * each screen receives a program guaranteed to exist. The pattern
 * `BranchBoundary` and `AcademicYearBoundary` established.
 *
 * Unlike `AcademicYearBoundary`, this one **fetches**: `GET /programs/:id` is a
 * documented endpoint, so a 404 is a real answer from the server rather than an
 * absence from a list. The branch is still required, because the screens around
 * this one — the parent picker, the delete rule's child check — all read the
 * branch's full list.
 */
export function ProgramBoundary({
  id,
  children,
  fallback,
}: ProgramBoundaryProps) {
  const branch = useProgramBranch();
  const query = useProgram(id);

  if (!branch) {
    return (
      <EmptyState
        icon={School}
        title="No active branch"
        description="Programs belong to a branch, and every read is scoped to one. Choose a branch to continue."
        action={
          <Button asChild variant="outline">
            <Link href={ROUTES.workspace.root}>Change workspace</Link>
          </Button>
        }
      />
    );
  }

  if (query.isPending) {
    return <>{fallback ?? <FormSkeleton fields={5} label="Loading program" />}</>;
  }

  if (query.error) {
    if (isApiError(query.error)) {
      if (query.error.kind === "notFound") {
        return (
          <EmptyState
            icon={Blocks}
            title="Program not found"
            description="It may have been deleted — the API documents a soft delete but no field that marks one."
            action={
              <Button asChild variant="outline">
                <Link href={ROUTES.app.programs.directory}>
                  Back to directory
                </Link>
              </Button>
            }
          />
        );
      }
      if (query.error.kind === "forbidden") {
        return (
          <ForbiddenState description="Creating and changing programs is documented as ADMIN-only." />
        );
      }
    }
    return <ApiErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  return <>{children(query.data, branch.id)}</>;
}
