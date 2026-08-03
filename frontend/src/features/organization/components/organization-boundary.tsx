"use client";

import { Building2 } from "@/assets/icons";
import {
  ApiErrorState,
  EmptyState,
  FormSkeleton,
} from "@/shared/components/feedback";
import { isApiError } from "@/core/api";

import { useOrganization } from "../hooks/use-organizations";
import type { OrganizationDto } from "../types/organization.dto";

export interface OrganizationBoundaryProps {
  id: string;
  /** Rendered only once the organization exists. */
  children: (organization: OrganizationDto) => React.ReactNode;
  /** Skeleton shape while loading. Forms want fields; detail wants a panel. */
  fallback?: React.ReactNode;
}

/**
 * The four states of "we need one organization", handled once.
 *
 * Detail, edit and lifecycle all need the same record and the same four
 * answers — loading, not found, failed, loaded — so they are resolved here and
 * each screen receives an `organization` guaranteed to exist. Exactly the
 * arrangement `SettingsBoundary` uses, for the same reason: three screens
 * should not each re-decide what a 404 means.
 *
 * A `404` gets its own empty state rather than the generic error treatment.
 * The list endpoint is documented to return only active organizations, so a
 * link to one that has since been deactivated is an ordinary thing to hold —
 * not a failure worth an alarm.
 *
 * A render-prop rather than a context: the value is required, not optional, so
 * the type should say so at the call site.
 */
export function OrganizationBoundary({
  id,
  children,
  fallback,
}: OrganizationBoundaryProps) {
  const query = useOrganization(id);

  if (query.isPending) {
    return (
      <>
        {fallback ?? <FormSkeleton fields={5} label="Loading organization" />}
      </>
    );
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.kind === "notFound") {
      return (
        <EmptyState
          icon={Building2}
          title="Organization not found"
          description="It may have been deactivated — the directory lists active organizations only."
        />
      );
    }
    return (
      <ApiErrorState error={query.error} onRetry={() => query.refetch()} />
    );
  }

  return <>{children(query.data)}</>;
}
