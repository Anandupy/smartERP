"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";

import { useDocumentRequirements, useDocumentTypes, useOwnerDocuments } from "../hooks/use-documents";
import {
  checklistFromServer,
  type ServerChecklistItem,
} from "../utils/checklist";
import { DocumentChecklist } from "./document-checklist";

export interface ApplicantDocumentsPanelProps {
  applicantId: string;
  /**
   * The applicant's checklist as the backend computes it — which
   * requirements bind this applicant and where each stands. Supplied by the
   * route composition from Admissions' checklist read, as plain data.
   */
  checklist: readonly ServerChecklistItem[] | undefined;
  checklistPending: boolean;
  checklistError: unknown;
  onRetryChecklist: () => void;
}

/**
 * The Documents section of the Applicant Journey Hub.
 *
 * Which requirements apply — organization-wide or this branch's, matched on
 * programme, quota and category — is the backend's answer, never computed
 * here (see `checklistFromServer`). Documents themselves are owned by `ownerType:
 * "APPLICANT", ownerId: applicantId` while the applicant exists; once
 * admitted, the durable copies belong to `PERSON`/`ADMISSION`/`ENROLLMENT`
 * instead — this panel only ever shows the applicant's own.
 */
export function ApplicantDocumentsPanel({
  applicantId,
  checklist,
  checklistPending,
  checklistError,
  onRetryChecklist,
}: ApplicantDocumentsPanelProps) {
  const { requirements, isPending: requirementsPending } =
    useDocumentRequirements();
  const { documents, isPending: documentsPending, error, refetch } =
    useOwnerDocuments("APPLICANT", applicantId);
  const { types } = useDocumentTypes();

  const documentTypesById = useMemo(() => {
    const map = new Map<string, (typeof types)[number]>();
    for (const type of types) map.set(type.id, type);
    return map;
  }, [types]);

  const items = useMemo(() => {
    const withTypeNames = requirements.map((requirement) => ({
      ...requirement,
      documentType: documentTypesById.get(requirement.documentTypeId),
    }));
    return checklistFromServer(checklist ?? [], withTypeNames, documents);
  }, [checklist, requirements, documents, documentTypesById]);

  if (requirementsPending || documentsPending || checklistPending) {
    return <p className="text-muted-foreground text-sm">Loading documents…</p>;
  }

  if (checklistError) {
    return (
      <div className="space-y-2">
        <p className="text-destructive text-sm">
          The document checklist could not be loaded.
        </p>
        <Button type="button" variant="outline" onClick={onRetryChecklist}>
          Retry
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-destructive text-sm">
          Documents could not be loaded.
        </p>
        <Button type="button" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <DocumentChecklist
      ownerType="APPLICANT"
      ownerId={applicantId}
      items={items}
      documentTypesById={documentTypesById}
    />
  );
}
