"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { SelectField, type SelectFieldOption } from "@/components/form";

import { APPLIES_TO_ALL } from "../schemas/document-requirement.schema";

export interface OptionalSelectFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  allLabel: string;
  description?: string;
  /** Pre-resolved options — this component owns no fetching (AGENTS.md §28: two features meet at the route). */
  options: readonly SelectFieldOption[];
  disabled?: boolean;
}

/**
 * A `SelectField` with a leading "applies to all" option, for the three
 * nullable `DocumentRequirement` scope axes (design spec §8).
 *
 * Deliberately generic and not the Program/Admission-Masters pickers
 * themselves: those bind a *required* selection and offer no "all" affordance
 * anywhere else in the app, so this stays a small documents-owned wrapper
 * over options its caller — the route composition — resolves from the real
 * pickers' own list hooks.
 */
export function OptionalSelectField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  allLabel,
  description,
  options,
  disabled,
}: OptionalSelectFieldProps<TFieldValues>) {
  return (
    <SelectField
      control={control}
      name={name}
      label={label}
      description={description}
      disabled={disabled}
      options={[{ value: APPLIES_TO_ALL, label: allLabel }, ...options]}
    />
  );
}
