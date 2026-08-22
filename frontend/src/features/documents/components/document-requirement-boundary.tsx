"use client";

import { FileCheck2 } from "@/assets/icons";
import { isApiError } from "@/core/api";
import {
  ApiErrorState,
  EmptyState,
  ForbiddenState,
  FormSkeleton,
} from "@/shared/components/feedback";

import { useDocumentRequirement } from "../hooks/use-documents";
import type { DocumentRequirementDto } from "../types/document.dto";

export interface DocumentRequirementBoundaryProps {
  id: string;
  children: (requirement: DocumentRequirementDto) => React.ReactNode;
  fallback?: React.ReactNode;
}

/** The states of "we need one document requirement", handled once. */
export function DocumentRequirementBoundary({
  id,
  children,
  fallback,
}: DocumentRequirementBoundaryProps) {
  const query = useDocumentRequirement(id);

  if (query.isPending) {
    return (
      <>{fallback ?? <FormSkeleton fields={5} label="Loading requirement" />}</>
    );
  }

  if (query.error) {
    if (isApiError(query.error)) {
      if (query.error.kind === "notFound") {
        return (
          <EmptyState
            icon={FileCheck2}
            title="Requirement not found"
            description="It may have been deleted."
          />
        );
      }
      if (query.error.kind === "forbidden") {
        return (
          <ForbiddenState description="Your role does not have access to this requirement." />
        );
      }
    }
    return <ApiErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  return <>{children(query.data)}</>;
}
