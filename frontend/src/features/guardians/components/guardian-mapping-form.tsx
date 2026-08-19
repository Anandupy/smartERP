"use client";

import {
  CheckboxField,
  Form,
  TextField,
  applyServerFieldErrors,
  useZodForm,
} from "@/components/form";
import { getErrorMessage } from "@/lib";

import {
  guardianMappingFormSchema,
  type GuardianMappingFormValues,
} from "../schemas/guardian.schema";

export interface GuardianMappingFormProps {
  defaultValues: GuardianMappingFormValues;
  formId: string;
  onSubmit: (values: GuardianMappingFormValues) => Promise<unknown>;
  onError?: (message: string) => void;
  disabled?: boolean;
  /** The Relation Type master picker, slotted in by the route composition. */
  relationTypePicker: React.ReactNode;
}

/**
 * The relationship this guardian has to the application — every field
 * `ApplicantGuardianMapping` documents (module doc §5.4). Deliberately
 * separate from `GuardianForm`: a guardian is a human; a mapping is one
 * application's relationship to them, and the same guardian can carry a
 * different relationship on a sibling's application.
 */
export function GuardianMappingForm({
  defaultValues,
  formId,
  onSubmit,
  onError,
  disabled = false,
  relationTypePicker,
}: GuardianMappingFormProps) {
  const form = useZodForm(guardianMappingFormSchema, {
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
      <form
        id={formId}
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4"
      >
        {relationTypePicker}

        <div className="grid gap-3 sm:grid-cols-2">
          <CheckboxField
            control={form.control}
            name="isPrimary"
            label="Primary guardian"
            disabled={disabled}
          />
          <CheckboxField
            control={form.control}
            name="isFinancialGuardian"
            label="Financial guardian"
            disabled={disabled}
          />
          <CheckboxField
            control={form.control}
            name="isEmergencyContact"
            label="Emergency contact"
            disabled={disabled}
          />
          <CheckboxField
            control={form.control}
            name="pickupAllowed"
            label="Pickup allowed"
            disabled={disabled}
          />
        </div>

        <TextField
          control={form.control}
          name="priority"
          type="number"
          label="Priority"
          description="Optional. Lower numbers are contacted first."
          disabled={disabled}
        />
      </form>
    </Form>
  );
}
