"use client";

import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
import {
  Form,
  SelectField,
  SwitchField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import { useDocumentTypes } from "../hooks/use-documents";
import {
  documentRequirementFormSchema,
  type DocumentRequirementFormValues,
} from "../schemas/document-requirement.schema";

export interface DocumentRequirementFormProps {
  defaultValues: DocumentRequirementFormValues;
  submitLabel: string;
  onSubmit: (values: DocumentRequirementFormValues) => Promise<unknown>;
  onCancel: () => void;
  /**
   * Slots filled by the route composition (AGENTS.md §28) — this feature
   * never imports Program or Admission Masters directly.
   */
  programPicker: React.ReactNode;
  quotaPicker: React.ReactNode;
  categoryPicker: React.ReactNode;
  stageOptions: readonly { value: string; label: string }[];
}

/**
 * Create or edit a `DocumentRequirement`. Create and Update take almost
 * identical documented bodies — Update additionally accepts `isActive`
 * (see the mapper) — so one form covers both; the caller decides which
 * mapper function to call.
 */
export function DocumentRequirementForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  programPicker,
  quotaPicker,
  categoryPicker,
  stageOptions,
}: DocumentRequirementFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const { types, isPending: typesPending } = useDocumentTypes();

  const form = useZodForm(documentRequirementFormSchema, {
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

  const documentTypeOptions = types
    .filter((type) => type.isActive)
    .map((type) => ({ value: type.id, label: type.name, hint: type.code }));

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t save the requirement</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Requirement</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="documentTypeId"
              label="Document type"
              options={documentTypeOptions}
              placeholder={typesPending ? "Loading document types…" : "Select document type…"}
              disabled={isSubmitting || typesPending}
              className="sm:col-span-2"
            />
            <SelectField
              control={form.control}
              name="requiredByStage"
              label="Required by stage"
              options={stageOptions}
              placeholder="Select stage…"
              disabled={isSubmitting}
              description="The applicant status this document must be verified by."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Applies to</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-3">
            {programPicker}
            {quotaPicker}
            {categoryPicker}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <SwitchField
              control={form.control}
              name="isMandatory"
              label="Mandatory"
              description="Counts toward the required-documents checklist. Optional documents are still requested but never block a transition."
              disabled={isSubmitting}
            />
            <SwitchField
              control={form.control}
              name="isActive"
              label="Active"
              description="Applied to new checklists. Existing checklists are unaffected until recomputed."
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

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
