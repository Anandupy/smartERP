"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";
import { useWorkspace } from "@/core/workspace";

import { numberingKeys } from "../api/numbering.keys";
import { numberingService } from "../api/numbering.service";
import type {
  CreateNumberingConfigRequest,
  PreviewNumberingRequest,
  UpdateNumberingConfigRequest,
} from "../types/numbering.dto";

/**
 * The branch every numbering-config read/write is scoped to (when the
 * config itself is branch-scoped — organization-scoped configs are visible
 * regardless). Mirrors `useDocumentsBranch`/`useAdmissionMastersBranch`.
 */
export function useNumberingBranch() {
  const { branch, isReady } = useWorkspace();
  return isReady ? branch : null;
}

/** Every sequence config readable from the current org/branch scope. No documented list filters. */
export function useNumberingConfigs() {
  const branch = useNumberingBranch();

  const query = useQuery({
    queryKey: numberingKeys.list({ branchId: branch?.id ?? "" }),
    queryFn: () => numberingService.list(),
    enabled: Boolean(branch),
    meta: { skipErrorToast: true },
  });

  return { ...query, configs: query.data ?? [] };
}

/**
 * One config, resolved out of the list — no `GET /:id` is documented, the
 * same "resolve from the list" pattern Academic Year's missing `GET /:id`
 * established (AGENTS.md §28).
 */
export function useNumberingConfig(id: string) {
  const { configs, ...query } = useNumberingConfigs();
  const config = configs.find((entry) => entry.id === id) ?? null;
  return { ...query, config };
}

export function useCreateNumberingConfig() {
  const queryClient = useQueryClient();
  const branch = useNumberingBranch();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: CreateNumberingConfigRequest) => numberingService.create(body),
    onSuccess: async () => {
      await invalidateKeys(queryClient, [
        numberingKeys.list({ branchId: branch?.id ?? "" }),
      ]);
      toast.success("Sequence configured");
    },
  });
}

export function useUpdateNumberingConfig(id: string) {
  const queryClient = useQueryClient();
  const branch = useNumberingBranch();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: UpdateNumberingConfigRequest) => numberingService.update(id, body),
    onSuccess: async () => {
      await invalidateKeys(queryClient, [
        numberingKeys.list({ branchId: branch?.id ?? "" }),
      ]);
      toast.success("Sequence updated");
    },
  });
}

/** Renders a sample without consuming a number. */
export function usePreviewNumbering(id: string) {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: PreviewNumberingRequest) => numberingService.preview(id, body),
  });
}
