"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";

import { communicationKeys } from "../api/communication.keys";
import { communicationService } from "../api/communication.service";
import type {
  CommunicationChannel,
  TemplateDto,
  TemplateListQuery,
  TemplatePreviewRequest,
  TemplateWriteRequest,
} from "../types/template.dto";

/**
 * Templates matching the documented filters (`channel`, `status`, `search`).
 *
 * All three are sent to the server — no query parameter for pagination is
 * documented, so the directory screen pages the returned list itself, the
 * same accommodation the Program module makes for its own unpaginated list.
 */
export function useTemplates(query: TemplateListQuery) {
  const result = useQuery({
    queryKey: communicationKeys.templates.list(query),
    queryFn: () => communicationService.templates.list(query),
    meta: { skipErrorToast: true },
    placeholderData: (previous) => previous,
  });

  return { ...result, templates: result.data ?? [] };
}

/** One template by id — `GET /communication/templates/:id`. */
export function useTemplate(id: string) {
  return useQuery({
    queryKey: communicationKeys.templates.detail(id),
    queryFn: () => communicationService.templates.get(id),
    enabled: Boolean(id),
    meta: { skipErrorToast: true },
  });
}

/** Every list key, so a write invalidates whatever filters happen to be active. */
function templateListKeys() {
  return [communicationKeys.templates.lists()];
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: TemplateWriteRequest) =>
      communicationService.templates.create(body),
    onSuccess: async (template: TemplateDto, body) => {
      await invalidateKeys(queryClient, templateListKeys());
      toast.success(`${template?.name ?? body.name} created`);
    },
  });
}

export function useUpdateTemplate(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: TemplateWriteRequest) =>
      communicationService.templates.update(id, body),
    onSuccess: async (template: TemplateDto) => {
      if (template) {
        queryClient.setQueryData(communicationKeys.templates.detail(id), template);
      }
      await invalidateKeys(queryClient, [
        ...templateListKeys(),
        communicationKeys.templates.detail(id),
      ]);
      toast.success("Template updated");
    },
  });
}

/**
 * Render a template preview — `POST /communication/templates/preview`.
 *
 * A mutation rather than a query: this is a user-triggered render against
 * caller-supplied sample variables, not a cacheable read. No optimistic
 * result — the whole point is showing exactly what the server would send.
 */
export function useTemplatePreview() {
  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: ({
      body,
      channel,
    }: {
      body: TemplatePreviewRequest;
      channel: CommunicationChannel;
    }) => communicationService.templates.preview(body, channel),
  });
}
