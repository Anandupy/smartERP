import {
  APPLIES_TO_ALL,
  type DocumentRequirementFormValues,
} from "../schemas/document-requirement.schema";
import type {
  DocumentRequirementDto,
  DocumentRequirementRequest,
} from "../types/document.dto";

/** Seed the form from a loaded record. */
export function toDocumentRequirementFormValues(
  requirement: DocumentRequirementDto,
): DocumentRequirementFormValues {
  return {
    documentTypeId: requirement.documentTypeId,
    appliesToProgramId: requirement.appliesToProgramId ?? APPLIES_TO_ALL,
    appliesToQuotaId: requirement.appliesToQuotaId ?? APPLIES_TO_ALL,
    appliesToCategoryId: requirement.appliesToCategoryId ?? APPLIES_TO_ALL,
    requiredByStage: requirement.requiredByStage,
    isMandatory: requirement.isMandatory,
    isActive: requirement.isActive,
  };
}

/**
 * Form values → the documented Create body. `isActive` is deliberately
 * absent — the captured Create example does not include it (only Update
 * does), and this codebase never sends a field the create contract does not
 * document (AGENTS.md §28).
 */
export function toDocumentRequirementCreateRequest(
  values: DocumentRequirementFormValues,
  branchId: string,
): DocumentRequirementRequest {
  const orAll = (value: string) => (value === APPLIES_TO_ALL ? null : value);

  return {
    branchId,
    documentTypeId: values.documentTypeId,
    appliesToProgramId: orAll(values.appliesToProgramId),
    appliesToQuotaId: orAll(values.appliesToQuotaId),
    appliesToCategoryId: orAll(values.appliesToCategoryId),
    requiredByStage: values.requiredByStage,
    isMandatory: values.isMandatory,
  };
}

/** Form values → the documented Update body — the complete record, including `isActive`. */
export function toDocumentRequirementUpdateRequest(
  values: DocumentRequirementFormValues,
  branchId: string,
): DocumentRequirementRequest {
  return {
    ...toDocumentRequirementCreateRequest(values, branchId),
    isActive: values.isActive,
  };
}
