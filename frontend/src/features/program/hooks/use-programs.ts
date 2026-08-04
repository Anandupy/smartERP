"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";
import { useWorkspace } from "@/core/workspace";

import { programKeys } from "../api/program.keys";
import { programService } from "../api/program.service";
import { ANY_LEVEL, ANY_STATE, programState } from "../constants";
import type {
  CreateProgramRequest,
  ProgramDto,
  UpdateProgramRequest,
} from "../types/program.dto";
import { readProgramTree } from "../utils/read-program-tree";

/**
 * The branch every program request is scoped to.
 *
 * `branchId` is documented `(Required)` on both list endpoints, and
 * `useWorkspace()` is the only place the app may learn the active branch. This
 * hook is the module's single point of contact with it, so no screen reads or
 * prop-drills it separately.
 *
 * Returns `null` until the workspace scope is `ready`, which gates every query
 * below: firing a read with an empty `branchId` would ask the server for the
 * programs of no branch.
 */
export function useProgramBranch() {
  const { branch, isReady } = useWorkspace();
  return isReady ? branch : null;
}

/**
 * Every program of the active branch.
 *
 * Sorted by name, because the endpoints document no `sortBy` and programs carry
 * no `displayOrder` — unlike academic units, which do. Ordering is therefore
 * the client's to choose and should at least be deterministic between renders.
 */
export function usePrograms(branchId: string | null) {
  const query = useQuery({
    queryKey: programKeys.listByBranch(branchId ?? ""),
    queryFn: () => programService.list(branchId ?? ""),
    enabled: Boolean(branchId),
    meta: { skipErrorToast: true },
  });

  const programs = useMemo(() => {
    if (!query.data) return [];
    return [...query.data].sort((a, b) => a.name.localeCompare(b.name));
  }, [query.data]);

  return { ...query, programs };
}

/**
 * The nested form of the same programs — `GET /programs/tree`.
 *
 * Wired because it is documented, and read **defensively** because its response
 * is not: the endpoint is one row in a table with no body, no nesting key and
 * no stated envelope. `readProgramTree` accepts the plausible shapes and
 * reports `isUnrecognized` otherwise.
 *
 * Callers are expected to fall back to building the hierarchy from the flat
 * list, which needs only `parentId` — a documented request field. So this query
 * failing to parse costs a marker, never the screen.
 */
export function useProgramTree(branchId: string | null) {
  const query = useQuery({
    queryKey: programKeys.tree(branchId ?? ""),
    queryFn: () => programService.tree(branchId ?? ""),
    enabled: Boolean(branchId),
    meta: { skipErrorToast: true },
  });

  const reading = useMemo(
    () =>
      query.data === undefined
        ? { programs: [], isUnrecognized: false }
        : readProgramTree(query.data),
    [query.data],
  );

  return { ...query, ...reading };
}

/** One program by id. */
export function useProgram(id: string) {
  return useQuery({
    queryKey: programKeys.detail(id),
    queryFn: () => programService.get(id),
    enabled: Boolean(id),
    meta: { skipErrorToast: true },
  });
}

export interface ProgramFilters {
  search: string;
  state: string;
  level: string;
}

/**
 * Narrow the loaded programs **in the client**.
 *
 * `branchId` is the only query parameter any program endpoint documents, and it
 * identifies the branch rather than narrowing the result — there is no `page`,
 * `limit`, `search`, `sortBy` or status filter to send. Rather than leave the
 * directory's controls dead, the whole collection is filtered here and the
 * screen states that it is doing so.
 */
export function filterPrograms(
  programs: readonly ProgramDto[],
  filters: ProgramFilters,
): ProgramDto[] {
  const needle = filters.search.trim().toLowerCase();

  return programs.filter((program) => {
    if (
      filters.state !== ANY_STATE &&
      programState(program) !== filters.state
    ) {
      return false;
    }

    if (filters.level !== ANY_LEVEL && (program.level ?? "") !== filters.level) {
      return false;
    }

    if (needle.length === 0) return true;

    return [program.name, program.level, program.medium, program.stream]
      .filter((field): field is string => typeof field === "string")
      .some((field) => field.toLowerCase().includes(needle));
  });
}

/** Everything a write should refresh: the branch's list and its tree. */
function scopeKeys(branchId: string) {
  return [programKeys.listByBranch(branchId), programKeys.tree(branchId)];
}

/** Create a program. */
export function useCreateProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: CreateProgramRequest) => programService.create(body),
    onSuccess: async (program: ProgramDto, body) => {
      // Keyed off the request rather than the response: no response body is
      // documented, so `program.branchId` may not come back, and invalidating
      // the wrong branch would leave the list the user is looking at stale.
      await invalidateKeys(queryClient, scopeKeys(body.branchId));
      toast.success(`${program?.name ?? body.name} created`);
    },
  });
}

/** Update a program. The body is always complete — see the mapper. */
export function useUpdateProgram(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: UpdateProgramRequest) => programService.update(id, body),
    onSuccess: async (program: ProgramDto, body) => {
      if (program) queryClient.setQueryData(programKeys.detail(id), program);
      await invalidateKeys(queryClient, [
        ...scopeKeys(body.branchId),
        programKeys.detail(id),
      ]);
      toast.success("Program updated");
    },
  });
}

/**
 * Toggle a program's active flag.
 *
 * **Deliberately no optimistic update and no retry.** The endpoint takes no
 * body, so it flips whatever `isActive` currently is rather than setting a
 * requested value — which makes it non-idempotent. A retried or replayed call
 * would silently undo itself, and an optimistic flip would show a state the
 * server may not have reached. The same treatment the branch status toggle
 * gets, for the same documented reason.
 */
export function useToggleProgramStatus(branchId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    meta: { skipErrorToast: true },
    mutationFn: (id: string) => programService.toggleStatus(id),
    onSuccess: async (_program, id) => {
      await invalidateKeys(queryClient, [
        ...scopeKeys(branchId ?? ""),
        programKeys.detail(id),
      ]);
      toast.success("Program status updated");
    },
  });
}

/**
 * Delete a program — the documented soft delete.
 *
 * No optimistic removal: documented rule 4 refuses the call while the program
 * has active children, so a row disappearing before the server has agreed would
 * misreport an operation that is genuinely conditional.
 */
export function useDeleteProgram(branchId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (id: string) => programService.remove(id),
    onSuccess: async (_result, id) => {
      await invalidateKeys(queryClient, [
        ...scopeKeys(branchId ?? ""),
        programKeys.detail(id),
      ]);
      toast.success("Program deleted");
    },
  });
}
