"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";

import { useDocumentRequirements, useDocumentTypes, useOwnerDocuments } from "../hooks/use-documents";
import { buildChecklist } from "../utils/checklist";
import { DocumentChecklist } from "./document-checklist";

export interface ApplicantDocumentsPanelProps {
  applicantId: string;
  programId: string;
  quotaId: string | null;
  categoryId: string | null;
}

/**
 * The Documents section of the Applicant Journey Hub.
 *
 * Requirements are scoped `programId × quotaId × categoryId` — the
 * `admissionType` axis in the original design is not implemented
 * (module doc §6.4). Documents themselves are owned by `ownerType:
 * "APPLICANT", ownerId: applicantId` while the applicant exists; once
 * admitted, the durable copies belong to `PERSON`/`ADMISSION`/`ENROLLMENT`
 * instead — this panel only ever shows the applicant's own.
 */
export function ApplicantDocumentsPanel({
  applicantId,
  programId,
  quotaId,
  categoryId,
}: ApplicantDocumentsPanelProps) {
  const { requirements, isPending: requirementsPending } =
    useDocumentRequirements({
      programId,
      quotaId: quotaId ?? undefined,
      categoryId: categoryId ?? undefined,
    });
  const { documents, isPending: documentsPending, error, refetch } =
    useOwnerDocuments("APPLICANT", applicantId);
  const { types } = useDocumentTypes();

  const documentTypesById = useMemo(() => {
    const map = new Map<string, (typeof types)[number]>();
    for (const type of types) map.set(type.id, type);
    return map;
  }, [types]);

  const checklist = useMemo(() => {
    const withTypeNames = requirements.map((requirement) => ({
      ...requirement,
      documentType: documentTypesById.get(requirement.documentTypeId),
    }));
    return buildChecklist(withTypeNames, documents);
  }, [requirements, documents, documentTypesById]);

  if (requirementsPending || documentsPending) {
    return <p className="text-muted-foreground text-sm">Loading documents…</p>;
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
      items={checklist}
      documentTypesById={documentTypesById}
    />
  );
}
