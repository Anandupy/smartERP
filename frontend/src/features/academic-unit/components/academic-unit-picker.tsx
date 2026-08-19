"use client";

import { useFormContext } from "react-hook-form";

import { SelectField } from "@/components/form";
import { BackendPendingNote } from "@/shared/components/feedback";

import { academicUnitState } from "../constants";
import { useAcademicUnitScope, useAcademicUnits } from "../hooks/use-academic-units";

export interface AcademicUnitPickerProps {
  name?: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  /** Hides inactive units. On by default. */
  activeOnly?: boolean;
  /** Narrows to one program's units — e.g. the applicant's confirmed program at admit time. */
  programId?: string | null;
}

/**
 * An academic-unit selector any feature can drop into its own form.
 *
 * Mirrors `ProgramPicker` (AGENTS.md §28): two features meet at the route,
 * never by importing each other. Admissions needs this at the final `admit()`
 * step — the applicant applied to a *programme*; which section they actually
 * join is the decision the admit transaction requires and nothing earlier in
 * the lifecycle records (`docs/admission-lifecycle-module.md` §8.6).
 *
 * Binds through `useFormContext()`, exactly like `ProgramPicker`.
 */
export function AcademicUnitPicker({
  name = "academicUnitId",
  label = "Academic unit",
  description,
  disabled = false,
  activeOnly = true,
  programId,
}: AcademicUnitPickerProps) {
  const form = useFormContext();
  const scope = useAcademicUnitScope();
  const { units, isPending, error } = useAcademicUnits(scope);

  if (!form) return null;

  const inProgram = programId
    ? units.filter((unit) => unit.programId === programId)
    : units;
  const selectable = activeOnly
    ? inProgram.filter((unit) => academicUnitState(unit) !== "inactive")
    : inProgram;

  const options = selectable.map((unit) => ({
    value: unit.id,
    label: unit.name,
    hint: unit.code ?? undefined,
  }));

  const placeholder = isPending
    ? "Loading academic units…"
    : error
      ? "Academic units could not be loaded"
      : options.length === 0
        ? "No academic units to choose from"
        : "Select an academic unit…";

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
          {programId
            ? "this programme has no academic units in the active branch and year yet."
            : "there are no academic units in the active branch and year yet."}
        </BackendPendingNote>
      ) : null}
    </div>
  );
}
