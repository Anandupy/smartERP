"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Progress } from "@/components/ui/progress";
import { getErrorMessage } from "@/lib";

import { useReplaceDocument } from "../hooks/use-documents";
import type { DocumentDto, DocumentOwnerType, DocumentTypeDto } from "../types/document.dto";
import { checklistSummary, type ChecklistItem } from "../utils/checklist";
import { DocumentRow } from "./document-row";
import { RejectDocumentDialog } from "./reject-document-dialog";
import { UploadDocumentDialog } from "./upload-document-dialog";

export interface DocumentChecklistProps {
  ownerType: DocumentOwnerType;
  ownerId: string;
  items: ChecklistItem[];
  documentTypesById: ReadonlyMap<string, DocumentTypeDto>;
}

/**
 * The required-documents checklist — required/optional, current version,
 * verification status, and the actions each row supports.
 *
 * The completion figure is computed here, from the array this screen already
 * loaded — never a fabricated "N of M" field the backend does not document
 * (`docs/backend-gaps.md` DOC4).
 */
export function DocumentChecklist({
  ownerType,
  ownerId,
  items,
  documentTypesById,
}: DocumentChecklistProps) {
  const [uploadingType, setUploadingType] = useState<DocumentTypeDto | null>(
    null,
  );
  const [rejecting, setRejecting] = useState<DocumentDto | null>(null);
  const replace = useReplaceDocument(ownerType, ownerId);

  const summary = checklistSummary(items);

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No document requirements are configured for this program, quota and
        category.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span>
            {summary.verified} of {summary.total} required documents verified
          </span>
          {summary.isSatisfied ? (
            <span className="text-chart-2 font-medium">Complete</span>
          ) : null}
        </div>
        <Progress
          value={summary.total > 0 ? (summary.verified / summary.total) * 100 : 0}
        />
      </div>

      <div>
        {items.map((item) => (
          <DocumentRow
            key={item.requirement.id}
            item={item}
            ownerType={ownerType}
            ownerId={ownerId}
            onUpload={() => {
              const type = documentTypesById.get(item.requirement.documentTypeId);
              if (type) setUploadingType(type);
            }}
            onReplace={async (file) => {
              if (!item.document) return;
              try {
                await replace.mutateAsync({ documentId: item.document.id, file });
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            }}
            onReject={() => item.document && setRejecting(item.document)}
          />
        ))}
      </div>

      <UploadDocumentDialog
        ownerType={ownerType}
        ownerId={ownerId}
        documentType={uploadingType}
        open={uploadingType !== null}
        onOpenChange={(open) => {
          if (!open) setUploadingType(null);
        }}
      />

      <RejectDocumentDialog
        ownerType={ownerType}
        ownerId={ownerId}
        document={rejecting}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
      />
    </div>
  );
}
