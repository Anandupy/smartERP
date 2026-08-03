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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export interface InitializeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * First-time initialization of the global configuration.
 *
 * Deliberately a dialog on the empty state rather than a screen of its own: it
 * runs once in the lifetime of an installation, and a permanent route to an
 * endpoint that will refuse every call after the first is a route that only
 * ever produces errors.
 *
 * The form covers the whole documented body because `POST /system-settings/init`
 * takes the whole record. Fields start blank — pre-filling with the Postman
 * sample would put "CampusFlow ERP / CF-ERP" into a real institution's
 * configuration by default.
 */
export function InitializeSettingsDialog({
  open,
  onOpenChange,
}: InitializeSettingsDialogProps) {
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
        await initialize.mutateAsync(toInitRequest(values));
        onOpenChange(false);
      } catch (error) {
        const boundToFields = applyServerFieldErrors(error, form.setError);
        if (!boundToFields) setSubmitError(error);
      }
    },
  );

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Initialize system settings</DialogTitle>
          <DialogDescription>
            This establishes the installation&apos;s global configuration and
            can only be done once.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {submitError ? (
              <Alert variant="destructive">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>Initialization failed</AlertTitle>
                <AlertDescription>
                  {getErrorMessage(submitError)}
                </AlertDescription>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Spinner size="sm" label="Initializing" />
                ) : null}
                {isSubmitting ? "Initializing…" : "Initialize"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
