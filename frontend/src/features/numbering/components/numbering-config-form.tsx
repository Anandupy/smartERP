"use client";

import { useState } from "react";

import { Lock, TriangleAlert } from "@/assets/icons";
import {
  Form,
  SelectField,
  SwitchField,
  TextField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isApiError } from "@/core/api";
import { getErrorMessage } from "@/lib";
import { BackendPendingNote, Spinner } from "@/shared/components/feedback";

import { NUMBERING_PURPOSES, NUMBERING_YEAR_FORMATS } from "../types/numbering.dto";
import { YEAR_FORMAT_EXAMPLE, YEAR_FORMAT_LABEL, purposeLabel } from "../constants";
import {
  numberingConfigFormSchema,
  type NumberingConfigFormValues,
} from "../schemas/numbering.schema";
import { FormatBreakdown } from "./format-breakdown";
import { FormatExplanation } from "./format-explanation";
import { FormatPlaceholderChips } from "./format-placeholder-chips";

/**
 * The error the backend raises when a `NEVER`-reset sequence has already
 * issued a value and the save would have changed what it renders (design
 * spec §12.6). Nothing on `NumberingConfigDto` predicts this ahead of time
 * (`docs/backend-gaps.md` NUM2) — it can only be learned by a rejected save,
 * so the form starts every field editable and locks reactively once told.
 */
const LOCKED_ERROR_CODE = "SEQUENCE_WIDTH_IMMUTABLE";

const YEAR_FORMAT_OPTIONS = NUMBERING_YEAR_FORMATS.map((value) => ({
  value,
  label: YEAR_FORMAT_LABEL[value],
}));

export interface NumberingConfigFormProps {
  defaultValues: NumberingConfigFormValues;
  submitLabel: string;
  onSubmit: (values: NumberingConfigFormValues) => Promise<unknown>;
  onCancel: () => void;
  /** `false` on Create — `purpose` cannot change once a sequence exists. */
  purposeEditable?: boolean;
  /** Hides the Active switch — `POST /numbering/configs` does not document it. */
  showActiveToggle?: boolean;
}

const PURPOSE_OPTIONS = NUMBERING_PURPOSES.map((purpose) => ({
  value: purpose,
  label: purposeLabel(purpose),
}));

/**
 * Create or edit a `NumberingConfig`. `scope`, `allocationMode` and
 * `resetStrategy` are never form fields — the Postman contract states they
 * are derived from `purpose` server-side and cannot be supplied
 * (`docs/numbering-module.md`).
 */
export function NumberingConfigForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  purposeEditable = true,
  showActiveToggle = true,
}: NumberingConfigFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [isLocked, setIsLocked] = useState(false);

  const form = useZodForm(numberingConfigFormSchema, {
    defaultValues,
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      if (isApiError(error) && error.code === LOCKED_ERROR_CODE) {
        // Learned, not guessed (see LOCKED_ERROR_CODE) — from this point the
        // format fields genuinely cannot change, so disabling them stops a
        // second attempt from repeating the same rejected request rather
        // than merely looking disabled while still submitting it.
        setIsLocked(true);
      }
      const boundToFields = applyServerFieldErrors(error, form.setError);
      if (!boundToFields) setSubmitError(error);
    }
  });

  const isSubmitting = form.formState.isSubmitting;
  const isFormatLocked = isSubmitting || isLocked;

  const insertPlaceholder = (token: string) => {
    const current = form.getValues("format") ?? "";
    form.setValue("format", `${current}${token}`, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {isLocked ? (
          <Alert>
            <Lock aria-hidden="true" />
            <AlertTitle>Format is locked</AlertTitle>
            <AlertDescription>
              This sequence has already issued identifiers, so its prefix,
              suffix, format, components and sequence padding can no longer
              change. Only the sequence&apos;s active status stays editable.
            </AlertDescription>
          </Alert>
        ) : submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t save the sequence</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Purpose</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <SelectField
              control={form.control}
              name="purpose"
              label="Purpose"
              options={PURPOSE_OPTIONS}
              placeholder="Select what this sequence numbers…"
              disabled={isSubmitting || !purposeEditable}
              description={
                purposeEditable
                  ? "Scope, allocation mode and reset strategy are derived from this and cannot be set directly."
                  : "Not editable once a sequence exists."
              }
            />
            <BackendPendingNote>
              only `STUDENT_CODE` and `ADMISSION_NO` are confirmed in active
              use by the final admission transaction. The remaining purposes
              are documented in the numbering design spec; whether each is
              live is unconfirmed.
            </BackendPendingNote>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="prefix"
                label="Prefix"
                description="Optional. e.g. STU"
                disabled={isFormatLocked}
              />
              <TextField
                control={form.control}
                name="suffix"
                label="Suffix"
                description="Optional."
                disabled={isFormatLocked}
              />
              <TextField
                control={form.control}
                name="sequencePadding"
                type="number"
                label="Sequence padding"
                description="How many digits the sequence number is padded to."
                disabled={isFormatLocked}
              />
              <SelectField
                control={form.control}
                name="yearFormat"
                label="Year format"
                options={YEAR_FORMAT_OPTIONS}
                disabled={isFormatLocked}
                description={`Only used where the format renders {year}. Example: ${YEAR_FORMAT_EXAMPLE[form.watch("yearFormat")]}`}
              />
            </div>

            <div className="space-y-3">
              <TextField
                control={form.control}
                name="format"
                label="Format"
                description="Must include {sequence}. Each placeholder is usable at most once."
                disabled={isFormatLocked}
              />
              <FormatPlaceholderChips onInsert={insertPlaceholder} disabled={isFormatLocked} />
              <FormatExplanation />
            </div>

            <div className="space-y-2">
              <p className="text-foreground text-sm font-medium">Format preview</p>
              <div className="border-border rounded-lg border p-4">
                <FormatBreakdown
                  format={form.watch("format")}
                  prefix={form.watch("prefix")}
                  suffix={form.watch("suffix")}
                  sequencePadding={Number(form.watch("sequencePadding")) || undefined}
                  yearFormat={form.watch("yearFormat")}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                A structural guide only — the exact generated identifier can be checked with the
                real Preview once this sequence is saved.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SwitchField
                control={form.control}
                name="includeBranchCode"
                label="Include branch code"
                disabled={isFormatLocked}
              />
              <SwitchField
                control={form.control}
                name="includeAcademicYear"
                label="Include academic year"
                disabled={isFormatLocked}
              />
            </div>
          </CardContent>
        </Card>

        {showActiveToggle ? (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <SwitchField
                control={form.control}
                name="isActive"
                label="Active"
                description="Inactive sequences are not documented to refuse allocation — treat this as informational until confirmed otherwise."
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>
        ) : null}

        {!isLocked ? (
          <BackendPendingNote>
            the API does not expose whether this sequence has already issued
            a value, so a never-reset sequence&apos;s format fields cannot be
            locked proactively on load — only once a save is rejected with{" "}
            <code>{LOCKED_ERROR_CODE}</code>, at which point this form locks
            them itself rather than letting a second attempt repeat the same
            rejected request.
          </BackendPendingNote>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" label="Saving" /> : null}
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
