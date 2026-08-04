"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { isApiError } from "@/core/api";
import { invalidateKeys } from "@/core/query";
import { useWorkspace } from "@/core/workspace";

import { academicYearKeys } from "../api/academic-year.keys";
import { academicYearService } from "../api/academic-year.service";
import { ANY_STATE, academicYearState } from "../constants";
import type {
  AcademicYearDto,
  AcademicYearTransition,
  CreateAcademicYearRequest,
  UpdateAcademicYearRequest,
} from "../types/academic-year.dto";

/**
 * The branch every academic-year request is scoped to.
 *
 * `branchId` is a documented **required** query parameter on both read
 * endpoints, and `x-branch-id` is on every request in the collection. There is
 * exactly one place the app is allowed to learn the active branch from —
 * `useWorkspace()` — so this hook is the module's single point of contact with
 * it, and no screen reads or prop-drills it separately.
 *
 * Returns `null` until the workspace scope is `ready`, which is what gates
 * every query below: firing a read with an empty `branchId` would ask the
 * server for the academic years of no branch.
 */
export function useAcademicYearBranch() {
  const { branch, isReady } = useWorkspace();
  return isReady ? branch : null;
}

/**
 * Every academic year of the active branch.
 *
 * Sorted by start date, most recent first: the endpoint documents no `sortBy`,
 * so the ordering is the client's to choose, and a list of academic years is
 * one of the few where reverse chronology is unambiguously what a user wants.
 * Years with an unparseable start date sort last rather than being dropped.
 */
export function useAcademicYears(branchId: string | null) {
  const query = useQuery({
    queryKey: academicYearKeys.listByBranch(branchId ?? ""),
    queryFn: () => academicYearService.list(branchId ?? ""),
    enabled: Boolean(branchId),
    meta: { skipErrorToast: true },
  });

  const academicYears = useMemo(() => {
    if (!query.data) return [];
    return [...query.data].sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    );
  }, [query.data]);

  return { ...query, academicYears };
}

/**
 * The branch's currently selected year — `GET /academic-years/current`.
 *
 * A branch may legitimately have none: the auto-selection rule only fires on
 * the *first* year created, so a branch with no years at all has no current
 * one. The documentation records no response body and no status code for that
 * case, so a `404` is read as "none selected" and surfaced as `null` rather
 * than as an error. Any other failure is still an error.
 */
export function useCurrentAcademicYear(branchId: string | null) {
  const query = useQuery({
    queryKey: academicYearKeys.current(branchId ?? ""),
    queryFn: async () => {
      try {
        return await academicYearService.current(branchId ?? "");
      } catch (error) {
        if (isApiError(error) && error.kind === "notFound") return null;
        throw error;
      }
    },
    enabled: Boolean(branchId),
    meta: { skipErrorToast: true },
  });

  return { ...query, currentYear: query.data ?? null };
}

/**
 * One academic year by id — **resolved from the branch list, not fetched.**
 *
 * There is no `GET /academic-years/:id`. The collection documents eight
 * endpoints and a read-by-id is not among them: `PATCH`, `DELETE` and the three
 * transitions all take an `:id`, but nothing returns a single year. Both
 * sources agree on this, so it is an absence rather than a disagreement.
 *
 * Inventing the endpoint was the alternative and was rejected — it is precisely
 * the kind of plausible guess that ships a 404 to production. Instead the
 * documented branch list is the source, and the record is picked out of it.
 * Three consequences follow, and every one of them is visible in the UI:
 *
 * - The **active branch is required** to view a single year, so a detail link
 *   is not shareable across branches.
 * - "Not found" means *not in this branch's list*, which is a weaker statement
 *   than a 404 from a read endpoint — the year may exist elsewhere, or may have
 *   been soft-deleted, and the empty state says so.
 * - There is no per-record refetch. Invalidating the list is what refreshes a
 *   detail screen, which is why every mutation above invalidates it.
 */
export function useAcademicYear(id: string, branchId: string | null) {
  const query = useAcademicYears(branchId);

  const academicYear = useMemo(
    () => query.academicYears.find((year) => year.id === id) ?? null,
    [query.academicYears, id],
  );

  return { ...query, academicYear };
}

export interface AcademicYearFilters {
  search: string;
  state: string;
}

/**
 * Narrow the loaded years **in the client**.
 *
 * `branchId` is the only query parameter either read endpoint documents — no
 * `page`, `limit`, `search`, `sortBy` or status filter exists to send. Rather
 * than leave the directory's controls dead, the whole collection is filtered
 * here and the screen states that it is doing so, the same arrangement the
 * organization, branch and maintenance lists use for the same reason.
 */
export function filterAcademicYears(
  years: readonly AcademicYearDto[],
  filters: AcademicYearFilters,
): AcademicYearDto[] {
  const needle = filters.search.trim().toLowerCase();

  return years.filter((year) => {
    if (
      filters.state !== ANY_STATE &&
      academicYearState(year) !== filters.state
    ) {
      return false;
    }

    if (needle.length === 0) return true;

    return [year.name, year.startDate, year.endDate]
      .filter((field): field is string => typeof field === "string")
      .some((field) => field.toLowerCase().includes(needle));
  });
}

/** Everything a write should refresh: the branch's list, and its current year. */
function scopeKeys(branchId: string) {
  return [
    academicYearKeys.listByBranch(branchId),
    academicYearKeys.current(branchId),
  ];
}

/** Create an academic year. */
export function useCreateAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: CreateAcademicYearRequest) =>
      academicYearService.create(body),
    onSuccess: async (year: AcademicYearDto, body) => {
      // Keyed off the request rather than the response: no response body is
      // documented, so `year.branchId` may not come back, and invalidating the
      // wrong branch would leave the list the user is looking at stale.
      await invalidateKeys(queryClient, scopeKeys(body.branchId));
      toast.success(`${year?.name ?? body.name} created`);
    },
  });
}

/** Update an academic year. The body is always complete — see the mapper. */
export function useUpdateAcademicYear(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: UpdateAcademicYearRequest) =>
      academicYearService.update(id, body),
    onSuccess: async (year: AcademicYearDto, body) => {
      if (year) queryClient.setQueryData(academicYearKeys.detail(id), year);
      await invalidateKeys(queryClient, [
        ...scopeKeys(body.branchId),
        academicYearKeys.detail(id),
      ]);
      toast.success("Academic year updated");
    },
  });
}

/**
 * Run one of the three documented lifecycle transitions.
 *
 * One hook rather than three, because the three endpoints differ only by a path
 * segment and share every cache consequence: `select` moves the current year,
 * `activate` and `lock` change flags the list renders.
 *
 * **No optimistic update**, for a reason that is not the branch module's. These
 * endpoints are idempotent, so a retry is harmless — but every one of them is
 * *irreversible*, and showing a locked badge a moment before the server has
 * agreed would tell the user something final has happened when it may not have.
 * The cache is invalidated and the truth re-read.
 */
export function useAcademicYearTransition(branchId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: ({
      id,
      transition,
    }: {
      id: string;
      transition: AcademicYearTransition;
    }) => academicYearService.transition(id, transition),
    onSuccess: async (_year, { id, transition }) => {
      await invalidateKeys(queryClient, [
        ...scopeKeys(branchId ?? ""),
        academicYearKeys.detail(id),
      ]);
      toast.success(
        transition === "activate"
          ? "Academic year activated"
          : transition === "select"
            ? "Current academic year updated"
            : "Academic year locked",
      );
    },
  });
}

/**
 * Delete an academic year — the documented soft delete.
 *
 * No optimistic removal: a year vanishing from the directory before the server
 * has agreed would misreport an operation the documentation gates behind two
 * separate rules, either of which can refuse it.
 */
export function useDeleteAcademicYear(branchId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (id: string) => academicYearService.remove(id),
    onSuccess: async (_result, id) => {
      await invalidateKeys(queryClient, [
        ...scopeKeys(branchId ?? ""),
        academicYearKeys.detail(id),
      ]);
      toast.success("Academic year deleted");
    },
  });
}
