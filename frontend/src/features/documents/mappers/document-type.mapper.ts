import type { DocumentTypeFormValues } from "../schemas/document-type.schema";
import type { DocumentTypeDto, DocumentTypeRequest } from "../types/document.dto";

/** Seed the form from a loaded record. */
export function toDocumentTypeFormValues(
  type: DocumentTypeDto,
): DocumentTypeFormValues {
  return {
    code: type.code,
    name: type.name,
    description: type.description ?? "",
    isSensitive: type.isSensitive,
    hasExpiry: type.hasExpiry,
    defaultValidityMonths: type.defaultValidityMonths,
    retentionYears: type.retentionYears,
    allowedMimeTypes: type.allowedMimeTypes,
    maxSizeBytes: type.maxSizeBytes,
    displayOrder: type.displayOrder ?? 0,
    isActive: type.isActive,
  };
}

/**
 * Form values → the complete documented request body, for both create and
 * update — the captured Postman bodies for both are identical
 * (`docs/documents-management-module.md`).
 */
export function toDocumentTypeRequest(
  values: DocumentTypeFormValues,
): DocumentTypeRequest {
  const trimmedDescription = values.description.trim();

  return {
    code: values.code,
    name: values.name,
    description: trimmedDescription.length > 0 ? trimmedDescription : null,
    isSensitive: values.isSensitive,
    hasExpiry: values.hasExpiry,
    defaultValidityMonths: values.hasExpiry ? values.defaultValidityMonths : null,
    retentionYears: values.retentionYears,
    allowedMimeTypes: values.allowedMimeTypes,
    maxSizeBytes: values.maxSizeBytes,
    displayOrder: values.displayOrder,
    isActive: values.isActive,
  };
}
