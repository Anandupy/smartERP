"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";

import { maintenanceKeys } from "../api/maintenance.keys";
import { maintenanceService } from "../api/maintenance.service";
import { SCOPE_PRESENTATION, type MaintenanceStatusFilter } from "../constants";
import type {
  CreateMaintenanceRuleRequest,
  MaintenanceRuleDto,
  MaintenanceScopeType,
  UpdateMaintenanceRuleRequest,
} from "../types/maintenance.dto";
import { readActiveStatus } from "../utils/active-status";

/** Every rule, in documented precedence order. */
export function useMaintenanceRules() {
  const query = useQuery({
    queryKey: maintenanceKeys.lists(),
    queryFn: maintenanceService.list,
    meta: { skipErrorToast: true },
  });

  const rules = useMemo(() => {
    if (!query.data) return [];
    // Sorted the way the guard resolves them — highest-precedence scope first,
    // active before inactive — so the rule currently winning is at the top.
    return [...query.data].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return (
        SCOPE_PRESENTATION[a.scopeType].precedence -
        SCOPE_PRESENTATION[b.scopeType].precedence
      );
    });
  }, [query.data]);

  return { ...query, rules };
}

/** One rule by id. */
export function useMaintenanceRule(id: string) {
  return useQuery({
    queryKey: maintenanceKeys.detail(id),
    queryFn: () => maintenanceService.get(id),
    enabled: Boolean(id),
    meta: { skipErrorToast: true },
  });
}

export interface MaintenanceRuleFilters {
  search: string;
  scopeType: MaintenanceScopeType | "ALL";
  status: MaintenanceStatusFilter;
}

/**
 * Narrow the loaded rules **in the client**.
 *
 * `GET /maintenance-rules` documents no query parameters — no `page`, no
 * `search`, no filters — so there is nothing to send. Rather than leave the
 * screen's controls dead, the whole collection is filtered here, and the
 * screen marks server-side filtering as pending so the distinction is visible
 * to whoever wires it later.
 *
 * This is honest for a rules table (an installation has a handful of them) and
 * would not be for an audit log, which is exactly why the audit module pages
 * on the server instead.
 */
export function filterRules(
  rules: readonly MaintenanceRuleDto[],
  filters: MaintenanceRuleFilters,
): MaintenanceRuleDto[] {
  const needle = filters.search.trim().toLowerCase();

  return rules.filter((rule) => {
    if (filters.scopeType !== "ALL" && rule.scopeType !== filters.scopeType) {
      return false;
    }

    if (filters.status === "ACTIVE" && !rule.isActive) return false;
    if (filters.status === "INACTIVE" && rule.isActive) return false;

    if (needle.length === 0) return true;

    return [rule.title, rule.shortMessage, rule.reason, rule.scopeId, rule.id]
      .filter((field): field is string => typeof field === "string")
      .some((field) => field.toLowerCase().includes(needle));
  });
}

/**
 * The maintenance state applying to the caller's current scope.
 *
 * The response is undocumented, so the payload is read defensively by
 * `readActiveStatus` — see that module for why a wrong guess must degrade to
 * silence rather than to a false announcement.
 */
export function useActiveMaintenanceStatus() {
  const query = useQuery({
    queryKey: maintenanceKeys.activeStatus(),
    queryFn: maintenanceService.activeStatus,
    meta: { skipErrorToast: true },
    // A notice nobody asked for should not retry noisily behind the screen.
    retry: false,
  });

  return {
    ...query,
    status: query.data === undefined ? null : readActiveStatus(query.data),
  };
}

/** Create a rule. */
export function useCreateMaintenanceRule() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: CreateMaintenanceRuleRequest) =>
      maintenanceService.create(body),
    onSuccess: async () => {
      await invalidateKeys(queryClient, [
        maintenanceKeys.lists(),
        maintenanceKeys.activeStatus(),
      ]);
      toast.success("Maintenance rule created");
    },
  });
}

/** Update a rule. The body is always complete — see the mapper. */
export function useUpdateMaintenanceRule(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: UpdateMaintenanceRuleRequest) =>
      maintenanceService.update(id, body),
    onSuccess: async (rule) => {
      queryClient.setQueryData(maintenanceKeys.detail(id), rule);
      await invalidateKeys(queryClient, [
        maintenanceKeys.lists(),
        maintenanceKeys.activeStatus(),
      ]);
      toast.success("Maintenance rule updated");
    },
  });
}

/**
 * Delete a rule.
 *
 * No optimistic removal: a rule that governs whether the platform is reachable
 * should disappear from the list once the server agrees it is gone, not before.
 */
export function useDeleteMaintenanceRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => maintenanceService.remove(id),
    onSuccess: async () => {
      await invalidateKeys(queryClient, [
        maintenanceKeys.lists(),
        maintenanceKeys.activeStatus(),
      ]);
      toast.success("Maintenance rule deleted");
    },
  });
}
