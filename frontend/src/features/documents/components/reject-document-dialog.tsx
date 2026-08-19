"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib";
import { ConfirmDialog } from "@/shared/components/overlay";

import { useRejectDocument } from "../hooks/use-documents";
import type { DocumentDto, DocumentOwnerType } from "../types/document.dto";

export interface RejectDocumentDialogProps {
  ownerType: DocumentOwnerType;
  ownerId: string;
  document: DocumentDto | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Reject a document's current version. `reason` is required — DB-enforced,
 * 3–500 chars (module doc §6.3) — never allowed blank from this dialog.
 */
export function RejectDocumentDialog({
  ownerType,
  ownerId,
  document,
  onOpenChange,
}: RejectDocumentDialogProps) {
  const [reason, setReason] = useState("");
  const reject = useRejectDocument(ownerType, ownerId);

  const invalid = reason.trim().length < 3;

  return (
    <ConfirmDialog
      open={document !== null}
      onOpenChange={(open) => {
        if (!open) {
          onOpenChange(false);
          setReason("");
        }
      }}
      destructive
      title="Reject this document?"
      description="The applicant will need to upload a new version. The rejected version is retained in history, never deleted."
      confirmLabel="Reject"
      isPending={reject.isPending}
      onConfirm={async () => {
        if (!document || invalid) return;
        try {
          await reject.mutateAsync({ documentId: document.id, reason: reason.trim() });
          onOpenChange(false);
          setReason("");
        } catch (error) {
          toast.error(getErrorMessage(error));
        }
      }}
    >
      <div className="space-y-2">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={reject.isPending}
          placeholder="Why is this document being rejected? (required)"
          aria-label="Rejection reason"
        />
        {reason.length > 0 && invalid ? (
          <p className="text-destructive text-xs">
            At least 3 characters are required.
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
