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
 * Form values → the documented Create body. `isActive` is deliberately
 * absent — the captured Create example does not include it (the backend's
 * `CreateDocumentTypeDto` rejects unknown properties with `property
 * isActive should not exist`); only the Update body documents it.
 */
export function toDocumentTypeCreateRequest(
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
  };
}

/** Form values → the documented Update body — the complete record, including `isActive`. */
export function toDocumentTypeUpdateRequest(
  values: DocumentTypeFormValues,
): DocumentTypeRequest {
  return {
    ...toDocumentTypeCreateRequest(values),
    isActive: values.isActive,
  };
}
