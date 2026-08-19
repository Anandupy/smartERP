"use client";

import {
  Form,
  TextField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { getErrorMessage } from "@/lib";

import {
  guardianFormSchema,
  type GuardianFormValues,
} from "../schemas/guardian.schema";

export interface GuardianFormProps {
  defaultValues: GuardianFormValues;
  formId: string;
  onSubmit: (values: GuardianFormValues) => Promise<unknown>;
  onError?: (message: string) => void;
  disabled?: boolean;
}

/**
 * The guardian's own fields — the 16 the Postman collection documents, plus
 * the transient `dob` (module doc §5.3), collected once to let the guardian
 * resolve identity and never displayed back.
 *
 * No submit button here — this form is always embedded inside a dialog whose
 * own footer drives submission via `form="{formId}"`, so create and map can
 * share one dialog flow without nesting `<form>` elements.
 */
export function GuardianForm({
  defaultValues,
  formId,
  onSubmit,
  onError,
  disabled = false,
}: GuardianFormProps) {
  const form = useZodForm(guardianFormSchema, {
    defaultValues,
    mode: "onSubmit",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      const boundToFields = applyServerFieldErrors(error, form.setError);
      if (!boundToFields) onError?.(getErrorMessage(error));
    }
  });

  return (
    <Form {...form}>
    <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="firstName"
          label="First name"
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="lastName"
          label="Last name"
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="middleName"
          label="Middle name"
          description="Optional."
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="dob"
          type="date"
          label="Date of birth"
          description="Used once to resolve identity — not stored on the guardian record itself."
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="mobilePrimary"
          type="tel"
          label="Primary mobile"
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="mobileSecondary"
          type="tel"
          label="Secondary mobile"
          description="Optional."
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="email"
          type="email"
          label="Email"
          description="Optional."
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="occupation"
          label="Occupation"
          description="Optional."
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="income"
          type="number"
          label="Annual income"
          description="Optional."
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="aadhaarNo"
          label="Government ID (Aadhaar)"
          description="Optional. Never displayed again after saving."
          disabled={disabled}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="addressLine1"
          label="Address line 1"
          description="Optional."
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="addressLine2"
          label="Address line 2"
          description="Optional."
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="city"
          label="City"
          description="Optional."
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="state"
          label="State"
          description="Optional."
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="country"
          label="Country"
          description="Optional."
          disabled={disabled}
        />
        <TextField
          control={form.control}
          name="pincode"
          label="Postal code"
          description="Optional."
          disabled={disabled}
        />
      </div>
    </form>
    </Form>
  );
}
