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
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

export interface OtpFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
  /** Number of digits. Defaults to the backend's six-digit codes. */
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Fired once the last slot is filled — wire it to auto-submit. */
  onComplete?: (value: string) => void;
  className?: string;
}

/**
 * One-time-code field bound to React Hook Form.
 *
 * Built on shadcn's `input-otp`, which already provides the behavior this kind
 * of control is usually reimplemented badly for: a single real input behind the
 * slots (so paste, autofill and `autocomplete="one-time-code"` work), arrow-key
 * and backspace navigation, and a visible caret. This wrapper only adds the
 * form binding, digit-only input, and the label/message a11y wiring.
 */
export function OtpField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  length = 6,
  disabled,
  autoFocus,
  onComplete,
  className,
}: OtpFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={cn("items-center", className)}>
          {label ? <FormLabel className="sr-only">{label}</FormLabel> : null}
          <FormControl>
            <InputOTP
              maxLength={length}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              autoFocus={autoFocus}
              disabled={disabled}
              aria-label={label}
              aria-invalid={Boolean(fieldState.error)}
              containerClassName="w-full justify-center"
              {...field}
              value={field.value ?? ""}
              onChange={(value: string) => {
                const digits = value.replace(/\D/g, "");
                field.onChange(digits);
                if (digits.length === length) onComplete?.(digits);
              }}
            >
              <InputOTPGroup className="gap-2 sm:gap-3">
                {Array.from({ length }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="size-11 rounded-lg border-l text-lg font-medium sm:size-13 sm:text-xl"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </FormControl>
          {description ? (
            <FormDescription className="text-center">
              {description}
            </FormDescription>
          ) : null}
          <FormMessage className="text-center" />
        </FormItem>
      )}
    />
  );
}
