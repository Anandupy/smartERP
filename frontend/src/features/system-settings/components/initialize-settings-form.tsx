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
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import { ENVIRONMENT_OPTIONS } from "../constants";
import { useInitializeSystemSettings } from "../hooks/use-system-settings";
import { toInitRequest } from "../mappers/system-settings.mapper";
import {
  initSettingsFormDefaults,
  initSettingsFormSchema,
  type InitSettingsFormValues,
} from "../schemas/system-settings.schema";
import type { SystemSettingsDto } from "../types/system-settings.dto";

export interface InitializeSettingsFormProps {
  onSubmitted?: (settings: SystemSettingsDto) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}

/**
 * The whole documented body of `POST /system-settings/init`, extracted from
 * `InitializeSettingsDialog` so the setup wizard's System Settings step can
 * render the same form on a page instead of duplicating it — the dialog is
 * now a thin wrapper around this.
 *
 * Fields start blank — pre-filling with the Postman sample would put
 * "CampusFlow ERP / CF-ERP" into a real institution's configuration by
 * default.
 */
export function InitializeSettingsForm({
  onSubmitted,
  onCancel,
  submitLabel = "Initialize",
  cancelLabel = "Cancel",
}: InitializeSettingsFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const initialize = useInitializeSystemSettings();

  const form = useZodForm(initSettingsFormSchema, {
    defaultValues: initSettingsFormDefaults,
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(
    async (values: InitSettingsFormValues) => {
      setSubmitError(null);
      try {
        const settings = await initialize.mutateAsync(toInitRequest(values));
        onSubmitted?.(settings);
      } catch (error) {
        const boundToFields = applyServerFieldErrors(error, form.setError);
        if (!boundToFields) setSubmitError(error);
      }
    },
  );

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Initialization failed</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="productName"
            label="Product name"
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="productCode"
            label="Product code"
            description="Must be unique."
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="version"
            label="Version"
            disabled={isSubmitting}
          />
          <SelectField
            control={form.control}
            name="environment"
            label="Environment"
            options={ENVIRONMENT_OPTIONS}
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="supportEmail"
            type="email"
            label="Support email"
            disabled={isSubmitting}
          />
          <TextField
            control={form.control}
            name="supportPhone"
            type="tel"
            label="Support phone"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Spinner size="sm" label="Initializing" />
            ) : null}
            {isSubmitting ? "Initializing…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
