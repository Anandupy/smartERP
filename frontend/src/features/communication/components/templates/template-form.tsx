"use client";

import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
import {
  Form,
  SelectField,
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

import { CATEGORY_OPTIONS, CHANNEL_OPTIONS } from "../../constants";
import {
  templateFormSchema,
  type TemplateFormValues,
} from "../../schemas/template.schema";
import type { CommunicationChannel } from "../../types/template.dto";

const CHANNEL_FIELD_OPTIONS = CHANNEL_OPTIONS.filter(
  (option) => option.value !== "ANY",
);
const TEMPLATE_STATUS_FIELD_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];

/** Whether a channel documents each body field, per the module doc's table (§7). */
function fieldsFor(channel: CommunicationChannel | "") {
  return {
    subject: channel !== "SMS" && channel !== "WHATSAPP",
    bodyHtml: channel === "EMAIL",
  };
}

export interface TemplateFormProps {
  defaultValues: TemplateFormValues;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: TemplateFormValues) => Promise<void>;
  onCancel?: () => void;
  /** Renders a live preview trigger, wired at the screen. */
  previewSlot?: (values: TemplateFormValues) => React.ReactNode;
}

/**
 * The template editor — shared by Create and Edit.
 *
 * Body fields are shown or hidden per channel rather than validated per
 * channel: the backend stores all three body fields for every record
 * regardless of channel, so hiding an inapplicable field is a UI courtesy,
 * never a contract the schema enforces.
 */
export function TemplateForm({
  defaultValues,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
  previewSlot,
}: TemplateFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(templateFormSchema, {
    defaultValues,
    mode: "onSubmit",
  });

  const channel = form.watch("channel");
  const visibility = fieldsFor(channel);

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const boundToFields = applyServerFieldErrors(error, form.setError);
      if (!boundToFields) setSubmitError(error);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t save template</AlertTitle>
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
              name="code"
              label="Code"
              placeholder="PASSWORD_RESET"
              description="Identifies this template alongside its channel, language and version."
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder="Password Reset Request Email"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="language"
              label="Language"
              placeholder="en"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="variablesText"
              label="Variables"
              placeholder="userName, resetLink, minutes"
              description="Comma-separated variable names available to this template."
              disabled={isSubmitting}
            />
            <div className="sm:col-span-2">
              <TextareaField
                control={form.control}
                name="description"
                label="Description"
                rows={2}
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Classification</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="channel"
              label="Channel"
              options={CHANNEL_FIELD_OPTIONS}
              disabled={isSubmitting}
            />
            <SelectField
              control={form.control}
              name="category"
              label="Category"
              options={CATEGORY_OPTIONS}
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            {visibility.subject ? (
              <TextField
                control={form.control}
                name="subject"
                label={channel === "PUSH" || channel === "IN_APP" ? "Title" : "Subject"}
                placeholder="Reset Your Password"
                disabled={isSubmitting}
              />
            ) : null}
            {visibility.bodyHtml ? (
              <TextareaField
                control={form.control}
                name="bodyHtml"
                label="HTML body"
                rows={8}
                description="Primary rendering for the email channel."
                disabled={isSubmitting}
              />
            ) : null}
            <TextareaField
              control={form.control}
              name="bodyText"
              label={channel === "EMAIL" ? "Text body (fallback)" : "Body"}
              rows={channel === "EMAIL" ? 4 : 6}
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 sm:max-w-sm">
            <SelectField
              control={form.control}
              name="status"
              options={TEMPLATE_STATUS_FIELD_OPTIONS}
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {previewSlot ? previewSlot(form.getValues()) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {onCancel ? (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={onCancel}
              >
                Cancel
              </Button>
            ) : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" label="Saving" /> : null}
              {isSubmitting ? "Saving…" : submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
