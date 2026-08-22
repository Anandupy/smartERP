"use client";

import { FileText } from "@/assets/icons";
import { isApiError } from "@/core/api";
import {
  ApiErrorState,
  EmptyState,
  ForbiddenState,
  FormSkeleton,
} from "@/shared/components/feedback";

import { useDocumentType } from "../hooks/use-documents";
import type { DocumentTypeDto } from "../types/document.dto";

export interface DocumentTypeBoundaryProps {
  id: string;
  children: (type: DocumentTypeDto) => React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * The states of "we need one document type", handled once — detail and edit
 * need the same answers (loading, not found, forbidden, failed, loaded), the
 * pattern `AdmissionMasterBoundary` established.
 */
export function DocumentTypeBoundary({
  id,
  children,
  fallback,
}: DocumentTypeBoundaryProps) {
  const query = useDocumentType(id);

  if (query.isPending) {
    return (
      <>{fallback ?? <FormSkeleton fields={6} label="Loading document type" />}</>
    );
  }

  if (query.error) {
    if (isApiError(query.error)) {
      if (query.error.kind === "notFound") {
        return (
          <EmptyState
            icon={FileText}
            title="Document type not found"
            description="It may have been deleted."
          />
        );
      }
      if (query.error.kind === "forbidden") {
        return (
          <ForbiddenState description="Your role does not have access to this document type." />
        );
      }
    }
    return <ApiErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  return <>{children(query.data)}</>;
}
