"use client";

import { useFormContext } from "react-hook-form";

import { SelectField } from "@/components/form";
import { BackendPendingNote } from "@/shared/components/feedback";

import { academicUnitState, placementTargetState } from "../constants";
import { useAcademicUnitScope, useAcademicUnits } from "../hooks/use-academic-units";
import type { AcademicUnitDto } from "../types/academic-unit.dto";

export interface AcademicUnitPickerProps {
  name?: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  /** Hides inactive units. On by default. */
  activeOnly?: boolean;
  /**
   * Excludes structural units — those with active children ("Grade 1") — so
   * only a genuine placement ("Grade 1 → Division A") can be selected. On by
   * default; the one caller that would ever need it off is a future screen
   * managing the hierarchy itself, not choosing where a learner sits.
   *
   * See `docs/academic-unit-module.md` §"Placement targets" and
   * `backend/docs/planning/academic-placement-refinement.md` §4 — the
   * backend refuses a structural node as `academicUnitId` with
   * `ACADEMIC_UNIT_NOT_PLACEMENT_TARGET` regardless of what this picker
   * offers; this is the UI half of the same rule; the frontend cannot be the
   * only place it is enforced.
   */
  placementTargetsOnly?: boolean;
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
 * **The option label is the full path, never the bare name.** "Division A"
 * alone is ambiguous — every program with more than one class has one.
 * `unit.displayPath` ("Grade 1 → Division A") is what the backend computes
 * for exactly this reason; a client-rebuilt path would risk disagreeing with
 * it. Falls back to the bare name only for the create/update/move/toggle
 * responses that don't return `displayPath` at all (the DTO), which this
 * picker's own read query never actually returns.
 *
 * Binds through `useFormContext()`, exactly like `ProgramPicker`.
 */
export function AcademicUnitPicker({
  name = "academicUnitId",
  label = "Academic placement",
  description,
  disabled = false,
  activeOnly = true,
  placementTargetsOnly = true,
  programId,
}: AcademicUnitPickerProps) {
  const form = useFormContext();
  const scope = useAcademicUnitScope();
  const { units, isPending, error } = useAcademicUnits(scope);

  if (!form) return null;

  const inProgram = programId
    ? units.filter((unit) => unit.programId === programId)
    : units;
  const active = activeOnly
    ? inProgram.filter((unit) => academicUnitState(unit) !== "inactive")
    : inProgram;
  const selectable = placementTargetsOnly
    ? active.filter((unit) => placementTargetState(unit) === "target")
    : active;

  const options = selectable.map((unit) => ({
    value: unit.id,
    label: unit.displayPath ?? unit.name,
    hint: unit.code ?? undefined,
  }));

  // Distinguishes "nothing configured" from "structure exists but nothing is
  // a leaf yet" — a program with only "Grade 1" and no divisions under it
  // reads differently from one with no academic units at all, and a
  // registrar needs to know which to fix.
  const structuralOnly =
    placementTargetsOnly && active.length > 0 && selectable.length === 0;

  const placeholder = isPending
    ? "Loading academic units…"
    : error
      ? "Academic units could not be loaded"
      : options.length === 0
        ? "No academic units to choose from"
        : "Select an academic placement…";

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
          {structuralOnly
            ? "this programme's academic units are all structural (they have divisions, sections or batches under them) — none is itself a placement target yet. Add a leaf unit under the existing structure."
            : programId
              ? "this programme has no academic units in the active branch and year yet."
              : "there are no academic units in the active branch and year yet."}
        </BackendPendingNote>
      ) : null}
    </div>
  );
}

/** A unit's path as it should read in any UI outside this picker — same fallback rule. */
export function academicUnitDisplayPath(unit: AcademicUnitDto): string {
  return unit.displayPath ?? unit.name;
}
