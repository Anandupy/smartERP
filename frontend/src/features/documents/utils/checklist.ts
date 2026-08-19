import type { DocumentDto, DocumentRequirementDto } from "../types/document.dto";

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
 * Client-side mirror of the server's `DOCUMENT_CHECKLIST_SATISFIED` guard,
 * **for display only** — the server remains the sole authority, evaluated
 * fresh at `documentsReceived`/`approve` (module doc §4.4, §6.4). A
 * requirement is satisfied by a `VERIFIED` current version on the owner's
 * document of that type.
 *
 * This never claims a transition is blocked; it only renders what the
 * checklist looks like right now, matching the documented rule that the
 * guard is evaluated only at those two specific transitions
 * (`docs/backend-gaps.md` WF1).
 */
export function buildChecklist(
  requirements: readonly DocumentRequirementDto[],
  documents: readonly DocumentDto[],
): ChecklistItem[] {
  const byType = new Map<string, DocumentDto>();
  for (const document of documents) {
    byType.set(document.documentTypeId, document);
  }

  return requirements
    .filter((requirement) => requirement.isActive)
    .map((requirement) => {
      const document = byType.get(requirement.documentTypeId) ?? null;
      return {
        requirement,
        document,
        state: stateFor(document),
      };
    });
}

function stateFor(document: DocumentDto | null): ChecklistItemState {
  if (!document) return "missing";
  if (document.status === "VERIFIED") return "verified";
  if (document.status === "REJECTED") return "rejected";
  return "pending";
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
