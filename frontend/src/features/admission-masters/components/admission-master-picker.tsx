"use client";

import { useFormContext } from "react-hook-form";

import { SelectField } from "@/components/form";
import { BackendPendingNote } from "@/shared/components/feedback";

import type { AdmissionMasterType } from "../config/admission-master-registry";
import { admissionMasterConfig } from "../config/admission-master-registry";
import { useAdmissionMasterList } from "../hooks/use-admission-masters";

export interface AdmissionMasterPickerProps {
  /** Which of the 10 masters to offer — e.g. `"genders"`, `"quotas"`. */
  type: AdmissionMasterType;
  /** The form field to bind. Defaults to `<type-without-s>Id` is too fragile, so callers always name it. */
  name: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  /** Hides inactive records. On by default. */
  activeOnly?: boolean;
}

/**
 * An admission-master selector any feature can drop into its own form.
 *
 * The same seam `ProgramPicker` establishes for Program ↔ Academic Unit
 * (AGENTS.md §28): Admissions needs pickers for genders, religions, castes,
 * categories, mother tongues, blood groups, disability types, admission
 * sources, quotas and relation types — but a feature may not reach into
 * another feature, so this is exported from Admission Masters' own public
 * surface and rendered by the *route* that composes Admissions and Admission
 * Masters together.
 *
 * Binds through `useFormContext()` — the same mechanism `ProgramPicker` uses
 * — so it attaches to whatever form it is rendered inside with no prop
 * threading across the feature boundary, and renders nothing if that form is
 * absent.
 *
 * `includeInactive` is the only documented list parameter (`backend-gaps.md`
 * §L), so every record is fetched and inactive ones are filtered here,
 * client-side, the same as the masters directory itself.
 */
export function AdmissionMasterPicker({
  type,
  name,
  label,
  description,
  disabled = false,
  activeOnly = true,
}: AdmissionMasterPickerProps) {
  const form = useFormContext();
  const config = admissionMasterConfig(type);
  const { masters, isPending, error } = useAdmissionMasterList(type);

  if (!form) return null;

  const selectable = activeOnly
    ? masters.filter((master) => master.isActive)
    : masters;

  const options = selectable.map((master) => ({
    value: master.id,
    label: master.name,
    hint: master.code,
  }));

  const placeholder = isPending
    ? `Loading ${config.pluralLabel.toLowerCase()}…`
    : error
      ? `${config.pluralLabel} could not be loaded`
      : options.length === 0
        ? `No ${config.pluralLabel.toLowerCase()} in this branch`
        : `Select ${config.singularLabel.toLowerCase()}…`;

  return (
    <div className="space-y-2">
      <SelectField
        control={form.control}
        name={name}
        label={label ?? config.singularLabel}
        options={options}
        placeholder={placeholder}
        description={description}
        disabled={disabled || isPending || options.length === 0}
      />
      {!isPending && options.length === 0 && !error ? (
        <BackendPendingNote>
          this branch has no {config.pluralLabel.toLowerCase()} configured
          yet. Add one under Admission Masters before selecting it here.
        </BackendPendingNote>
      ) : null}
    </div>
  );
}
