"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface SwitchFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Boolean toggle bound to React Hook Form, laid out as a settings row: label
 * and explanation on the left, control on the right.
 *
 * A switch rather than a checkbox where the change takes effect on save but
 * reads as a state ("maintenance mode is on") rather than a choice. Radix
 * renders it as `role="switch"`, so assistive tech announces on/off instead of
 * checked/unchecked.
 */
export function SwitchField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  className,
}: SwitchFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={cn(
            "border-border flex flex-row items-center justify-between gap-4 rounded-xl border p-4",
            className,
          )}
        >
          <div className="min-w-0 space-y-1">
            <FormLabel>{label}</FormLabel>
            {description ? (
              <FormDescription>{description}</FormDescription>
            ) : null}
            <FormMessage />
          </div>
          <FormControl>
            <Switch
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
              disabled={disabled}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
