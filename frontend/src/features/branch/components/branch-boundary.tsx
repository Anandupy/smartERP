"use client";

import { School } from "@/assets/icons";
import { isApiError } from "@/core/api";
import {
  ApiErrorState,
  EmptyState,
  ForbiddenState,
  FormSkeleton,
} from "@/shared/components/feedback";

import { useBranch } from "../hooks/use-branches";
import type { BranchDto } from "../types/branch.dto";

export interface BranchBoundaryProps {
  id: string;
  /** Rendered only once the branch exists. */
  children: (branch: BranchDto) => React.ReactNode;
  /** Skeleton shape while loading. Forms want fields; detail wants a panel. */
  fallback?: React.ReactNode;
}

/**
 * The states of "we need one branch", handled once.
 *
 * Details, edit, lifecycle and every settings screen need the same record and
 * the same answers — loading, not found, forbidden, failed, loaded — so they
 * are resolved here and each screen receives a `branch` guaranteed to exist.
 * The pattern `SettingsBoundary` and `OrganizationBoundary` established.
 *
 * Two failures get their own treatment rather than the generic one. A `404` is
 * ordinary: the list endpoint returns active branches only, so a link to one
 * since deleted is a normal thing to hold. A `403` is the documented role
 * matrix doing its job — deletion is SUPER_ADMIN-only and updates are limited
 * to two roles — so it reads as a permission boundary, not as a fault.
 */
export function BranchBoundary({
  id,
  children,
  fallback,
}: BranchBoundaryProps) {
  const query = useBranch(id);

  if (query.isPending) {
    return (
      <>{fallback ?? <FormSkeleton fields={5} label="Loading branch" />}</>
    );
  }

  if (query.error) {
    if (isApiError(query.error)) {
      if (query.error.kind === "notFound") {
        return (
          <EmptyState
            icon={School}
            title="Branch not found"
            description="It may have been deleted — the directory lists active branches only."
          />
        );
      }
      if (query.error.kind === "forbidden") {
        return (
          <ForbiddenState description="Your role does not have access to this branch." />
        );
      }
    }
    return (
      <ApiErrorState error={query.error} onRetry={() => query.refetch()} />
    );
  }

  return <>{children(query.data)}</>;
}
