"use client";

import { useState } from "react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/core/workspace";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import { purposeLabel } from "../constants";
import { usePreviewNumbering } from "../hooks/use-numbering";
import type { NumberingConfigDto } from "../types/numbering.dto";

export interface PreviewNumberingDialogProps {
  config: NumberingConfigDto | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Renders a sample identifier without consuming a real number — the whole
 * reason `POST /numbering/configs/:id/preview` exists (design spec §7): so
 * a format change can be checked without burning a value. Never reproduces
 * the numbering algorithm locally; always calls the real endpoint.
 */
export function PreviewNumberingDialog({ config, onOpenChange }: PreviewNumberingDialogProps) {
  const [sampleValue, setSampleValue] = useState("123");
  const preview = usePreviewNumbering(config?.id ?? "");
  const { academicYear } = useWorkspace();

  const close = () => {
    onOpenChange(false);
    preview.reset();
  };

  return (
    <Dialog open={config !== null} onOpenChange={(open) => (open ? onOpenChange(open) : close())}>
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

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="preview-sample">Sample sequence value</Label>
            <Input
              id="preview-sample"
              type="number"
              min={1}
              value={sampleValue}
              onChange={(event) => setSampleValue(event.target.value)}
              disabled={preview.isPending}
            />
          </div>

          {preview.data ? (
            <div className="border-border bg-muted/40 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Rendered result</p>
              <p className="font-mono text-lg font-medium">{preview.data.rendered}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={preview.isPending} onClick={close}>
            Close
          </Button>
          <Button
            type="button"
            disabled={preview.isPending || !config}
            onClick={async () => {
              if (!config) return;
              const parsed = Number(sampleValue);
              if (!Number.isFinite(parsed) || parsed < 1) {
                toast.error("Enter a sample sequence value of 1 or more");
                return;
              }
              try {
                await preview.mutateAsync({
                  sampleValue: parsed,
                  academicYearId: config.includeAcademicYear ? (academicYear?.id ?? undefined) : undefined,
                });
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            }}
          >
            {preview.isPending ? <Spinner size="sm" label="Rendering" /> : null}
            {preview.isPending ? "Rendering…" : "Render preview"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
