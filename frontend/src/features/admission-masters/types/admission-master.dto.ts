/**
 * Wire shape for `/v1/admissions/masters/<resource>`.
 *
 * All 10 admission master resources (Admission Sources, Categories, Castes,
 * Religions, Genders, Languages, Blood Groups, Disabilities, Relation Types,
 * Quotas) share this exact shape — verified directly in
 * `backend/postman/erp.postman_collection.json`: every one of the 10
 * "Masters" folders has byte-identical Create/Update request bodies and
 * response schemas, differing only in the URL's resource segment.
 *
 * Two facts shape the module:
 *
 * 1. **`isActive` and `deletedAt` are separate, documented fields.** Toggling
 *    `isActive` (via `PATCH`) and deleting (via `DELETE`, which every folder
 *    literally names "Soft delete") are two distinct lifecycle actions.
 * 2. **No response body is captured** in the collection beyond schema-faker
 *    placeholders (field names are trustworthy — they come from the real
 *    schema — but no example carries a real value). Nothing beyond the field
 *    list itself is asserted here.
 */
export interface AdmissionMasterDto {
  id: string;
  organizationId: string;
  branchId: string;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Body for `POST /v1/admissions/masters/<resource>` and
 * `PATCH /v1/admissions/masters/<resource>/:id` — identical shape in the
 * collection, and no partial-update rule is documented, so an edit resends
 * the whole record (§28: "no partial write unless the backend documents
 * one").
 */
export interface AdmissionMasterRequest {
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
}
