import { api, apiClient } from "@/core/api";
import type { ApiResponse } from "@/types/api";

import type {
  ArchiveDocumentRequest,
  DocumentDto,
  DocumentOwnerType,
  DocumentRequirementDto,
  DocumentTypeDto,
  RejectDocumentRequest,
  UploadDocumentFields,
} from "../types/document.dto";

/**
 * Transport for `/v1/documents`, `/v1/document-requirements` and
 * `/v1/document-types`.
 *
 * All three are **top-level** routes, not nested under `/admissions` —
 * Documents is a generic, owner-polymorphic module (module doc §6).
 */
export const documentService = {
  /** `GET /documents?ownerType=&ownerId=`. Both required. */
  listByOwner: (ownerType: DocumentOwnerType, ownerId: string) =>
    api.get<DocumentDto[]>("/documents", { params: { ownerType, ownerId } }),

  /** `GET /documents/:id`. Whether this expands prior versions is unconfirmed (DOC2). */
  get: (id: string) => api.get<DocumentDto>(`/documents/${id}`),

  /**
   * `POST /documents` — multipart upload. Field names (`file`, `ownerType`,
   * `ownerId`, `documentTypeId`) follow convention, not a confirmed Postman
   * example (module doc §6.7, `backend-gaps.md` DOC1) — the one place in
   * this module built on an educated guess rather than a verified shape.
   *
   * `Content-Type` is left for the browser to set (with the multipart
   * boundary) by explicitly clearing the client's default JSON header —
   * axios/XHR only computes the boundary correctly when nothing has already
   * called `setRequestHeader("Content-Type", …)`.
   */
  upload: async (fields: UploadDocumentFields) => {
    const form = new FormData();
    form.append("file", fields.file);
    form.append("ownerType", fields.ownerType);
    form.append("ownerId", fields.ownerId);
    form.append("documentTypeId", fields.documentTypeId);

    const response = await apiClient.post<ApiResponse<DocumentDto>>(
      "/documents",
      form,
      { headers: { "Content-Type": undefined } },
    );
    return response.data.data;
  },

  /** `POST /documents/:id/verify`. No request body. */
  verify: (id: string) => api.post<DocumentDto>(`/documents/${id}/verify`),

  /** `POST /documents/:id/reject`. `reason` is required, 3–500 chars. */
  reject: (id: string, body: RejectDocumentRequest) =>
    api.post<DocumentDto, RejectDocumentRequest>(
      `/documents/${id}/reject`,
      body,
    ),

  /**
   * `POST /documents/:id/replace` — a new version, append-only. Same
   * unconfirmed multipart shape as `upload`.
   */
  replace: async (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);

    const response = await apiClient.post<ApiResponse<DocumentDto>>(
      `/documents/${id}/replace`,
      form,
      { headers: { "Content-Type": undefined } },
    );
    return response.data.data;
  },

  /** `POST /documents/:id/archive`. Soft state only — never deletes the row. */
  archive: (id: string, body: ArchiveDocumentRequest) =>
    api.post<DocumentDto, ArchiveDocumentRequest>(
      `/documents/${id}/archive`,
      body,
    ),

  /**
   * `GET /documents/:id/download` — streamed bytes through the backend,
   * never a presigned or public URL (module doc §6.6). Requested as a blob
   * and handed to the browser as a local download; the URL never leaves this
   * function.
   */
  download: async (id: string, filename: string) => {
    const response = await apiClient.get<Blob>(`/documents/${id}/download`, {
      responseType: "blob",
    });
    const objectUrl = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  },

  /** `GET /document-requirements`. The checklist definition table. */
  listRequirements: (params: {
    programId?: string;
    quotaId?: string;
    categoryId?: string;
  }) =>
    api.get<DocumentRequirementDto[]>("/document-requirements", { params }),

  /** `GET /document-types`. */
  listTypes: () => api.get<DocumentTypeDto[]>("/document-types"),
} as const;
