import type {
  DocumentDto,
  DocumentRequirementDto,
  DocumentTypeDto,
} from "../types/document.dto";

export type ChecklistItemState =
  | "verified"
  | "pending"
  | "rejected"
  | "missing";

export interface ChecklistItem {
  requirement: DocumentRequirementDto;
  document: DocumentDto | null;
  state: ChecklistItemState;
}

/**
 * One checklist line as the backend reports it —
 * `GET /admissions/applicants/:id/checklist` (`ApplicantChecklistDto.items`).
 *
 * Plain data, so the route composition can hand Admissions' answer to this
 * feature without either importing the other (AGENTS.md §7, §28).
 */
export interface ServerChecklistItem {
  requirementId: string;
  documentTypeId: string;
  name: string;
  requiredByStage: string;
  isMandatory: boolean;
  branchId: string | null;
  status: "VERIFIED" | "PENDING_VERIFICATION" | "REJECTED" | "MISSING";
  documentId: string | null;
}

const STATE: Record<ServerChecklistItem["status"], ChecklistItemState> = {
  VERIFIED: "verified",
  PENDING_VERIFICATION: "pending",
  REJECTED: "rejected",
  MISSING: "missing",
};

/**
 * The checklist rows to render, from the backend's own checklist.
 *
 * Which requirements bind the applicant — organization-wide or its own
 * branch, matching programme, quota and category — and whether each is
 * satisfied are decided by the server, by the same rules the workflow guard
 * enforces. This used to be recomputed here from the full requirement list,
 * which ignored a requirement's branch and so showed other branches'
 * requirements; nothing in this file decides applicability any more.
 *
 * `requirements` and `documents` only supply what the rows need to *act* —
 * the document to verify, replace or reject, and the type's display name.
 */
export function checklistFromServer(
  serverItems: readonly ServerChecklistItem[],
  requirements: readonly DocumentRequirementDto[],
  documents: readonly DocumentDto[],
): ChecklistItem[] {
  const requirementById = new Map(requirements.map((r) => [r.id, r]));

  return serverItems.map((item) => {
    const known = requirementById.get(item.requirementId);
    const requirement: DocumentRequirementDto = {
      id: item.requirementId,
      branchId: item.branchId ?? known?.branchId ?? "",
      documentTypeId: item.documentTypeId,
      appliesToProgramId: known?.appliesToProgramId ?? null,
      appliesToQuotaId: known?.appliesToQuotaId ?? null,
      appliesToCategoryId: known?.appliesToCategoryId ?? null,
      requiredByStage: item.requiredByStage,
      isMandatory: item.isMandatory,
      isActive: true,
      // A requirement the branch list did not return still renders under the
      // name the server gave it; the row reads nothing else from the type.
      documentType:
        known?.documentType ??
        ({ id: item.documentTypeId, name: item.name } as DocumentTypeDto),
    };

    const document =
      (item.documentId
        ? documents.find((d) => d.id === item.documentId)
        : undefined) ??
      documents.find((d) => d.documentTypeId === item.documentTypeId) ??
      null;

    return { requirement, document, state: STATE[item.status] };
  });
}

/** Whether every *mandatory* requirement is satisfied — the checklist summary figure. */
export function checklistSummary(items: readonly ChecklistItem[]) {
  const mandatory = items.filter((item) => item.requirement.isMandatory);
  const verified = mandatory.filter((item) => item.state === "verified");
  return {
    total: mandatory.length,
    verified: verified.length,
    isSatisfied: mandatory.length > 0 && verified.length === mandatory.length,
  };
}
