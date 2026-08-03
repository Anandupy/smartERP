"use client";

import { useState } from "react";

import { Mail, Phone, TriangleAlert } from "@/assets/icons";
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

import { useUpdateSystemSettings } from "../hooks/use-system-settings";
import {
  toMaintenanceFormValues,
  toMaintenanceUpdateRequest,
} from "../mappers/system-settings.mapper";
import {
  maintenanceSupportFormSchema,
  type MaintenanceSupportFormValues,
} from "../schemas/system-settings.schema";
import type { SystemSettingsDto } from "../types/system-settings.dto";

export interface MaintenanceSupportFormProps {
  settings: SystemSettingsDto;
}

/**
 * System-wide maintenance mode and the support channels shown alongside it.
 *
 * This is the *global* switch — one flag on the settings record that takes the
 * whole installation offline. Targeted downtime (one branch, one module, a
 * recurring window) is a different contract entirely and lives in the
 * Maintenance module; the copy here says so, because two screens with the word
 * "maintenance" in the title is exactly where an operator turns off more than
 * they meant to.
 *
 * Turning the switch on is not confirmed here: nothing takes effect until the
 * form is saved, and a confirmation before a change that has not happened yet
 * teaches people to dismiss confirmations.
 */
export function MaintenanceSupportForm({
  settings,
}: MaintenanceSupportFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const update = useUpdateSystemSettings();

  const defaults = toMaintenanceFormValues(settings);
  const form = useZodForm(maintenanceSupportFormSchema, {
    defaultValues: defaults,
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(
    async (values: MaintenanceSupportFormValues) => {
      setSubmitError(null);
      try {
        const saved = await update.mutateAsync(
          toMaintenanceUpdateRequest(settings, values),
        );
        form.reset(toMaintenanceFormValues(saved));
      } catch (error) {
        const boundToFields = applyServerFieldErrors(error, form.setError);
        if (!boundToFields) setSubmitError(error);
      }
    },
  );

  const isSubmitting = form.formState.isSubmitting;
  const isDirty = form.formState.isDirty;
  const willEnable = form.watch("maintenanceMode") && !settings.maintenanceMode;

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
            <CardTitle>Maintenance mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <SwitchField
              control={form.control}
              name="maintenanceMode"
              label="Put the system into maintenance"
              description="Applies to the entire installation. For a single campus, module or scheduled window, create a rule in Maintenance instead."
              disabled={isSubmitting}
            />

            {willEnable ? (
              <Alert>
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>This will affect everyone</AlertTitle>
                <AlertDescription>
                  Saving takes the whole installation into maintenance. The
                  message below is what users will see.
                </AlertDescription>
              </Alert>
            ) : null}

            <TextareaField
              control={form.control}
              name="maintenanceMessage"
              label="Maintenance message"
              placeholder="We're carrying out scheduled maintenance and will be back shortly."
              description="Optional. Shown while maintenance mode is on; leave empty for no message."
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Support &amp; contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="supportEmail"
              type="email"
              label="Support email"
              placeholder="support@campusflow.io"
              startIcon={<Mail />}
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="supportPhone"
              type="tel"
              label="Support phone"
              placeholder="1800123456"
              startIcon={<Phone />}
              disabled={isSubmitting}
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
