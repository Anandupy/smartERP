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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface TextFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  disabled?: boolean;
  autoComplete?: string;
  /**
   * Decorative leading glyph rendered inside the input. Presentational only —
   * it is hidden from assistive tech and never carries meaning the label lacks.
   */
  startIcon?: React.ReactNode;
  /**
   * Node rendered on the trailing edge of the label row (e.g. a "Forgot
   * password?" link), leaving the control's accessible name untouched.
   */
  labelAction?: React.ReactNode;
  /** Extra classes for the `<input>` itself (sizing, density). */
  inputClassName?: string;
}

/**
 * Reusable text input field bound to React Hook Form. Wires label, control,
 * description, and validation message with correct a11y associations. Feature
 * forms compose these instead of re-wiring `FormField` each time.
 */
export function TextField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  type = "text",
  disabled,
  autoComplete,
  startIcon,
  labelAction,
  inputClassName,
}: TextFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label || labelAction ? (
            <div className="flex items-center justify-between gap-2">
              {label ? <FormLabel>{label}</FormLabel> : <span />}
              {labelAction}
            </div>
          ) : null}
          <div className="relative">
            {startIcon ? (
              <span
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 [&_svg]:size-4"
              >
                {startIcon}
              </span>
            ) : null}
            <FormControl>
              <Input
                type={type}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete={autoComplete}
                className={cn(startIcon && "pl-10", inputClassName)}
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
          </div>
          {description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
