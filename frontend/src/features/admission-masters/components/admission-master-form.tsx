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

import type { AdmissionMasterConfig } from "../config/admission-master-registry";
import {
  admissionMasterFormSchema,
  type AdmissionMasterFormValues,
} from "../schemas/admission-master.schema";

export interface AdmissionMasterFormProps {
  config: AdmissionMasterConfig;
  defaultValues: AdmissionMasterFormValues;
  submitLabel: string;
  onSubmit: (values: AdmissionMasterFormValues) => Promise<unknown>;
  onCancel: () => void;
}

/**
 * Create or edit a record of one admission master.
 *
 * One form for both, because create and update take an identical documented
 * body — the difference is only which mutation the route hands in.
 *
 * Fields are exactly the five the Postman requests define plus `isActive`:
 * Code, Name, Description, Display order, Active. `metadata` is
 * deliberately never exposed here — see the module `index.ts`.
 */
export function AdmissionMasterForm({
  config,
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: AdmissionMasterFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(admissionMasterFormSchema, {
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
            <AlertTitle>
              Couldn&apos;t save the {config.singularLabel.toLowerCase()}
            </AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="code"
              label="Code"
              placeholder="HHS-001"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder={`e.g. ${config.singularLabel}`}
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="displayOrder"
              type="number"
              label="Display order"
              description="Controls ordering in lists and pickers."
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
            <SwitchField
              control={form.control}
              name="isActive"
              label="Active"
              description="Available for selection on new admission records."
              disabled={isSubmitting}
              className="sm:col-span-2"
            />
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
