"use client";

import { useMemo } from "react";

import type {
  WorkspaceContextValue,
  WorkspaceEntity,
  WorkspaceOptions,
} from "./types";
import { optionsFor } from "./workspace-policy";
import { useWorkspaceStore } from "./workspace-store";

const EMPTY_OPTIONS: WorkspaceOptions = {
  organizations: [],
  branches: [],
  academicYears: [],
};

function byId<T extends WorkspaceEntity>(
  entities: readonly T[],
  id: string | null,
): T | null {
  if (id === null) return null;
  return entities.find((entity) => entity.id === id) ?? null;
}

/**
 * The active workspace, resolved into entities.
 *
 * The one hook every future module calls:
 *
 * ```ts
 * const { organization, branch, academicYear } = useWorkspace();
 * ```
 *
 * It reads the store rather than a React context, so it works anywhere under
 * the app — including in modules mounted outside `WorkspaceProvider` during
 * tests — and never re-fetches: identity is loaded once by the workspace
 * feature and published here.
 *
 * `select` and `confirm` are no-ops until availability exists, so calling this
 * before sign-in is safe rather than a crash.
 */
export function useWorkspace(): WorkspaceContextValue {
  const availability = useWorkspaceStore((state) => state.availability);
  const selection = useWorkspaceStore((state) => state.selection);
  const status = useWorkspaceStore((state) => state.status);
  const reason = useWorkspaceStore((state) => state.reason);
  const select = useWorkspaceStore((state) => state.select);
  const confirm = useWorkspaceStore((state) => state.confirm);
  const clear = useWorkspaceStore((state) => state.clear);

  return useMemo(() => {
    const options = availability
      ? optionsFor(availability, selection)
      : EMPTY_OPTIONS;

    return {
      status,
      reason,
      selection,
      options,
      organization: byId(options.organizations, selection.organizationId),
      branch: byId(options.branches, selection.branchId),
      academicYear: byId(options.academicYears, selection.academicYearId),
      isReady: status === "ready",
      requiresSelection: status === "selecting",
      select,
      confirm,
      clear,
    };
  }, [availability, selection, status, reason, select, confirm, clear]);
}
