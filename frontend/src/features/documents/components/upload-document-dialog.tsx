"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import { useUploadDocument } from "../hooks/use-documents";
import type { DocumentOwnerType, DocumentTypeDto } from "../types/document.dto";

export interface UploadDocumentDialogProps {
  ownerType: DocumentOwnerType;
  ownerId: string;
  /** Preselected when opened for one specific checklist row; omitted for a free upload. */
  documentType: DocumentTypeDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Upload a document — always backend-mediated multipart, never a direct
 * storage URL (module doc §6.5). Uploading again for the same owner+type
 * becomes a new version automatically; this dialog does not need to know
 * whether one already exists.
 */
export function UploadDocumentDialog({
  ownerType,
  ownerId,
  documentType,
  open,
  onOpenChange,
}: UploadDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadDocument(ownerType, ownerId);

  const close = () => {
    onOpenChange(false);
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Upload {documentType?.name ?? "document"}
          </DialogTitle>
          <DialogDescription>
            {documentType?.allowedMimeTypes?.length
              ? `Accepted formats: ${documentType.allowedMimeTypes.join(", ")}.`
              : "The file is encrypted, scanned and versioned once uploaded."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="document-file">File</Label>
          <Input
            id="document-file"
            type="file"
            accept={documentType?.allowedMimeTypes?.join(",")}
            disabled={upload.isPending}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={upload.isPending}
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!file || !documentType || upload.isPending}
            onClick={async () => {
              if (!file || !documentType) return;
              try {
                await upload.mutateAsync({
                  file,
                  documentTypeId: documentType.id,
                });
                close();
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            }}
          >
            {upload.isPending ? <Spinner size="sm" label="Uploading" /> : null}
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
