"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/core/workspace";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import { YEAR_FORMAT_LABEL } from "../constants";
import { usePreviewNumbering } from "../hooks/use-numbering";
import type { NumberingConfigDto } from "../types/numbering.dto";

/**
 * Whether this format needs an academic year to render — the same
 * `includeAcademicYear || format.includes('{year}')` test the allocator
 * itself uses (design spec §12.4), so a format that embeds `{year}` without
 * the flag set still gets one supplied.
 */
function needsAcademicYear(config: NumberingConfigDto): boolean {
  return config.includeAcademicYear || config.format.includes("{year}");
}

export interface NumberingPreviewPanelProps {
  config: NumberingConfigDto;
  /** Rendered above the result box. Defaults to the standard explanation. */
  description?: React.ReactNode;
}

/**
 * Renders a sample identifier without consuming a real number — the whole
 * reason `POST /numbering/configs/:id/preview` exists (design spec §7): so a
 * format change can be checked without burning a value. Never reproduces the
 * numbering algorithm locally; always calls the real endpoint.
 *
 * Shared by `PreviewNumberingDialog` (quick action from the directory) and
 * `EditNumberingConfigScreen` (embedded inline, so preview reads as a first-
 * class part of the configuration screen rather than a separate action).
 */
export function NumberingPreviewPanel({ config, description }: NumberingPreviewPanelProps) {
  const [sampleValue, setSampleValue] = useState("123");
  const preview = usePreviewNumbering(config.id);
  const { academicYear } = useWorkspace();

  const render = async () => {
    const parsed = Number(sampleValue);
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error("Enter a sample sequence value of 1 or more");
      return;
    }
    if (needsAcademicYear(config) && !academicYear) {
      toast.error(
        "This format renders a year. Select an academic year in your workspace to preview it.",
      );
      return;
    }
    try {
      await preview.mutateAsync({
        sampleValue: parsed,
        academicYearId: needsAcademicYear(config) ? (academicYear?.id ?? undefined) : undefined,
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {description ??
          "This is an example of how the configured identifier will appear. No number is consumed."}
      </p>

      <div
        className="border-border bg-muted/30 flex min-h-28 flex-col items-center justify-center gap-1 rounded-xl border px-4 py-8 text-center"
        aria-live="polite"
      >
        {preview.data ? (
          <p className="font-mono text-2xl font-semibold tracking-wide break-all sm:text-3xl">
            {preview.data.rendered}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            {preview.isPending ? "Rendering…" : "Render a preview to see an example identifier."}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor={`preview-sample-${config.id}`}>Sample sequence value</Label>
          <Input
            id={`preview-sample-${config.id}`}
            type="number"
            min={1}
            value={sampleValue}
            onChange={(event) => setSampleValue(event.target.value)}
            disabled={preview.isPending}
          />
        </div>
        <Button type="button" disabled={preview.isPending} onClick={render}>
          {preview.isPending ? <Spinner size="sm" label="Rendering" /> : null}
          {preview.isPending ? "Rendering…" : "Render preview"}
        </Button>
      </div>

      {needsAcademicYear(config) ? (
        <p className="text-muted-foreground text-xs">
          Year format: {YEAR_FORMAT_LABEL[config.yearFormat]}
          {academicYear ? ` — using ${academicYear.name}` : " — no academic year selected"}
        </p>
      ) : null}
    </div>
  );
}
