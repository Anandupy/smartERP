"use client";

import { useState } from "react";

import { TriangleAlert } from "@/assets/icons";
import {
  CheckboxField,
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

import {
  applicantFormSchema,
  type ApplicantFormValues,
} from "../schemas/applicant.schema";

export interface ApplicantFormProps {
  defaultValues: ApplicantFormValues;
  submitLabel: string;
  onSubmit: (values: ApplicantFormValues) => Promise<unknown>;
  onCancel: () => void;
  /** Locked once the applicant has left `DRAFT` — see the lock rule. */
  disabled?: boolean;
  disabledReason?: string;

  /**
   * Master-data and program pickers, slotted in by the route composition.
   * AGENTS.md §28: two features meet at the route, never by importing each
   * other — this form has no idea Admission Masters or Program exist, only
   * that it has ten slots to fill. Each picker binds itself to this form via
   * `useFormContext()`.
   */
  programPicker: React.ReactNode;
  genderPicker: React.ReactNode;
  religionPicker: React.ReactNode;
  castePicker: React.ReactNode;
  categoryPicker: React.ReactNode;
  motherTonguePicker: React.ReactNode;
  bloodGroupPicker: React.ReactNode;
  disabilityTypePicker: React.ReactNode;
  admissionSourcePicker: React.ReactNode;
  quotaPicker: React.ReactNode;

  /**
   * Rendered inside the form, above the first section — e.g. the admission
   * form scanner, which fills fields through `useFormContext()`.
   */
  header?: React.ReactNode;
}

/**
 * Applicant Information — the first step of a new admission, and the only
 * one this phase ships. Fields are exactly the 43 the Postman collection
 * documents for `POST /admissions/applicants`
 * (`docs/admission-lifecycle-module.md` §3.2) — grouped the way the design
 * brief groups them, but nothing beyond the documented contract is offered.
 *
 * Identity resolution (Person), guardians and documents are deliberately
 * **not** collected here: identity resolves automatically at `submit`
 * (`docs/admission-lifecycle-module.md` §2.5) with no "Create Person" action
 * to build, and guardians/documents are their own workspaces the Applicant
 * Journey Hub links to once the application exists.
 */
export function ApplicantForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  disabled = false,
  disabledReason,
  programPicker,
  genderPicker,
  religionPicker,
  castePicker,
  categoryPicker,
  motherTonguePicker,
  bloodGroupPicker,
  disabilityTypePicker,
  admissionSourcePicker,
  quotaPicker,
  header,
}: ApplicantFormProps) {
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useZodForm(applicantFormSchema, {
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
  const isDisabled = disabled || isSubmitting;
  const disabilityStatus = form.watch("disabilityStatus");

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {disabled && disabledReason ? (
          <Alert>
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>This application can no longer be edited</AlertTitle>
            <AlertDescription>{disabledReason}</AlertDescription>
          </Alert>
        ) : null}

        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t save the application</AlertTitle>
            <AlertDescription>{getErrorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}

        {header}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Basic information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="firstName"
              label="First name"
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="middleName"
              label="Middle name"
              description="Optional."
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="lastName"
              label="Last name"
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="dob"
              type="date"
              label="Date of birth"
              disabled={isDisabled}
            />
            {genderPicker}
            <TextField
              control={form.control}
              name="birthPlace"
              label="Birth place"
              description="Optional."
              disabled={isDisabled}
            />
            {religionPicker}
            {castePicker}
            {categoryPicker}
            {motherTonguePicker}
            {bloodGroupPicker}
            <TextField
              control={form.control}
              name="aadhaarNo"
              label="Government ID (Aadhaar)"
              description="Optional. Used only to resolve identity at submission — never displayed again after saving."
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="penNo"
              label="PEN"
              description="Optional."
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="apaarId"
              label="APAAR ID"
              description="Optional."
              disabled={isDisabled}
            />
            <div className="space-y-4 sm:col-span-2">
              <CheckboxField
                control={form.control}
                name="disabilityStatus"
                label="Applicant has a disability"
                disabled={isDisabled}
              />
              {disabilityStatus ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  {disabilityTypePicker}
                  <TextField
                    control={form.control}
                    name="disabilityNotes"
                    label="Disability notes"
                    description="Optional."
                    disabled={isDisabled}
                  />
                </div>
              ) : null}
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
              name="primaryMobile"
              type="tel"
              label="Primary mobile"
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="alternateMobile"
              type="tel"
              label="Alternate mobile"
              description="Optional."
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="primaryEmail"
              type="email"
              label="Primary email"
              description="Optional."
              disabled={isDisabled}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <p className="text-muted-foreground text-sm sm:col-span-2">
              This is the address declared on this application — a frozen
              snapshot of what was filed, not the applicant&apos;s current
              address record.
            </p>
            <TextField
              control={form.control}
              name="currentAddressLine1"
              label="Address line 1"
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="currentAddressLine2"
              label="Address line 2"
              description="Optional."
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="city"
              label="City"
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="district"
              label="District"
              description="Optional."
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="state"
              label="State"
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="country"
              label="Country"
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="pincode"
              label="Postal code"
              disabled={isDisabled}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Previous education</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="previousSchoolName"
              label="Previous school / institution"
              description="Optional."
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="previousBoard"
              label="Board / university"
              description="Optional."
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="previousClass"
              label="Previous class"
              description="Optional."
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="previousPercentage"
              type="number"
              label="Previous percentage"
              description="Optional."
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="tcNumber"
              label="Transfer certificate number"
              description="Optional."
              disabled={isDisabled}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Application context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            {programPicker}
            {admissionSourcePicker}
            {quotaPicker}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Remarks &amp; requirements</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="internalRemarks"
              label="Internal remarks"
              description="Optional. Staff-only."
              disabled={isDisabled}
            />
            <TextField
              control={form.control}
              name="counsellorRemarks"
              label="Counsellor remarks"
              description="Optional."
              disabled={isDisabled}
            />
            <CheckboxField
              control={form.control}
              name="transportRequired"
              label="Transport required"
              disabled={isDisabled}
            />
            <CheckboxField
              control={form.control}
              name="hostelRequired"
              label="Hostel required"
              disabled={isDisabled}
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
          <Button type="submit" disabled={isDisabled}>
            {isSubmitting ? <Spinner size="sm" label="Saving" /> : null}
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
