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
import { BackendPendingNote, Spinner } from "@/shared/components/feedback";

import { LIVE_PROVIDERS, PROVIDER_OPTIONS } from "../../constants";
import { useUpdateCommunicationSettings } from "../../hooks/use-communication-settings";
import { toSettingsFormValues, toSettingsRequest } from "../../mappers/settings.mapper";
import { communicationSettingsFormSchema } from "../../schemas/settings.schema";
import type { CommunicationSettingsDto } from "../../types/settings.dto";

export interface CommunicationSettingsFormProps {
  settings: CommunicationSettingsDto;
  scope: { organizationId: string; branchId: string };
}

/**
 * Communication Settings — `PATCH /communication/settings?organizationId=&branchId=`.
 *
 * Two cards, twelve fields, exactly what the endpoint documents: five channel
 * toggles, three operational toggles, and four provider selects. No
 * credentials, sender identity or rate limits — none of that is in the
 * documented body, and the module doc is explicit that `ProviderConfig` has
 * no controller at all.
 */
export function CommunicationSettingsForm({
  settings,
  scope,
}: CommunicationSettingsFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const update = useUpdateCommunicationSettings(scope);

  const defaults = toSettingsFormValues(settings);
  const form = useZodForm(communicationSettingsFormSchema, {
    defaultValues: defaults,
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const saved = await update.mutateAsync(toSettingsRequest(values));
      form.reset(toSettingsFormValues(saved));
    } catch (error) {
      const boundToFields = applyServerFieldErrors(error, form.setError);
      if (!boundToFields) setSubmitError(error);
    }
  });

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
            <CardTitle>Channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <SwitchField
              control={form.control}
              name="emailEnabled"
              label="Email"
              description="Dispatch messages over the email channel."
              disabled={isSubmitting}
            />
            <SwitchField
              control={form.control}
              name="smsEnabled"
              label="SMS"
              description="Dispatch messages over SMS. The default provider is a stub — see below."
              disabled={isSubmitting}
            />
            <SwitchField
              control={form.control}
              name="whatsappEnabled"
              label="WhatsApp"
              description="Dispatch messages over WhatsApp. The default provider is a stub — see below."
              disabled={isSubmitting}
            />
            <SwitchField
              control={form.control}
              name="pushEnabled"
              label="Push"
              description="Dispatch push notifications. The default provider is a stub — see below."
              disabled={isSubmitting}
            />
            <SwitchField
              control={form.control}
              name="otpEnabled"
              label="OTP"
              description="Allow OTP generation and verification for this scope."
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <SwitchField
              control={form.control}
              name="trackingEnabled"
              label="Delivery tracking"
              description="Record open and click timestamps where a provider reports them. No webhook receiver is documented, so these will typically stay unset regardless."
              disabled={isSubmitting}
            />
            <SwitchField
              control={form.control}
              name="analyticsEnabled"
              label="Analytics"
              description="Aggregate delivery outcomes for the Analytics screen."
              disabled={isSubmitting}
            />
            <SwitchField
              control={form.control}
              name="retryEnabled"
              label="Automatic retry"
              description="Retry a failed delivery according to the platform's retry strategy."
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Default providers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <SelectField
              control={form.control}
              name="defaultEmailProvider"
              label="Email provider"
              options={PROVIDER_OPTIONS}
              disabled={isSubmitting}
              className="sm:max-w-sm"
            />
            <SelectField
              control={form.control}
              name="defaultSmsProvider"
              label="SMS provider"
              options={PROVIDER_OPTIONS}
              disabled={isSubmitting}
              className="sm:max-w-sm"
            />
            <SelectField
              control={form.control}
              name="defaultWhatsappProvider"
              label="WhatsApp provider"
              options={PROVIDER_OPTIONS}
              disabled={isSubmitting}
              className="sm:max-w-sm"
            />
            <SelectField
              control={form.control}
              name="defaultPushProvider"
              label="Push provider"
              options={PROVIDER_OPTIONS}
              disabled={isSubmitting}
              className="sm:max-w-sm"
            />
            <BackendPendingNote>
              only {LIVE_PROVIDERS.join(", ")} has a real backend
              implementation today. Selecting another provider changes
              routing, not reachability — messages will not actually leave
              until that provider is implemented. No provider credential or
              configuration API exists (`ProviderConfig` has no controller),
              so this module offers selection only, never configuration.
            </BackendPendingNote>
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
