"use client";

import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
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
import { getErrorMessage } from "@/lib";
import { BackendPendingNote, Spinner } from "@/shared/components/feedback";

import { NUMBERING_PURPOSES } from "../types/numbering.dto";
import { purposeLabel } from "../constants";
import {
  numberingConfigFormSchema,
  type NumberingConfigFormValues,
} from "../schemas/numbering.schema";

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

  const form = useZodForm(numberingConfigFormSchema, {
    defaultValues,
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const boundToFields = applyServerFieldErrors(error, form.setError);
      if (!boundToFields) setSubmitError(error);
    }
  });

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError ? (
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
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="prefix"
              label="Prefix"
              description="Optional. e.g. STU"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="suffix"
              label="Suffix"
              description="Optional."
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="sequencePadding"
              type="number"
              label="Sequence padding"
              description="How many digits the sequence number is padded to."
              disabled={isSubmitting}
            />
            <div className="sm:col-span-2">
              <TextField
                control={form.control}
                name="format"
                label="Format"
                description="Must include {sequence}. Other placeholders: {prefix}, {suffix}, {year}, {branchCode}."
                disabled={isSubmitting}
              />
            </div>
            <SwitchField
              control={form.control}
              name="includeBranchCode"
              label="Include branch code"
              disabled={isSubmitting}
            />
            <SwitchField
              control={form.control}
              name="includeAcademicYear"
              label="Include academic year"
              disabled={isSubmitting}
            />
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

        <BackendPendingNote>
          the API does not expose whether this sequence has already issued a
          value, so a never-reset sequence&apos;s prefix/padding cannot be
          locked here even though the backend may refuse changing them once
          issued — a rejected save will show the server&apos;s own error.
        </BackendPendingNote>

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
