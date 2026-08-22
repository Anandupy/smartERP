"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { invalidateKeys } from "@/core/query";
import { useWorkspace } from "@/core/workspace";

import { documentKeys } from "../api/document.keys";
import { documentService } from "../api/document.service";
import {
  toDocumentRequirementUpdateRequest,
  toDocumentRequirementFormValues,
} from "../mappers/document-requirement.mapper";
import { toDocumentTypeFormValues, toDocumentTypeRequest } from "../mappers/document-type.mapper";
import type {
  ArchiveDocumentRequest,
  DocumentOwnerType,
  DocumentRequirementDto,
  DocumentRequirementRequest,
  DocumentTypeDto,
  DocumentTypeRequest,
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

/** One document, with its current version — for a detail view. */
export function useDocument(id: string | null) {
  return useQuery({
    queryKey: documentKeys.detail(id ?? ""),
    queryFn: () => documentService.get(id ?? ""),
    enabled: Boolean(id),
    meta: { skipErrorToast: true },
  });
}

/**
 * The branch every document-configuration request is scoped to.
 *
 * `branchId` is a documented required query parameter on
 * `GET /document-requirements`, and Document Type visibility is
 * "masters-style" branch visibility (design spec §7, §27) — the same shape
 * Admission Masters uses. Returns `null` until the workspace scope is
 * `ready`.
 */
export function useDocumentsBranch() {
  const { branch, isReady } = useWorkspace();
  return isReady ? branch : null;
}

/**
 * Every `DocumentRequirement` configured for the active branch.
 *
 * `branchId` is the only documented list filter — narrowing by program,
 * quota, category or status all happen client-side (see
 * `utils/checklist.ts` and `filterDocumentRequirements`).
 */
export function useDocumentRequirements() {
  const branch = useDocumentsBranch();

  const query = useQuery({
    queryKey: documentKeys.requirements(branch?.id ?? ""),
    queryFn: () => documentService.listRequirements(branch?.id ?? ""),
    enabled: Boolean(branch),
    meta: { skipErrorToast: true },
  });

  return { ...query, requirements: query.data ?? [] };
}

/** One requirement by id. */
export function useDocumentRequirement(id: string) {
  const branch = useDocumentsBranch();

  return useQuery({
    queryKey: documentKeys.requirement(id),
    queryFn: () => documentService.getRequirement(id),
    enabled: Boolean(branch) && Boolean(id),
    meta: { skipErrorToast: true },
  });
}

/** Every configured document type — for the upload picker and the admin directory. */
export function useDocumentTypes() {
  const query = useQuery({
    queryKey: documentKeys.types(true),
    queryFn: () => documentService.listTypes(true),
    meta: { skipErrorToast: true },
  });

  const types = useMemo(() => {
    if (!query.data) return [];
    return [...query.data].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
    );
  }, [query.data]);

  return { ...query, types };
}

/** One document type by id. */
export function useDocumentType(id: string) {
  return useQuery({
    queryKey: documentKeys.type(id),
    queryFn: () => documentService.getType(id),
    enabled: Boolean(id),
    meta: { skipErrorToast: true },
  });
}

function scopeKeys(ownerType: DocumentOwnerType, ownerId: string) {
  return [documentKeys.byOwner(ownerType, ownerId)];
}

/** Upload a document. Field names confirmed via the Postman `formdata` example. */
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

/** Create a document requirement. */
export function useCreateDocumentRequirement() {
  const queryClient = useQueryClient();
  const branch = useDocumentsBranch();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: DocumentRequirementRequest) =>
      documentService.createRequirement(body),
    onSuccess: async () => {
      await invalidateKeys(queryClient, [
        documentKeys.requirements(branch?.id ?? ""),
      ]);
      toast.success("Document requirement created");
    },
  });
}

/** Update a document requirement. The body is always the complete record. */
export function useUpdateDocumentRequirement(id: string) {
  const queryClient = useQueryClient();
  const branch = useDocumentsBranch();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: DocumentRequirementRequest) =>
      documentService.updateRequirement(id, body),
    onSuccess: async (requirement) => {
      queryClient.setQueryData(documentKeys.requirement(id), requirement);
      await invalidateKeys(queryClient, [
        documentKeys.requirements(branch?.id ?? ""),
        documentKeys.requirement(id),
      ]);
      toast.success("Document requirement updated");
    },
  });
}

/**
 * Activate or deactivate a document requirement.
 *
 * No dedicated status endpoint is documented — only the generic
 * `PATCH /document-requirements/:id`, whose body is the complete record —
 * so this resends the whole record with `isActive` flipped, taking the
 * record itself as the mutate argument rather than requiring its id ahead of
 * render (mirrors `useToggleAdmissionMasterActive`).
 */
export function useToggleDocumentRequirementActive() {
  const queryClient = useQueryClient();
  const branch = useDocumentsBranch();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (requirement: DocumentRequirementDto) =>
      documentService.updateRequirement(
        requirement.id,
        toDocumentRequirementUpdateRequest(
          {
            ...toDocumentRequirementFormValues(requirement),
            isActive: !requirement.isActive,
          },
          requirement.branchId,
        ),
      ),
    onSuccess: async (requirement) => {
      queryClient.setQueryData(documentKeys.requirement(requirement.id), requirement);
      await invalidateKeys(queryClient, [
        documentKeys.requirements(branch?.id ?? ""),
        documentKeys.requirement(requirement.id),
      ]);
      toast.success(
        requirement.isActive ? "Requirement activated" : "Requirement deactivated",
      );
    },
  });
}

/** Delete a document requirement. */
export function useDeleteDocumentRequirement() {
  const queryClient = useQueryClient();
  const branch = useDocumentsBranch();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (id: string) => documentService.deleteRequirement(id),
    onSuccess: async (_result, id) => {
      await invalidateKeys(queryClient, [
        documentKeys.requirements(branch?.id ?? ""),
        documentKeys.requirement(id),
      ]);
      toast.success("Document requirement deleted");
    },
  });
}

/** Create a document type. */
export function useCreateDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: DocumentTypeRequest) => documentService.createType(body),
    onSuccess: async (type) => {
      await invalidateKeys(queryClient, [documentKeys.types(true)]);
      toast.success(`${type.name} created`);
    },
  });
}

/** Update a document type. The body is always the complete record. */
export function useUpdateDocumentType(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (body: DocumentTypeRequest) =>
      documentService.updateType(id, body),
    onSuccess: async (type) => {
      queryClient.setQueryData(documentKeys.type(id), type);
      await invalidateKeys(queryClient, [
        documentKeys.types(true),
        documentKeys.type(id),
      ]);
      toast.success(`${type.name} updated`);
    },
  });
}

/**
 * Activate or deactivate a document type. Same "resend the whole record"
 * shape as the requirement toggle above — see its doc-comment.
 */
export function useToggleDocumentTypeActive() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (type: DocumentTypeDto) =>
      documentService.updateType(
        type.id,
        toDocumentTypeRequest({
          ...toDocumentTypeFormValues(type),
          isActive: !type.isActive,
        }),
      ),
    onSuccess: async (type) => {
      queryClient.setQueryData(documentKeys.type(type.id), type);
      await invalidateKeys(queryClient, [
        documentKeys.types(true),
        documentKeys.type(type.id),
      ]);
      toast.success(type.isActive ? `${type.name} activated` : `${type.name} deactivated`);
    },
  });
}

/** Delete a document type. */
export function useDeleteDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { skipErrorToast: true },
    mutationFn: (id: string) => documentService.deleteType(id),
    onSuccess: async (_result, id) => {
      await invalidateKeys(queryClient, [
        documentKeys.types(true),
        documentKeys.type(id),
      ]);
      toast.success("Document type deleted");
    },
  });
}
