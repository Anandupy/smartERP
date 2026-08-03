"use client";

import { useState } from "react";

import { Mail, Phone, TriangleAlert } from "@/assets/icons";
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
import { BackendPendingNote, Spinner } from "@/shared/components/feedback";

import {
  organizationFormSchema,
  type OrganizationFormValues,
} from "../schemas/organization.schema";

export interface OrganizationFormProps {
  defaultValues: OrganizationFormValues;
  submitLabel: string;
  onSubmit: (values: OrganizationFormValues) => Promise<unknown>;
  onCancel: () => void;
}

/**
 * Create or edit an organization.
 *
 * One form for both, because create and update take identical bodies — the
 * only difference is which mutation the route hands in.
 *
 * The fields are exactly the fourteen the Postman request defines, grouped the
 * way the design groups them: identity, contact, address, regional. The design
 * also shows a legal entity type, an official website, a primary admin name
 * and email, and a default language; none of those is in the contract, so none
 * of them is here. A field that cannot be saved is worse than a field that is
 * absent — it invites data the backend will silently drop.
 *
 * Logo is a URL field rather than the design's upload control: the contract
 * documents `logoUrl` as a string and no upload endpoint exists, so a
 * drop-zone would be a control with nowhere to send the file.
 */
export function OrganizationForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: OrganizationFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(organizationFormSchema, {
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
            <AlertTitle>Couldn&apos;t save the organization</AlertTitle>
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
              label="Organization name"
              placeholder="Horizon Education Trust"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="code"
              label="Code"
              placeholder="horizon-trust"
              description="Unique, lowercase and slug-safe. Used to identify the organization across the platform."
              disabled={isSubmitting}
            />
            <div className="space-y-2 sm:col-span-2">
              <TextField
                control={form.control}
                name="logoUrl"
                label="Logo URL"
                placeholder="https://…"
                description="Optional."
                disabled={isSubmitting}
              />
              <BackendPendingNote>
                uploading a logo needs a file endpoint, which is not documented
                — only the URL string is.
              </BackendPendingNote>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="contactEmail"
              type="email"
              label="Contact email"
              placeholder="admin@horizon.edu"
              startIcon={<Mail />}
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="contactPhone"
              type="tel"
              label="Contact phone"
              placeholder="9876543210"
              startIcon={<Phone />}
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="addressLine1"
              label="Address line 1"
              placeholder="100 Corporate Towers"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="addressLine2"
              label="Address line 2"
              placeholder="Financial District"
              description="Optional."
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="city"
              label="City"
              placeholder="Mumbai"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="state"
              label="State"
              placeholder="Maharashtra"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="country"
              label="Country"
              placeholder="India"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="pincode"
              label="Postal code"
              placeholder="400001"
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Regional &amp; subscription</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="timezone"
              label="Timezone"
              placeholder="Asia/Kolkata"
              description="IANA zone."
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="currency"
              label="Currency"
              placeholder="INR"
              description="No currency list is documented, so any code is accepted here."
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="masterExpiryDate"
              type="date"
              label="Master expiry date"
              description="When the organization's subscription lapses."
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
