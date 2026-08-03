"use client";

import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
import {
  Form,
  SelectField,
  TextField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import { ENVIRONMENT_OPTIONS } from "../constants";
import { useUpdateSystemSettings } from "../hooks/use-system-settings";
import {
  toGeneralFormValues,
  toGeneralUpdateRequest,
} from "../mappers/system-settings.mapper";
import {
  generalSettingsFormSchema,
  type GeneralSettingsFormValues,
} from "../schemas/system-settings.schema";
import type { SystemSettingsDto } from "../types/system-settings.dto";

export interface GeneralSettingsFormProps {
  /** The loaded record. Seeds the form and supplies the untouched fields. */
  settings: SystemSettingsDto;
}

/**
 * Product identity and deployment environment.
 *
 * Half of a record edited by two screens, which is why the mutation goes
 * through `toGeneralUpdateRequest`: the backend documents no partial update, so
 * the body is rebuilt complete from `settings` plus these four fields. Editing
 * here can therefore never blank out a support address entered on the other
 * screen.
 *
 * Discard resets to the loaded values rather than to blanks — the form's job is
 * to abandon *edits*, not the configuration.
 */
export function GeneralSettingsForm({ settings }: GeneralSettingsFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const update = useUpdateSystemSettings();

  const defaults = toGeneralFormValues(settings);
  const form = useZodForm(generalSettingsFormSchema, {
    defaultValues: defaults,
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(
    async (values: GeneralSettingsFormValues) => {
      setSubmitError(null);
      try {
        const saved = await update.mutateAsync(
          toGeneralUpdateRequest(settings, values),
        );
        form.reset(toGeneralFormValues(saved));
      } catch (error) {
        const boundToFields = applyServerFieldErrors(error, form.setError);
        if (!boundToFields) setSubmitError(error);
      }
    },
  );

  const isSubmitting = form.formState.isSubmitting;
  const isDirty = form.formState.isDirty;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t save settings</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Product identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="productName"
              label="Product name"
              placeholder="CampusFlow ERP"
              description="Shown across the workspace and in institutional correspondence."
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="productCode"
              label="Product code"
              placeholder="CF-ERP"
              description="Unique internal reference used by support and billing."
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="version"
              label="Version"
              placeholder="1.0.0"
              description="The release tag recorded for this deployment."
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Environment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <SelectField
              control={form.control}
              name="environment"
              label="Deployment environment"
              options={ENVIRONMENT_OPTIONS}
              description="Declares what this installation is. Changing it affects how the deployment identifies itself."
              disabled={isSubmitting}
              className="sm:max-w-sm"
            />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={!isDirty || isSubmitting}
            onClick={() => {
              setSubmitError(null);
              form.reset(defaults);
            }}
          >
            Discard changes
          </Button>
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? <Spinner size="sm" label="Saving" /> : null}
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
