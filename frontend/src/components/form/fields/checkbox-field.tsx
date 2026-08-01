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
import { cn } from "@/lib/utils";

export interface CheckboxFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Boolean checkbox bound to React Hook Form. Radix wires the label to the
 * control, so clicking the text toggles the box and the accessible name is the
 * label copy.
 */
export function CheckboxField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  className,
}: CheckboxFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={cn("grid-cols-[auto_1fr] items-center", className)}
        >
          <FormControl>
            <Checkbox
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
              disabled={disabled}
            />
          </FormControl>
          <FormLabel className="font-normal">{label}</FormLabel>
          {description ? (
            <FormDescription className="col-span-2">
              {description}
            </FormDescription>
          ) : null}
          <FormMessage className="col-span-2" />
        </FormItem>
      )}
    />
  );
}
