"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";

import { documentKeys } from "../api/document.keys";
import { documentService } from "../api/document.service";
import type {
  ArchiveDocumentRequest,
  DocumentOwnerType,
  RejectDocumentRequest,
  UploadDocumentFields,
} from "../types/document.dto";

/** Every document for one owner. */
export function useOwnerDocuments(
  ownerType: DocumentOwnerType,
  ownerId: string | null,
) {
  const query = useQuery({
    queryKey: documentKeys.byOwner(ownerType, ownerId ?? ""),
    queryFn: () => documentService.listByOwner(ownerType, ownerId ?? ""),
    enabled: Boolean(ownerId),
    meta: { skipErrorToast: true },
  });

  return { ...query, documents: query.data ?? [] };
}

/**
 * The document-requirement checklist for a program/quota/category
 * combination (module doc §6.4). `programId` is the only one that is
 * usually always present; `quotaId`/`categoryId` narrow further when set.
 */
export function useDocumentRequirements(params: {
  programId?: string;
  quotaId?: string;
  categoryId?: string;
}) {
  const query = useQuery({
    queryKey: documentKeys.requirements(params),
    queryFn: () => documentService.listRequirements(params),
    enabled: Boolean(params.programId),
    meta: { skipErrorToast: true },
  });

  return { ...query, requirements: query.data ?? [] };
}

/** Every configured document type — for the upload picker. */
export function useDocumentTypes() {
  const query = useQuery({
    queryKey: documentKeys.types(),
    queryFn: () => documentService.listTypes(),
    meta: { skipErrorToast: true },
  });

  return { ...query, types: query.data ?? [] };
}

function scopeKeys(ownerType: DocumentOwnerType, ownerId: string) {
  return [documentKeys.byOwner(ownerType, ownerId)];
}

/**
 * Upload a document. Field names are the module's one unconfirmed shape
 * (`docs/backend-gaps.md` DOC1) — see `document.service.ts`.
 */
export function useUploadDocument(ownerType: DocumentOwnerType, ownerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (fields: Omit<UploadDocumentFields, "ownerType" | "ownerId">) =>
      documentService.upload({ ...fields, ownerType, ownerId }),
    onSuccess: async () => {
      await invalidateKeys(queryClient, scopeKeys(ownerType, ownerId));
      toast.success("Document uploaded");
    },
  });
}

/** Verify a document's current version. No request body, no reason. */
export function useVerifyDocument(ownerType: DocumentOwnerType, ownerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (documentId: string) => documentService.verify(documentId),
    onSuccess: async () => {
      await invalidateKeys(queryClient, scopeKeys(ownerType, ownerId));
      toast.success("Document verified");
    },
  });
}

/** Reject a document's current version. `reason` is required. */
export function useRejectDocument(ownerType: DocumentOwnerType, ownerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: ({
      documentId,
      ...body
    }: RejectDocumentRequest & { documentId: string }) =>
      documentService.reject(documentId, body),
    onSuccess: async () => {
      await invalidateKeys(queryClient, scopeKeys(ownerType, ownerId));
      toast.success("Document rejected");
    },
  });
}

/**
 * Replace a document with a new version — append-only. The new version
 * always resets to `PENDING` and re-verification is required (module doc
 * §6.2).
 */
export function useReplaceDocument(ownerType: DocumentOwnerType, ownerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: ({ documentId, file }: { documentId: string; file: File }) =>
      documentService.replace(documentId, file),
    onSuccess: async () => {
      await invalidateKeys(queryClient, scopeKeys(ownerType, ownerId));
      toast.success("Document replaced — pending re-verification");
    },
  });
}

/** Archive a document — soft state only, never deletes the row. */
export function useArchiveDocument(ownerType: DocumentOwnerType, ownerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: ({
      documentId,
      ...body
    }: ArchiveDocumentRequest & { documentId: string }) =>
      documentService.archive(documentId, body),
    onSuccess: async () => {
      await invalidateKeys(queryClient, scopeKeys(ownerType, ownerId));
      toast.success("Document archived");
    },
  });
}

/**
 * Download a document's current version. Streams through the backend and
 * never resolves to a URL this hook exposes — the request/blob handling
 * lives entirely in `document.service.ts` (module doc §6.6, §7.2).
 */
export function useDownloadDocument() {
  return useMutation({
    mutationFn: ({ documentId, filename }: { documentId: string; filename: string }) =>
      documentService.download(documentId, filename),
    onError: () => toast.error("Download failed"),
  });
}
