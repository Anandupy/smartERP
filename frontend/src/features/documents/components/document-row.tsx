"use client";

import { useRef } from "react";

import {
  Check,
  CircleDot,
  Download,
  RefreshCw,
  Upload,
  X,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/shared/components/data-display";

import { SCAN_STATUS_LABEL, SCAN_STATUS_TONE } from "../constants";
import { useDownloadDocument, useVerifyDocument } from "../hooks/use-documents";
import type { DocumentOwnerType } from "../types/document.dto";
import type { ChecklistItem } from "../utils/checklist";
import { DocumentStatusBadge } from "./document-status-badge";

export interface DocumentRowProps {
  item: ChecklistItem;
  ownerType: DocumentOwnerType;
  ownerId: string;
  onUpload: () => void;
  onReplace: (file: File) => void;
  onReject: () => void;
}

/**
 * One document requirement, and its current satisfying document if any.
 *
 * Status is never colour alone (AGENTS.md §18): the leading glyph is
 * decorative, but `DocumentStatusBadge` always carries the text label too.
 */
export function DocumentRow({
  item,
  ownerType,
  ownerId,
  onUpload,
  onReplace,
  onReject,
}: DocumentRowProps) {
  const { requirement, document, state } = item;
  const verify = useVerifyDocument(ownerType, ownerId);
  const download = useDownloadDocument();
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const typeName = requirement.documentType?.name ?? "Document";
  const scanStatus = document?.currentVersion?.scanStatus;

  return (
    <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <StateIcon state={state} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {typeName}
            {!requirement.isMandatory ? (
              <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                (optional)
              </span>
            ) : null}
          </p>
          {document?.currentVersion ? (
            <p className="text-muted-foreground truncate text-xs">
              Version {document.currentVersion.versionNumber}
              {document.currentVersion.rejectionReason
                ? ` — ${document.currentVersion.rejectionReason}`
                : ""}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">Not uploaded</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {document ? <DocumentStatusBadge status={document.status} /> : null}
        {scanStatus && scanStatus !== "CLEAN" ? (
          <StatusBadge tone={SCAN_STATUS_TONE[scanStatus]}>
            {SCAN_STATUS_LABEL[scanStatus]}
          </StatusBadge>
        ) : null}

        {!document ? (
          <Button type="button" size="sm" variant="outline" onClick={onUpload}>
            <Upload className="size-3.5" />
            Upload
          </Button>
        ) : (
          <>
            {document.status === "PENDING" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={verify.isPending}
                onClick={() => verify.mutate(document.id)}
              >
                <Check className="size-3.5" />
                Verify
              </Button>
            ) : null}
            {document.status !== "REJECTED" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={onReject}
              >
                <X className="size-3.5" />
                Reject
              </Button>
            ) : null}
            <input
              ref={replaceInputRef}
              type="file"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onReplace(file);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => replaceInputRef.current?.click()}
            >
              <RefreshCw className="size-3.5" />
              Replace
            </Button>
            {scanStatus === "CLEAN" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={download.isPending}
                onClick={() =>
                  download.mutate({
                    documentId: document.id,
                    filename: `${typeName}-v${document.currentVersion?.versionNumber ?? 1}`,
                  })
                }
              >
                <Download className="size-3.5" />
                Download
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function StateIcon({ state }: { state: ChecklistItem["state"] }) {
  switch (state) {
    case "verified":
      return (
        <Check
          aria-hidden="true"
          className="text-chart-2 size-4 shrink-0"
        />
      );
    case "pending":
      return (
        <CircleDot
          aria-hidden="true"
          className="text-chart-4 size-4 shrink-0"
        />
      );
    case "rejected":
      return (
        <X
          aria-hidden="true"
          className="text-destructive size-4 shrink-0"
        />
      );
    case "missing":
      return (
        <CircleDot
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
        />
      );
  }
}
