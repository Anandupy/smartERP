"use client";

import { useState } from "react";

import { Mail, Phone, TriangleAlert } from "@/assets/icons";
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
import { useWorkspace } from "@/core/workspace";
import { getErrorMessage } from "@/lib";
import { BackendPendingNote, Spinner } from "@/shared/components/feedback";

import {
  AFFILIATION_TYPE_LABELS,
  INSTITUTION_TYPE_OPTIONS,
  STRUCTURE_MODE_OPTIONS,
  STRUCTURE_MODE_PRESENTATION,
} from "../constants";
import {
  NO_AFFILIATION,
  branchFormSchema,
  type BranchFormValues,
} from "../schemas/branch.schema";
import { AFFILIATION_TYPES } from "../types/branch.dto";

export interface BranchFormProps {
  defaultValues: BranchFormValues;
  submitLabel: string;
  onSubmit: (values: BranchFormValues) => Promise<unknown>;
  onCancel: () => void;
  /** Locks the owning organization. Editing never moves a branch between them. */
  lockOrganization?: boolean;
  /** `data-guide` target for the submit button — set only by the create
   * screen, whose guide step points at it. */
  submitGuideTarget?: string;
}

/** Affiliation options, with the documented "no affiliation" case first. */
const AFFILIATION_OPTIONS = [
  { value: NO_AFFILIATION, label: "No affiliation" },
  ...AFFILIATION_TYPES.map((value) => ({
    value,
    label: AFFILIATION_TYPE_LABELS[value],
  })),
];

/**
 * Create or edit a branch.
 *
 * One form for both, because create and update take identical bodies — the
 * only difference is which mutation the route hands in.
 *
 * The fields are exactly the seventeen the Postman request defines, grouped as
 * the design groups them: identity, classification, contact, address,
 * structure. The design also shows a parent-organization picker with a wider
 * scope, an operational-hours block and a stakeholder list; none of those is in
 * the contract, so none of them is here.
 *
 * The owning organization comes from the active workspace rather than a free
 * text box, and is locked when editing: `organizationId` is a documented field
 * of the update body, but moving a branch between organizations is a migration
 * rather than an edit, and nothing in the contract describes what should happen
 * to the academic years and programs underneath it.
 */
export function BranchForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  lockOrganization = false,
  submitGuideTarget,
}: BranchFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const { options } = useWorkspace();

  const form = useZodForm(branchFormSchema, {
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
  const structureMode = form.watch("structureMode");
  const affiliationType = form.watch("affiliationType");

  const organizationOptions = options.organizations.map((organization) => ({
    value: organization.id,
    label: organization.name,
    hint: organization.code ?? undefined,
  }));

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t save the branch</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="organizationId"
              label="Parent organization"
              options={organizationOptions}
              placeholder="Select an organization…"
              description={
                lockOrganization
                  ? "Locked. Moving a branch between organizations is a migration, not an edit."
                  : "The organization this branch belongs to."
              }
              disabled={isSubmitting || lockOrganization}
            />
            <TextField
              control={form.control}
              name="name"
              label="Branch name"
              placeholder="Horizon High School — North Campus"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="code"
              label="Code"
              placeholder="hhs-north"
              description="Unique, lowercase and slug-safe."
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="registrationNumber"
              label="Registration number"
              description="Optional. Unique across the system when provided."
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
            <CardTitle>Classification</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="institutionType"
              label="Institution type"
              options={INSTITUTION_TYPE_OPTIONS}
              disabled={isSubmitting}
            />
            <SelectField
              control={form.control}
              name="affiliationType"
              label="Affiliation"
              options={AFFILIATION_OPTIONS}
              description="The kind of body this branch is affiliated with, if any."
              disabled={isSubmitting}
            />
            {affiliationType !== NO_AFFILIATION ? (
              <TextField
                control={form.control}
                name="affiliationName"
                label="Affiliating body"
                placeholder="CBSE"
                description="The specific board or university."
                disabled={isSubmitting}
              />
            ) : null}
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
              placeholder="north.branch@horizon.edu"
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
              placeholder="123 Education Lane"
              disabled={isSubmitting}
            />
            <TextField
              control={form.control}
              name="addressLine2"
              label="Address line 2"
              placeholder="Suite 400"
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
            <CardTitle>Structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <SelectField
              control={form.control}
              name="structureMode"
              label="Structure mode"
              options={STRUCTURE_MODE_OPTIONS}
              disabled={isSubmitting}
              className="sm:max-w-sm"
            />
            <p className="text-muted-foreground text-sm">
              {STRUCTURE_MODE_PRESENTATION[structureMode].description}
            </p>
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
          <Button
            type="submit"
            disabled={isSubmitting}
            data-guide={submitGuideTarget}
          >
            {isSubmitting ? <Spinner size="sm" label="Saving" /> : null}
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
