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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectFieldOption {
  value: string;
  label: string;
  /** Second line inside the option, for codes or qualifiers. */
  hint?: string;
  disabled?: boolean;
}

export interface SelectFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
  placeholder?: string;
  options: readonly SelectFieldOption[];
  disabled?: boolean;
  className?: string;
}

/**
 * Single-choice select bound to React Hook Form.
 *
 * Radix's select works on strings, so callers map their enum to string values
 * and back — the schema is where the value becomes a typed union again, which
 * keeps the coercion in one place instead of in every `onValueChange`.
 */
export function SelectField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder = "Select…",
  options,
  disabled,
  className,
}: SelectFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label ? <FormLabel>{label}</FormLabel> : null}
          <Select
            value={field.value ? String(field.value) : undefined}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className={cn("w-full", className)}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  <span>{option.label}</span>
                  {option.hint ? (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {option.hint}
                    </span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
