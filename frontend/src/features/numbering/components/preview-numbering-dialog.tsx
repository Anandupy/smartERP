"use client";

import { Eye } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { purposeLabel } from "../constants";
import type { NumberingConfigDto } from "../types/numbering.dto";
import { NumberingPreviewPanel } from "./numbering-preview-panel";

export interface PreviewNumberingDialogProps {
  config: NumberingConfigDto | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Quick-access Preview from the directory. Wraps `NumberingPreviewPanel` —
 * the same panel embedded inline on the Edit screen — in a dialog, so a
 * sample can be checked without leaving the list.
 */
export function PreviewNumberingDialog({ config, onOpenChange }: PreviewNumberingDialogProps) {
  return (
    <Dialog open={config !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye aria-hidden="true" className="size-4" />
            Preview {config ? purposeLabel(config.purpose) : ""}
          </DialogTitle>
          <DialogDescription>
            Renders a sample from the current format. No number is consumed.
          </DialogDescription>
        </DialogHeader>

        {config ? <PreviewNumberingDialogBody config={config} /> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Isolates the panel's `usePreviewNumbering(config.id)` call to a component
 * that only mounts once a config is chosen — the id is never `""`.
 */
function PreviewNumberingDialogBody({ config }: { config: NumberingConfigDto }) {
  return <NumberingPreviewPanel config={config} />;
}
