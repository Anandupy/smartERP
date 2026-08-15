"use client";

import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
import {
  CheckboxField,
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
import { Banner, Spinner } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from "../../constants";
import { useCommunicationScope } from "../../hooks/use-communication-scope";
import { useSendNotification } from "../../hooks/use-send-notification";
import {
  sendNotificationFormDefaults,
  sendNotificationFormSchema,
  type SendNotificationFormValues,
} from "../../schemas/notification.schema";
import { CommunicationNoScopeState } from "../communication-scope-gate";

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseMetadata(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Send Notification — `POST /communication/notifications`, documented as
 * "Create an In-app Notification (Admin/Service Use)".
 *
 * This is a **single-recipient** write: `userId` is required, and no
 * broadcast, campaign or multi-channel send endpoint exists anywhere in the
 * collection (see `docs/communication-module-ui-spec.md` §0). The banner
 * below states this plainly rather than letting the screen imply a wider
 * reach than the API can deliver.
 */
export function SendNotificationScreen() {
  const scope = useCommunicationScope();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const send = useSendNotification();

  const form = useZodForm(sendNotificationFormSchema, {
    defaultValues: sendNotificationFormDefaults(),
    mode: "onSubmit",
  });

  if (!scope) {
    return (
      <div className="space-y-6">
        <PageHeader title="Send Notification" />
        <CommunicationNoScopeState />
      </div>
    );
  }

  const handleSubmit = form.handleSubmit(
    async (values: SendNotificationFormValues) => {
      setSubmitError(null);
      try {
        await send.mutateAsync({
          userId: values.userId.trim(),
          title: values.title.trim(),
          content: values.content.trim(),
          category: values.category,
          priority: values.priority,
          actionUrl: optional(values.actionUrl),
          metadata: parseMetadata(values.metadataText),
          isPinned: values.isPinned,
          organizationId: scope.organizationId,
          branchId: scope.branchId,
        });
        form.reset(sendNotificationFormDefaults());
      } catch (error) {
        const boundToFields = applyServerFieldErrors(error, form.setError);
        if (!boundToFields) setSubmitError(error);
      }
    },
  );

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send Notification"
        description="Create an in-app notification for one user."
      />

      <Banner
        tone="info"
        title="This sends one in-app notification to one user"
        description="The backend exposes no broadcast, campaign or multi-channel (SMS/WhatsApp/email) send endpoint. This form creates a single row in the named user's in-app inbox — it does not dispatch email, SMS or WhatsApp."
      />

      <Form {...form}>
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {submitError ? (
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>Couldn&apos;t send notification</AlertTitle>
              <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Recipient &amp; content</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="userId"
                label="User id"
                description="The single recipient this notification is created for."
                disabled={isSubmitting}
              />
              <TextField
                control={form.control}
                name="actionUrl"
                label="Action URL"
                description="Opened when the user selects the notification. Optional."
                disabled={isSubmitting}
              />
              <div className="sm:col-span-2">
                <TextField
                  control={form.control}
                  name="title"
                  label="Title"
                  disabled={isSubmitting}
                />
              </div>
              <div className="sm:col-span-2">
                <TextareaField
                  control={form.control}
                  name="content"
                  label="Content"
                  rows={4}
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
                name="category"
                label="Category"
                options={CATEGORY_OPTIONS}
                disabled={isSubmitting}
              />
              <SelectField
                control={form.control}
                name="priority"
                label="Priority"
                options={PRIORITY_OPTIONS}
                disabled={isSubmitting}
              />
              <CheckboxField
                control={form.control}
                name="isPinned"
                label="Pin to the top of the recipient's inbox"
                disabled={isSubmitting}
                className="sm:col-span-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <TextareaField
                control={form.control}
                name="metadataText"
                label="Metadata (JSON)"
                rows={4}
                placeholder={"{\n  \"key\": \"value\"\n}"}
                description="Free-form JSON attached to the notification. No keys are documented for this field."
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" label="Sending" /> : null}
              {isSubmitting ? "Sending…" : "Send notification"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
