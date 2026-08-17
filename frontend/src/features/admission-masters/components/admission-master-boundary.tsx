"use client";

import { isApiError } from "@/core/api";
import {
  ApiErrorState,
  EmptyState,
  ForbiddenState,
  FormSkeleton,
} from "@/shared/components/feedback";

import type { AdmissionMasterConfig } from "../config/admission-master-registry";
import type { AdmissionMasterType } from "../config/admission-master-registry";
import { useAdmissionMaster } from "../hooks/use-admission-masters";
import type { AdmissionMasterDto } from "../types/admission-master.dto";

export interface AdmissionMasterBoundaryProps {
  masterType: AdmissionMasterType;
  config: AdmissionMasterConfig;
  id: string;
  /** Rendered only once the record exists. */
  children: (master: AdmissionMasterDto) => React.ReactNode;
  /** Skeleton shape while loading. Forms want fields; detail wants a panel. */
  fallback?: React.ReactNode;
}

/**
 * The states of "we need one record", handled once — detail and edit need the
 * same answers (loading, not found, forbidden, failed, loaded), the pattern
 * `BranchBoundary` established.
 *
 * A `404` reads as ordinary rather than alarming: `DELETE` is a documented
 * soft delete, so a link to a since-deleted record is a normal thing to hold.
 */
export function AdmissionMasterBoundary({
  masterType,
  config,
  id,
  children,
  fallback,
}: AdmissionMasterBoundaryProps) {
  const query = useAdmissionMaster(masterType, id);

  if (query.isPending) {
    return (
      <>
        {fallback ?? (
          <FormSkeleton
            fields={5}
            label={`Loading ${config.singularLabel.toLowerCase()}`}
          />
        )}
      </>
    );
  }

  if (query.error) {
    if (isApiError(query.error)) {
      if (query.error.kind === "notFound") {
        return (
          <EmptyState
            icon={config.icon}
            title={`${config.singularLabel} not found`}
            description="It may have been deleted — the API documents no restore endpoint."
          />
        );
      }
      if (query.error.kind === "forbidden") {
        return (
          <ForbiddenState description={`Your role does not have access to this ${config.singularLabel.toLowerCase()}.`} />
        );
      }
    }
    return (
      <ApiErrorState error={query.error} onRetry={() => query.refetch()} />
    );
  }

  return <>{children(query.data)}</>;
}
