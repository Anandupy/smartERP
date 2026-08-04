"use client";

import { useFormContext } from "react-hook-form";

import { SelectField } from "@/components/form";
import { BackendPendingNote } from "@/shared/components/feedback";

import { programState } from "../constants";
import { useProgramBranch, usePrograms } from "../hooks/use-programs";
import { formatProgramClassification } from "../mappers/program.mapper";

export interface ProgramPickerProps {
  /** The form field to bind. Defaults to the documented request field name. */
  name?: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  /** Hides inactive programs. On by default — see below. */
  activeOnly?: boolean;
}

/**
 * A program selector that any feature can drop into its own form.
 *
 * **This is how Program and Academic Unit meet without importing each other.**
 * Academic Unit's request body names a `programId`, so its form needs a program
 * list — but a feature may not reach into another feature, and AGENTS.md §28 is
 * explicit that two features that meet do so **at the route, through slots**.
 *
 * So this component is exported from Program's public surface, rendered by the
 * *route*, and passed to Academic Unit's form as an opaque `React.ReactNode`.
 * Academic Unit never learns that programs exist as a module; it only knows it
 * has a slot to fill.
 *
 * The binding works because `@/components/form`'s `Form` **is** React Hook
 * Form's `FormProvider`. This component calls `useFormContext()` and therefore
 * attaches to whatever form it happens to be rendered inside, with no prop
 * threading across the feature boundary. If it is ever rendered outside a form
 * it renders nothing rather than throwing, since a missing slot should not take
 * down the screen it was meant to enhance.
 *
 * `activeOnly` defaults to true: a program the branch has deactivated is not
 * somewhere new academic units should be created, and the documented delete
 * rule treats active children as the thing that blocks a parent. A program
 * whose flag was **not reported** is still offered — an absent flag is not
 * evidence of deactivation, and hiding those would empty the picker against any
 * backend that omits the field.
 */
export function ProgramPicker({
  name = "programId",
  label = "Program",
  description,
  disabled = false,
  activeOnly = true,
}: ProgramPickerProps) {
  const form = useFormContext();
  const branch = useProgramBranch();
  const { programs, isPending, error } = usePrograms(branch?.id ?? null);

  if (!form) return null;

  const selectable = activeOnly
    ? programs.filter((program) => programState(program) !== "inactive")
    : programs;

  const options = selectable.map((program) => ({
    value: program.id,
    label: program.name,
    hint: formatProgramClassification(program) ?? undefined,
  }));

  const placeholder = isPending
    ? "Loading programs…"
    : error
      ? "Programs could not be loaded"
      : options.length === 0
        ? "No programs in this branch"
        : "Select a program…";

  return (
    <div className="space-y-2">
      <SelectField
        control={form.control}
        name={name}
        label={label}
        options={options}
        placeholder={placeholder}
        description={description}
        disabled={disabled || isPending || options.length === 0}
      />
      {!isPending && options.length === 0 && !error ? (
        <BackendPendingNote>
          this branch has no programs to choose from. An academic unit names a
          program in its request body, so one must exist first.
        </BackendPendingNote>
      ) : null}
    </div>
  );
}
