"use client";

import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
import {
  Form,
  SwitchField,
  TextField,
  TextareaField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import {
  documentTypeFormSchema,
  type DocumentTypeFormValues,
} from "../schemas/document-type.schema";
import { MimeTypesField } from "./mime-types-field";

export interface DocumentTypeFormProps {
  defaultValues: DocumentTypeFormValues;
  submitLabel: string;
  onSubmit: (values: DocumentTypeFormValues) => Promise<unknown>;
  onCancel: () => void;
  /**
   * Hides the Active switch. `POST /document-types` does not document
   * `isActive` (a new type is always created active), so Create renders
   * without it rather than showing a control the request never sends.
   * Defaults to `true` for Edit, where `PATCH` does document the field.
   */
  showActiveToggle?: boolean;
}

/**
 * Create or edit a `DocumentType`. Create and Update take an identical
 * documented body (`docs/documents-management-module.md`), so one form
 * covers both.
 *
 * Sections mirror the design spec's field grouping (§7): identity, security &
 * lifecycle, file rules, and display/status.
 */
export function DocumentTypeForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  showActiveToggle = true,
}: DocumentTypeFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(documentTypeFormSchema, {
    defaultValues,
    mode: "onSubmit",
  });

  const hasExpiry = form.watch("hasExpiry");

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
            <AlertTitle>Couldn&apos;t save the document type</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Basic information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="code"
              label="Code"
              placeholder="BIRTH_CERTIFICATE"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder="e.g. Birth Certificate"
              disabled={isSubmitting}
            />
            <div className="sm:col-span-2">
              <TextareaField
                control={form.control}
                name="description"
                label="Description"
                description="Optional."
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Security &amp; lifecycle</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <SwitchField
              control={form.control}
              name="isSensitive"
              label="Sensitive document"
              description="Restricts download to staff above the base role — sensitive types refuse STAFF downloads."
              disabled={isSubmitting}
              className="sm:col-span-2"
            />
            <SwitchField
              control={form.control}
              name="hasExpiry"
              label="Has expiry"
              description="Derives a document's expiry date from its upload date plus the default validity below."
              disabled={isSubmitting}
              className="sm:col-span-2"
            />
            {hasExpiry ? (
              <TextField
                control={form.control}
                name="defaultValidityMonths"
                type="number"
                label="Default validity (months)"
                disabled={isSubmitting}
              />
            ) : null}
            <TextField
              control={form.control}
              name="retentionYears"
              type="number"
              label="Retention period (years)"
              description="Not yet enforced by any automated sweep — recorded for future use."
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>File rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            <MimeTypesField control={form.control} name="allowedMimeTypes" disabled={isSubmitting} />
            <TextField
              control={form.control}
              name="maxSizeBytes"
              type="number"
              label="Maximum file size (bytes)"
              description="1 KiB – 50 MiB. The server enforces this independently on upload."
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Display</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="displayOrder"
              type="number"
              label="Display order"
              description="Controls ordering in lists and upload pickers."
              disabled={isSubmitting}
            />
            {showActiveToggle ? (
              <SwitchField
                control={form.control}
                name="isActive"
                label="Active"
                description="Available for selection on new requirements and uploads."
                disabled={isSubmitting}
              />
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
          >
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
