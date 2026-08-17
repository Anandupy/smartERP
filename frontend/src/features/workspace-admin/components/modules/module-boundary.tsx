"use client";

import { Blocks } from "@/assets/icons";
import { isApiError } from "@/core/api";
import {
  ApiErrorState,
  EmptyState,
  ForbiddenState,
  FormSkeleton,
} from "@/shared/components/feedback";

import { useModule } from "../../hooks/use-modules";
import type { ModuleDetailDto } from "../../types/module.dto";

export interface ModuleBoundaryProps {
  id: string;
  children: (module: ModuleDetailDto) => React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * The states of "we need one module," handled once — details and edit both
 * need the same record and the same answers.
 *
 * A `403` reads as the documented `SUPER_ADMIN` + `settings.manage` guard
 * doing its job, not as a fault.
 */
export function ModuleBoundary({ id, children, fallback }: ModuleBoundaryProps) {
  const query = useModule(id);

  if (query.isPending) {
    return <>{fallback ?? <FormSkeleton fields={4} label="Loading module" />}</>;
  }

  if (query.error) {
    if (isApiError(query.error)) {
      if (query.error.kind === "notFound") {
        return (
          <EmptyState
            icon={Blocks}
            title="Module not found"
            description="It may have been deleted."
          />
        );
      }
      if (query.error.kind === "forbidden") {
        return (
          <ForbiddenState description="Your role does not have access to navigation administration." />
        );
      }
    }
    return <ApiErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  return <>{children(query.data)}</>;
}
