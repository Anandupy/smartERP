import { api, apiClient } from "@/core/api";
import type { ApiResponse } from "@/types/api";

import type {
  ArchiveDocumentRequest,
  DocumentDto,
  DocumentOwnerType,
  DocumentRequirementDto,
  DocumentRequirementRequest,
  DocumentTypeDto,
  DocumentTypeRequest,
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

  /**
   * `GET /documents/:id` — "Get One Document with Its Version History" in
   * the Postman collection. Its captured response schema carries only
   * `currentVersion`, no `versions[]` array — see the DTO doc-comment
   * (`docs/backend-gaps.md` DOC2).
   */
  get: (id: string) => api.get<DocumentDto>(`/documents/${id}`),

  /**
   * `POST /documents` — multipart upload. Field names (`file`, `ownerType`,
   * `ownerId`, `documentTypeId`) are confirmed via the Postman example's
   * `formdata` body.
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
   * multipart shape as `upload`, `file` only.
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

  /**
   * `GET /document-requirements?branchId=`. `branchId` is the only
   * documented query parameter, and the collection marks it **Required** —
   * confirmed directly against the Postman example, superseding the earlier
   * `programId`/`quotaId`/`categoryId` assumption. Program/quota/category
   * narrowing happens client-side (`utils/checklist.ts`), matching every
   * nullable-means-"applies to all" field the design spec documents (§8).
   */
  listRequirements: (branchId: string) =>
    api.get<DocumentRequirementDto[]>("/document-requirements", {
      params: { branchId },
    }),

  /** `GET /document-requirements/:id`. */
  getRequirement: (id: string) =>
    api.get<DocumentRequirementDto>(`/document-requirements/${id}`),

  /** `POST /document-requirements`. */
  createRequirement: (body: DocumentRequirementRequest) =>
    api.post<DocumentRequirementDto, DocumentRequirementRequest>(
      "/document-requirements",
      body,
    ),

  /** `PATCH /document-requirements/:id`. Body is the complete documented record. */
  updateRequirement: (id: string, body: DocumentRequirementRequest) =>
    api.patch<DocumentRequirementDto, DocumentRequirementRequest>(
      `/document-requirements/${id}`,
      body,
    ),

  /** `DELETE /document-requirements/:id`. */
  deleteRequirement: (id: string) =>
    api.delete<void>(`/document-requirements/${id}`),

  /**
   * `GET /document-types?includeInactive=`. The only documented query
   * parameter, marked **Required** — mirrors Admission Masters' `list`
   * contract exactly, so `includeInactive=true` is always sent and
   * active/inactive filtering happens client-side.
   */
  listTypes: (includeInactive: boolean) =>
    api.get<DocumentTypeDto[]>("/document-types", {
      params: { includeInactive },
    }),

  /** `GET /document-types/:id`. */
  getType: (id: string) => api.get<DocumentTypeDto>(`/document-types/${id}`),

  /** `POST /document-types`. */
  createType: (body: DocumentTypeRequest) =>
    api.post<DocumentTypeDto, DocumentTypeRequest>("/document-types", body),

  /** `PATCH /document-types/:id`. Body is the complete documented record. */
  updateType: (id: string, body: DocumentTypeRequest) =>
    api.patch<DocumentTypeDto, DocumentTypeRequest>(
      `/document-types/${id}`,
      body,
    ),

  /** `DELETE /document-types/:id`. */
  deleteType: (id: string) => api.delete<void>(`/document-types/${id}`),
} as const;
