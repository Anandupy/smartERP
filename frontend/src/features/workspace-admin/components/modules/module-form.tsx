"use client";

import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
import {
  Form,
  TextField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib";
import { Spinner } from "@/shared/components/feedback";

import { ICON_NAME_OPTIONS, UNKNOWN_ICON } from "../../constants";
import { moduleFormSchema, type ModuleFormValues } from "../../schemas/module.schema";

export interface ModuleFormProps {
  defaultValues: ModuleFormValues;
  submitLabel: string;
  onSubmit: (values: ModuleFormValues) => Promise<unknown>;
  onCancel: () => void;
  /** System modules ship with the product: `create-module.dto.ts`'s validator still applies, but the code should not invite a rename. */
  lockCode?: boolean;
}

/**
 * Create or edit a module.
 *
 * The five fields are exactly what `CreateModuleDto`/`UpdateModuleDto` accept
 * — no route, no status (that is the separate `PATCH .../status` action), no
 * feature-flag block, because none of those exist on the module contract.
 */
export function ModuleForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  lockCode = false,
}: ModuleFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(moduleFormSchema, {
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
  const icon = form.watch("icon");
  const iconKey = icon.trim().toLowerCase();
  const Icon = ICON_NAME_OPTIONS[iconKey] ?? UNKNOWN_ICON;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t save the module</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="name"
              label="Module name"
              placeholder="Hostel Management"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="code"
              label="Code"
              placeholder="HOSTEL"
              description="Uppercase letters, numbers and underscores only. Unique."
              disabled={isSubmitting || lockCode}
            />
            <div className="space-y-2 sm:col-span-2">
              <TextField
                control={form.control}
                name="description"
                label="Description"
                placeholder="Student hostel accommodation & room allocation management"
                description="Optional."
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Presentation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <div className="flex items-end gap-3">
              <span
                aria-hidden="true"
                className="bg-primary/10 text-primary mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg"
              >
                <Icon className="size-5" />
              </span>
              <div className="flex-1">
                <TextField
                  control={form.control}
                  name="icon"
                  label="Icon name"
                  placeholder="home"
                  description="Optional. A recognized name renders a preview glyph; anything else falls back to a neutral one."
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <TextField
              control={form.control}
              name="displayOrder"
              type="number"
              label="Display order"
              description="Lower numbers sort first."
              disabled={isSubmitting}
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
