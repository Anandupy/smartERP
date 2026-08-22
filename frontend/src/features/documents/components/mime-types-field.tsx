"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { COMMON_MIME_TYPES } from "../constants";

export interface MimeTypesFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Multi-select for `DocumentType.allowedMimeTypes` — a `string[]`, min 1
 * (design spec §28). No enum is documented for the universe of allowed
 * values, so `COMMON_MIME_TYPES` is a UX convenience catalogue, not a
 * validated allow-list; the backend remains the sole authority on what it
 * accepts.
 */
export function MimeTypesField<TFieldValues extends FieldValues>({
  control,
  name,
  label = "Allowed file types",
  description = "At least one file type is required.",
  disabled,
}: MimeTypesFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected: string[] = Array.isArray(field.value) ? field.value : [];

        const toggle = (value: string, checked: boolean) => {
          field.onChange(
            checked
              ? [...selected, value]
              : selected.filter((entry) => entry !== value),
          );
        };

        return (
          <FormItem>
            {label ? <FormLabel>{label}</FormLabel> : null}
            <FormControl>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {COMMON_MIME_TYPES.map((option) => (
                  <label
                    key={option.value}
                    className="border-border has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 flex items-center gap-2 rounded-lg border p-2.5 text-sm"
                  >
                    <Checkbox
                      checked={selected.includes(option.value)}
                      onCheckedChange={(checked) =>
                        toggle(option.value, checked === true)
                      }
                      disabled={disabled}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </FormControl>
            {description ? <FormDescription>{description}</FormDescription> : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
