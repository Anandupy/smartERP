"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";
import { useWorkspace } from "@/core/workspace";

import { academicUnitKeys } from "../api/academic-unit.keys";
import {
  academicUnitService,
  type AcademicUnitScope,
} from "../api/academic-unit.service";
import {
  ANY_PROGRAM,
  ANY_STATE,
  ANY_TYPE,
  academicUnitState,
} from "../constants";
import type {
  AcademicUnitDto,
  CreateAcademicUnitRequest,
  MoveAcademicUnitRequest,
  UpdateAcademicUnitRequest,
} from "../types/academic-unit.dto";
import { readAcademicUnitTree } from "../utils/read-academic-unit-tree";

/**
 * The branch **and** academic year every unit request is scoped to.
 *
 * This is the first module that needs two levels of workspace scope at once:
 * both `branchId` and `academicYearId` are documented `(Required)` on the list
 * and tree endpoints, and every request in the collection carries both scope
 * headers. `useWorkspace()` is the only place the app may learn either.
 *
 * Returns `null` unless the scope is `ready` **and both ids are present** —
 * which is the honest gate. A branch without a selected academic year cannot
 * have its structure listed at all, and the screens say which half is missing
 * rather than rendering an empty tree.
 */
export function useAcademicUnitScope(): AcademicUnitScope | null {
  const { branch, academicYear, isReady } = useWorkspace();

  return useMemo(() => {
    if (!isReady || !branch || !academicYear) return null;
    return { branchId: branch.id, academicYearId: academicYear.id };
  }, [isReady, branch, academicYear]);
}

/**
 * Every academic unit in the active branch-and-year.
 *
 * Ordering is left to the tree builder, which applies the documented
 * `displayOrder` per sibling group — a flat sort by `displayOrder` would be
 * meaningless across levels, since two units at different depths may
 * legitimately share one.
 */
export function useAcademicUnits(scope: AcademicUnitScope | null) {
  const query = useQuery({
    queryKey: academicUnitKeys.listByScope(
      scope ?? { branchId: "", academicYearId: "" },
    ),
    queryFn: () =>
      academicUnitService.list(scope ?? { branchId: "", academicYearId: "" }),
    enabled: scope !== null,
    meta: { skipErrorToast: true },
  });

  const units = useMemo(() => query.data ?? [], [query.data]);

  return { ...query, units };
}

/**
 * The nested form of the same units — `GET /academic-units/tree`.
 *
 * Wired because it is documented, and read **defensively** because its response
 * is not: the endpoint is a Postman entry with an empty body, no nesting key
 * and no stated envelope. `readAcademicUnitTree` accepts the plausible shapes
 * and reports `isUnrecognized` otherwise.
 *
 * Callers fall back to building the hierarchy from the flat list, which needs
 * only `parentId` — a documented request field. So this query failing to parse
 * costs a marker, never the screen.
 */
export function useAcademicUnitTree(scope: AcademicUnitScope | null) {
  const query = useQuery({
    queryKey: academicUnitKeys.tree(
      scope ?? { branchId: "", academicYearId: "" },
    ),
    queryFn: () =>
      academicUnitService.tree(scope ?? { branchId: "", academicYearId: "" }),
    enabled: scope !== null,
    meta: { skipErrorToast: true },
  });

  const reading = useMemo(
    () =>
      query.data === undefined
        ? { units: [], isUnrecognized: false }
        : readAcademicUnitTree(query.data),
    [query.data],
  );

  return { ...query, ...reading };
}

/** One academic unit by id. A documented endpoint, unlike Academic Year's. */
export function useAcademicUnit(id: string) {
  return useQuery({
    queryKey: academicUnitKeys.detail(id),
    queryFn: () => academicUnitService.get(id),
    enabled: Boolean(id),
    meta: { skipErrorToast: true },
  });
}

export interface AcademicUnitFilters {
  search: string;
  state: string;
  unitType: string;
  programId: string;
}

/**
 * Narrow the loaded units **in the client**.
 *
 * The only query parameters either read endpoint documents are `branchId` and
 * `academicYearId`, and both identify the scope rather than narrowing the
 * result — there is no `programId` filter, no `page`, no `search`, no
 * `sortBy`. Notably **`programId` is a required field on every unit and is not
 * a documented filter**, so narrowing by program has to happen here.
 */
export function filterAcademicUnits(
  units: readonly AcademicUnitDto[],
  filters: AcademicUnitFilters,
): AcademicUnitDto[] {
  const needle = filters.search.trim().toLowerCase();

  return units.filter((unit) => {
    if (filters.state !== ANY_STATE && academicUnitState(unit) !== filters.state) {
      return false;
    }

    if (filters.unitType !== ANY_TYPE && (unit.unitType ?? "") !== filters.unitType) {
      return false;
    }

    if (filters.programId !== ANY_PROGRAM && unit.programId !== filters.programId) {
      return false;
    }

    if (needle.length === 0) return true;

    return [unit.name, unit.code, unit.unitType]
      .filter((field): field is string => typeof field === "string")
      .some((field) => field.toLowerCase().includes(needle));
  });
}

/** Everything a write should refresh: the scope's list and its tree. */
function scopeKeys(scope: AcademicUnitScope) {
  return [
    academicUnitKeys.listByScope(scope),
    academicUnitKeys.tree(scope),
  ];
}

/** Create an academic unit. */
export function useCreateAcademicUnit(scope: AcademicUnitScope | null) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: CreateAcademicUnitRequest) =>
      academicUnitService.create(body),
    onSuccess: async (unit: AcademicUnitDto, body) => {
      // Keyed off the request rather than the response: no response body is
      // documented, so the scope may not come back on the created record.
      await invalidateKeys(
        queryClient,
        scopeKeys(
          scope ?? {
            branchId: body.branchId,
            academicYearId: body.academicYearId,
          },
        ),
      );
      toast.success(`${unit?.name ?? body.name} created`);
    },
  });
}

/** Update an academic unit. The body is always complete — see the mapper. */
export function useUpdateAcademicUnit(
  id: string,
  scope: AcademicUnitScope | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: UpdateAcademicUnitRequest) =>
      academicUnitService.update(id, body),
    onSuccess: async (unit: AcademicUnitDto, body) => {
      if (unit) queryClient.setQueryData(academicUnitKeys.detail(id), unit);
      await invalidateKeys(queryClient, [
        ...scopeKeys(
          scope ?? {
            branchId: body.branchId,
            academicYearId: body.academicYearId,
          },
        ),
        academicUnitKeys.detail(id),
      ]);
      toast.success("Academic unit updated");
    },
  });
}

/**
 * Re-parent a unit — `PATCH /academic-units/:id/move`.
 *
 * The only lifecycle endpoint across both academic modules that carries a
 * **request body**, so it names a target rather than flipping a flag and is
 * therefore idempotent — safe to confirm, fire and retry.
 *
 * No optimistic update all the same: a move re-computes `level` across the
 * whole subtree on the server, and showing a re-parented branch of the tree
 * before the server has agreed would misreport where a class's sections sit.
 */
export function useMoveAcademicUnit(scope: AcademicUnitScope | null) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: ({ id, body }: { id: string; body: MoveAcademicUnitRequest }) =>
      academicUnitService.move(id, body),
    onSuccess: async (_unit, { id }) => {
      await invalidateKeys(queryClient, [
        ...(scope ? scopeKeys(scope) : []),
        academicUnitKeys.detail(id),
      ]);
      toast.success("Academic unit moved");
    },
  });
}

/**
 * Toggle a unit's active flag.
 *
 * **Deliberately no optimistic update and no retry.** The endpoint takes no
 * body, so it flips whatever `isActive` currently is rather than setting a
 * requested value — non-idempotent, and treated exactly as the branch and
 * program toggles are.
 */
export function useToggleAcademicUnitStatus(scope: AcademicUnitScope | null) {
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    meta: { skipErrorToast: true },
    mutationFn: (id: string) => academicUnitService.toggleStatus(id),
    onSuccess: async (_unit, id) => {
      await invalidateKeys(queryClient, [
        ...(scope ? scopeKeys(scope) : []),
        academicUnitKeys.detail(id),
      ]);
      toast.success("Academic unit status updated");
    },
  });
}

/**
 * Delete a unit — the documented soft delete.
 *
 * No optimistic removal: the engine refuses the call while the unit has active
 * children, so a node disappearing from the tree before the server has agreed
 * would misreport an operation that is genuinely conditional.
 */
export function useDeleteAcademicUnit(scope: AcademicUnitScope | null) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (id: string) => academicUnitService.remove(id),
    onSuccess: async (_result, id) => {
      await invalidateKeys(queryClient, [
        ...(scope ? scopeKeys(scope) : []),
        academicUnitKeys.detail(id),
      ]);
      toast.success("Academic unit deleted");
    },
  });
}
