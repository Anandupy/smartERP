"use client";

import { useId, useState } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { Eye, EyeOff } from "@/assets/icons";
import { Button } from "@/components/ui/button";
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

export interface PasswordFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  /** Decorative leading glyph rendered inside the input. */
  startIcon?: React.ReactNode;
  /** Node rendered on the trailing edge of the label row. */
  labelAction?: React.ReactNode;
  /** Extra classes for the `<input>` itself (sizing, density). */
  inputClassName?: string;
}

/**
 * Password field with an accessible show/hide toggle.
 *
 * The toggle is a real `<button type="button">` with an `aria-label` that
 * states the action and `aria-pressed` reflecting the current state, and a live
 * region announces the change — so screen-reader users always know whether the
 * password is exposed. Generic form infrastructure: no auth-specific logic.
 */
export function PasswordField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  autoComplete = "current-password",
  startIcon,
  labelAction,
  inputClassName,
}: PasswordFieldProps<TFieldValues>) {
  const [isVisible, setIsVisible] = useState(false);
  const statusId = useId();

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
                type={isVisible ? "text" : "password"}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete={autoComplete}
                className={cn(startIcon && "pl-10", "pr-11", inputClassName)}
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label={isVisible ? "Hide password" : "Show password"}
              aria-pressed={isVisible}
              onClick={() => setIsVisible((visible) => !visible)}
              className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-1 my-auto"
            >
              {isVisible ? (
                <EyeOff aria-hidden="true" />
              ) : (
                <Eye aria-hidden="true" />
              )}
            </Button>
          </div>
          <span aria-live="polite" className="sr-only" id={statusId}>
            {isVisible ? "Password is visible" : "Password is hidden"}
          </span>
          {description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
