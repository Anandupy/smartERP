"use client";

import { useId } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PhoneFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  /** RHF field carrying the leading `+<country code>`, e.g. `"+91"`. */
  codeName: FieldPath<TFieldValues>;
  /** RHF field carrying the national number, digits only. */
  numberName: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Country-code + national-number phone input, combined into one E.164 string
 * only where the two actually meet the wire (the feature's own mapper) —
 * see `@/lib/phone`. Kept as two RHF fields rather than one field the
 * component splits and rejoins on every render, since parsing an opaque
 * `+919876543210` back into "which prefix is the code" is ambiguous without
 * a country database this product doesn't have.
 *
 * Two independent `FormField`/`FormItem` pairs are used instead of one
 * shared `FormLabel`, because `useFormField` (which every shadcn form
 * primitive reads) is scoped to exactly one field name — there is no single
 * context two inputs can share. The visual label above them is a plain
 * `Label`, describing the pair as a whole.
 */
export function PhoneField<TFieldValues extends FieldValues>({
  control,
  codeName,
  numberName,
  label = "Phone",
  description,
  disabled,
}: PhoneFieldProps<TFieldValues>) {
  const descriptionId = useId();

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <FormField
          control={control}
          name={codeName}
          render={({ field }) => (
            <FormItem className="w-20 shrink-0">
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  aria-label="Country code"
                  aria-describedby={description ? descriptionId : undefined}
                  inputMode="tel"
                  placeholder="+91"
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={numberName}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  aria-label="Phone number"
                  aria-describedby={description ? descriptionId : undefined}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      {description ? (
        <p id={descriptionId} className="text-muted-foreground text-sm">
          {description}
        </p>
      ) : null}
    </div>
  );
}
